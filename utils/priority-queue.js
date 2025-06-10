import { getLogger } from './logger.js';

/**
 * Prioritní fronta pro úkoly s podporou SLA a scheduling
 */
export class PriorityQueue {
  constructor(options = {}) {
    this.logger = getLogger();
    this.queues = {
      high: [],
      medium: [],
      low: []
    };
    
    this.maxQueueSize = options.maxQueueSize || 1000;
    this.slaConfig = {
      high: { maxWaitTime: 30000, maxExecutionTime: 300000 }, // 30s wait, 5min execution
      medium: { maxWaitTime: 120000, maxExecutionTime: 600000 }, // 2min wait, 10min execution  
      low: { maxWaitTime: 600000, maxExecutionTime: 1800000 } // 10min wait, 30min execution
    };
    
    // Statistiky
    this.stats = {
      enqueued: { high: 0, medium: 0, low: 0 },
      dequeued: { high: 0, medium: 0, low: 0 },
      slaViolations: { high: 0, medium: 0, low: 0 },
      totalProcessed: 0
    };
    
    // Pravidelné čištění expirovaných úkolů
    this.cleanupInterval = setInterval(() => this.cleanupExpiredTasks(), 60000); // každou minutu
    
    this.logger.info('Priority queue initialized', {
      maxSize: this.maxQueueSize,
      slaConfig: this.slaConfig
    });
  }

  /**
   * Přidá úkol do fronty podle priority
   */
  enqueue(task, priority = 'medium', options = {}) {
    if (!['high', 'medium', 'low'].includes(priority)) {
      throw new Error(`Invalid priority: ${priority}. Must be 'high', 'medium', or 'low'`);
    }

    // Zkontrolovat limity fronty
    const totalSize = this.getTotalSize();
    if (totalSize >= this.maxQueueSize) {
      this.logger.warn('Queue is full, rejecting task', { 
        taskId: task.id,
        priority,
        queueSize: totalSize 
      });
      throw new Error('Queue is full');
    }

    const queuedTask = {
      ...task,
      priority,
      queuedAt: Date.now(),
      sla: this.slaConfig[priority],
      options: {
        retryOnFailure: true,
        maxRetries: 3,
        ...options
      }
    };

    this.queues[priority].push(queuedTask);
    this.stats.enqueued[priority]++;
    
    this.logger.info('Task enqueued', {
      taskId: task.id,
      priority,
      queuePosition: this.queues[priority].length,
      totalQueued: totalSize + 1
    });

    return queuedTask;
  }

  /**
   * Získá další úkol podle priority (high > medium > low)
   */
  dequeue() {
    // Prioritní pořadí
    for (const priority of ['high', 'medium', 'low']) {
      const queue = this.queues[priority];
      
      if (queue.length > 0) {
        // Získat nejstarší úkol z této priority
        const task = queue.shift();
        this.stats.dequeued[priority]++;
        this.stats.totalProcessed++;
        
        // Zkontrolovat SLA violation
        const waitTime = Date.now() - task.queuedAt;
        if (waitTime > task.sla.maxWaitTime) {
          this.stats.slaViolations[priority]++;
          this.logger.warn('SLA violation: wait time exceeded', {
            taskId: task.id,
            priority,
            waitTime: `${waitTime}ms`,
            maxWaitTime: `${task.sla.maxWaitTime}ms`
          });
        }
        
        this.logger.info('Task dequeued', {
          taskId: task.id,
          priority,
          waitTime: `${waitTime}ms`,
          remainingInQueue: queue.length
        });
        
        return task;
      }
    }
    
    return null; // Všechny fronty jsou prázdné
  }

  /**
   * Náhled na další úkol bez odebrání z fronty
   */
  peek() {
    for (const priority of ['high', 'medium', 'low']) {
      const queue = this.queues[priority];
      if (queue.length > 0) {
        return queue[0];
      }
    }
    return null;
  }

  /**
   * Získá úkol podle ID
   */
  getTask(taskId) {
    for (const priority of ['high', 'medium', 'low']) {
      const task = this.queues[priority].find(t => t.id === taskId);
      if (task) {
        return { task, priority };
      }
    }
    return null;
  }

  /**
   * Odebere úkol podle ID
   */
  removeTask(taskId) {
    for (const priority of ['high', 'medium', 'low']) {
      const queue = this.queues[priority];
      const index = queue.findIndex(t => t.id === taskId);
      
      if (index !== -1) {
        const removedTask = queue.splice(index, 1)[0];
        this.logger.info('Task removed from queue', {
          taskId,
          priority,
          position: index
        });
        return removedTask;
      }
    }
    return null;
  }

  /**
   * Změní prioritu existujícího úkolu
   */
  changePriority(taskId, newPriority) {
    if (!['high', 'medium', 'low'].includes(newPriority)) {
      throw new Error(`Invalid priority: ${newPriority}`);
    }

    const removed = this.removeTask(taskId);
    if (removed) {
      removed.priority = newPriority;
      removed.sla = this.slaConfig[newPriority];
      this.queues[newPriority].push(removed);
      
      this.logger.info('Task priority changed', {
        taskId,
        newPriority,
        queuePosition: this.queues[newPriority].length
      });
      
      return true;
    }
    return false;
  }

  /**
   * Získá seznam všech úkolů ve frontách
   */
  getAllTasks() {
    const allTasks = [];
    
    for (const [priority, queue] of Object.entries(this.queues)) {
      queue.forEach((task, index) => {
        allTasks.push({
          ...task,
          queuePosition: index + 1,
          waitTime: Date.now() - task.queuedAt,
          slaTimeRemaining: Math.max(0, task.sla.maxWaitTime - (Date.now() - task.queuedAt))
        });
      });
    }
    
    return allTasks.sort((a, b) => {
      // Seřadit podle priority a pak podle času
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.queuedAt - b.queuedAt;
    });
  }

  /**
   * Vyčistí expirované úkoly
   */
  cleanupExpiredTasks() {
    let removedCount = 0;
    const now = Date.now();
    
    for (const [priority, queue] of Object.entries(this.queues)) {
      const maxAge = this.slaConfig[priority].maxWaitTime * 2; // 2x SLA jako timeout
      
      for (let i = queue.length - 1; i >= 0; i--) {
        const task = queue[i];
        const age = now - task.queuedAt;
        
        if (age > maxAge) {
          queue.splice(i, 1);
          removedCount++;
          
          this.logger.warn('Task expired and removed from queue', {
            taskId: task.id,
            priority,
            age: `${age}ms`,
            maxAge: `${maxAge}ms`
          });
        }
      }
    }
    
    if (removedCount > 0) {
      this.logger.info('Queue cleanup completed', { removedTasks: removedCount });
    }
  }

  /**
   * Získá celkový počet úkolů ve všech frontách
   */
  getTotalSize() {
    return this.queues.high.length + this.queues.medium.length + this.queues.low.length;
  }

  /**
   * Získá velikosti jednotlivých front
   */
  getQueueSizes() {
    return {
      high: this.queues.high.length,
      medium: this.queues.medium.length,
      low: this.queues.low.length,
      total: this.getTotalSize()
    };
  }

  /**
   * Získá statistiky fronty
   */
  getStats() {
    const sizes = this.getQueueSizes();
    const avgWaitTimes = this.calculateAverageWaitTimes();
    
    return {
      sizes,
      stats: this.stats,
      avgWaitTimes,
      slaViolationRate: this.calculateSLAViolationRate(),
      throughput: this.calculateThroughput()
    };
  }

  /**
   * Vypočítá průměrné čekací časy
   */
  calculateAverageWaitTimes() {
    const now = Date.now();
    const waitTimes = { high: 0, medium: 0, low: 0 };
    
    for (const [priority, queue] of Object.entries(this.queues)) {
      if (queue.length > 0) {
        const totalWait = queue.reduce((sum, task) => sum + (now - task.queuedAt), 0);
        waitTimes[priority] = Math.round(totalWait / queue.length);
      }
    }
    
    return waitTimes;
  }

  /**
   * Vypočítá míru porušení SLA
   */
  calculateSLAViolationRate() {
    const rates = {};
    
    for (const priority of ['high', 'medium', 'low']) {
      const total = this.stats.dequeued[priority];
      const violations = this.stats.slaViolations[priority];
      rates[priority] = total > 0 ? Math.round((violations / total) * 100) : 0;
    }
    
    return rates;
  }

  /**
   * Vypočítá throughput (úkoly za minutu)
   */
  calculateThroughput() {
    // Zjednodušená implementace - v produkci by měla sledovat čas
    return {
      tasksPerMinute: this.stats.totalProcessed // Placeholder
    };
  }

  /**
   * Vymaže všechny fronty
   */
  clear() {
    const totalRemoved = this.getTotalSize();
    
    this.queues.high = [];
    this.queues.medium = [];
    this.queues.low = [];
    
    this.logger.info('All queues cleared', { removedTasks: totalRemoved });
    return totalRemoved;
  }

  /**
   * Ukončí priority queue a vyčistí intervaly
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
    this.logger.info('Priority queue destroyed');
  }

  /**
   * Serializuje stav fronty pro persistenci
   */
  serialize() {
    return {
      queues: this.queues,
      stats: this.stats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Obnoví stav fronty z serializovaných dat
   */
  deserialize(data) {
    if (data.queues) {
      this.queues = data.queues;
    }
    if (data.stats) {
      this.stats = data.stats;
    }
    
    this.logger.info('Priority queue state restored', {
      totalTasks: this.getTotalSize(),
      timestamp: data.timestamp
    });
  }
}

// Export singleton instance
let defaultPriorityQueue;

export function getPriorityQueue(options) {
  if (!defaultPriorityQueue) {
    defaultPriorityQueue = new PriorityQueue(options);
  }
  return defaultPriorityQueue;
}

export default getPriorityQueue();