import { ContextIsolation } from '../utils/context-isolation.js';
import { TaskExecutor } from './task-executor.js';
import { getPriorityQueue } from '../utils/priority-queue.js';
import { getLogger } from '../utils/logger.js';

export class SubtaskManager {
  constructor(storage) {
    this.storage = storage;
    this.executor = new TaskExecutor();
    this.priorityQueue = getPriorityQueue();
    this.logger = getLogger();
    this.processingTasks = new Set(); // Sledování zpracovávaných úkolů
    
    // Spustit worker pro zpracování fronty
    this.startQueueProcessor();
  }

  async createSubtask(parentTaskId, subtaskConfig, contextToPass = {}) {
    const parentTask = await this.storage.loadTask(parentTaskId);
    if (!parentTask) {
      throw new Error(`Parent task ${parentTaskId} not found`);
    }

    const isolatedContext = ContextIsolation.createIsolatedContext(
      { id: parentTaskId },
      subtaskConfig.description,
      contextToPass
    );

    const subtask = {
      id: this.storage.generateId(),
      type: 'subtask',
      parentId: parentTaskId,
      title: subtaskConfig.title,
      description: subtaskConfig.description,
      taskType: subtaskConfig.type,
      priority: subtaskConfig.priority,
      context: isolatedContext,
      status: 'created',
      createdAt: new Date().toISOString(),
      results: null
    };

    await this.storage.saveTask(subtask);
    await this.storage.saveContext(isolatedContext.id, isolatedContext);

    parentTask.subtasks.push(subtask.id);
    await this.storage.saveTask(parentTask);

    return subtask;
  }

  async executeSubtask(subtaskId, executionMode = 'simulation') {
    const subtask = await this.storage.loadTask(subtaskId);
    if (!subtask) {
      throw new Error(`Subtask ${subtaskId} not found`);
    }

    subtask.status = 'executing';
    subtask.startedAt = new Date().toISOString();
    await this.storage.saveTask(subtask);

    // Použít TaskExecutor místo simulace
    const results = await this.executor.executeTask(subtask, executionMode);
    
    subtask.status = 'completed';
    subtask.completedAt = new Date().toISOString();
    subtask.results = results;
    
      const summary = ContextIsolation.generateSummary(subtask.context, results);
      subtask.summary = summary;

      await this.storage.saveTask(subtask);
      
      const context = await this.storage.loadContext(subtask.context.id);
      context.status = 'completed';
      context.results = results;
      context.summary = summary;
      await this.storage.saveContext(subtask.context.id, context);

      return subtask;
    } catch (error) {
      subtask.status = 'failed';
      subtask.error = error.message;
      subtask.completedAt = new Date().toISOString();
      await this.storage.saveTask(subtask);
      throw error;
    } finally {
      this.processingTasks.delete(subtask.id);
    }
  }

  /**
   * Přidá úkol do prioritní fronty místo okamžitého spuštění
   */
  async enqueueSubtask(subtaskId, priority = 'medium', executionMode = 'simulation') {
    const subtask = await this.storage.loadTask(subtaskId);
    if (!subtask) {
      throw new Error(`Subtask ${subtaskId} not found`);
    }

    // Přidat do prioritní fronty
    const queuedTask = this.priorityQueue.enqueue({
      id: subtaskId,
      type: 'subtask',
      executionMode
    }, priority);

    this.logger.info('Subtask enqueued for execution', {
      subtaskId,
      priority,
      queuePosition: this.priorityQueue.getQueueSizes()[priority]
    });

    return queuedTask;
  }

  /**
   * Původní metoda pro přímé spuštění (zachována pro kompatibilitu)
   */
  async executeSubtask(subtaskId, executionMode = 'simulation') {
    const subtask = await this.storage.loadTask(subtaskId);
    if (!subtask) {
      throw new Error(`Subtask ${subtaskId} not found`);
    }

    return this.processSubtask(subtask, executionMode);
  }

  /**
   * Samotné zpracování úkolu
   */
  async processSubtask(subtask, executionMode = 'simulation') {
    this.processingTasks.add(subtask.id);
    
    try {
      subtask.status = 'executing';
      subtask.startedAt = new Date().toISOString();
      await this.storage.saveTask(subtask);

      // Použít TaskExecutor místo simulace
      const results = await this.executor.executeTask(subtask, executionMode);
      
      subtask.status = 'completed';
      subtask.completedAt = new Date().toISOString();
      subtask.results = results;

      const summary = ContextIsolation.generateSummary(subtask.context, results);
      subtask.summary = summary;

      await this.storage.saveTask(subtask);
      
      const context = await this.storage.loadContext(subtask.context.id);
      context.status = 'completed';
      context.results = results;
      context.summary = summary;
      await this.storage.saveContext(subtask.context.id, context);

      return subtask;
    } catch (error) {
      subtask.status = 'failed';
      subtask.error = error.message;
      subtask.completedAt = new Date().toISOString();
      await this.storage.saveTask(subtask);
      throw error;
    } finally {
      this.processingTasks.delete(subtask.id);
    }
  }

  /**
   * Worker pro zpracování prioritní fronty
   */
  startQueueProcessor() {
    const maxConcurrent = parseInt(process.env.BOOMERANG_MAX_CONCURRENT_TASKS) || 5;
    
    setInterval(async () => {
      // Zpracovat úkoly dokud je místo
      while (this.processingTasks.size < maxConcurrent) {
        const queuedTask = this.priorityQueue.dequeue();
        
        if (!queuedTask) {
          break; // Fronta je prázdná
        }
        
        // Spustit zpracování asynchronně
        this.processQueuedTask(queuedTask).catch(error => {
          this.logger.error('Queue task processing failed', {
            taskId: queuedTask.id,
            error: error.message
          });
        });
      }
    }, 1000); // Kontrolovat každou sekundu
  }

  /**
   * Zpracuje úkol z fronty
   */
  async processQueuedTask(queuedTask) {
    try {
      const subtask = await this.storage.loadTask(queuedTask.id);
      if (!subtask) {
        this.logger.warn('Queued subtask not found', { taskId: queuedTask.id });
        return;
      }

      // Zkontrolovat SLA
      const waitTime = Date.now() - queuedTask.queuedAt;
      if (waitTime > queuedTask.sla.maxWaitTime) {
        this.logger.warn('SLA violation detected', {
          taskId: queuedTask.id,
          waitTime: `${waitTime}ms`,
          maxWaitTime: `${queuedTask.sla.maxWaitTime}ms`
        });
      }

      await this.processSubtask(subtask, queuedTask.executionMode);
      
    } catch (error) {
      this.logger.error('Failed to process queued task', {
        taskId: queuedTask.id,
        error: error.message
      });

      // Retry pokud je to nakonfigurováno
      if (queuedTask.options.retryOnFailure && queuedTask.retryCount < queuedTask.options.maxRetries) {
        queuedTask.retryCount = (queuedTask.retryCount || 0) + 1;
        queuedTask.queuedAt = Date.now(); // Reset času pro SLA
        
        this.priorityQueue.enqueue(queuedTask, queuedTask.priority);
        
        this.logger.info('Task requeued for retry', {
          taskId: queuedTask.id,
          retryCount: queuedTask.retryCount,
          maxRetries: queuedTask.options.maxRetries
        });
      }
    }
  }

  /**
   * Získá informace o frontě úkolů
   */
  getQueueInfo() {
    return {
      sizes: this.priorityQueue.getQueueSizes(),
      stats: this.priorityQueue.getStats(),
      processingCount: this.processingTasks.size,
      allTasks: this.priorityQueue.getAllTasks()
    };
  }

  /**
   * Změní prioritu úkolu ve frontě
   */
  changeTaskPriority(taskId, newPriority) {
    return this.priorityQueue.changePriority(taskId, newPriority);
  }

  /**
   * Odebere úkol z fronty
   */
  cancelQueuedTask(taskId) {
    return this.priorityQueue.removeTask(taskId);
  }

  /**
   * Vymaže prioritní frontu
   */
  clearQueue() {
    return this.priorityQueue.clear();
  }

  async simulateExecution(subtask, mode) {
    const mockDelay = Math.random() * 2000 + 1000;
    await new Promise(resolve => setTimeout(resolve, mockDelay));

    switch (subtask.taskType) {
      case 'design':
        return {
          keyOutputs: ['Architecture plan', 'Component specifications', 'Implementation strategy'],
          filesModified: ['docs/design.md'],
          recommendations: ['Use modular architecture', 'Implement error handling'],
          executionTime: `${Math.round(mockDelay)}ms`,
          mode
        };
      
      case 'implementation':
        return {
          keyOutputs: ['Core functionality implemented', 'API endpoints created', 'Database models updated'],
          filesModified: ['src/main.js', 'src/models/user.js', 'src/routes/api.js'],
          recommendations: ['Add input validation', 'Implement caching'],
          executionTime: `${Math.round(mockDelay)}ms`,
          mode
        };
      
      case 'testing':
        return {
          keyOutputs: ['Unit tests created', 'Integration tests passed', 'Coverage report generated'],
          filesModified: ['tests/unit.test.js', 'tests/integration.test.js'],
          recommendations: ['Increase test coverage to 90%', 'Add edge case tests'],
          executionTime: `${Math.round(mockDelay)}ms`,
          mode
        };
      
      default:
        return {
          keyOutputs: ['Task completed successfully'],
          filesModified: [],
          recommendations: ['Monitor performance', 'Document changes'],
          executionTime: `${Math.round(mockDelay)}ms`,
          mode
        };
    }
  }

  async getSubtaskStatus(subtaskId) {
    const subtask = await this.storage.loadTask(subtaskId);
    if (!subtask) {
      return null;
    }

    return {
      id: subtask.id,
      title: subtask.title,
      status: subtask.status,
      progress: this.calculateProgress(subtask),
      createdAt: subtask.createdAt,
      startedAt: subtask.startedAt,
      completedAt: subtask.completedAt,
      summary: subtask.summary
    };
  }

  calculateProgress(subtask) {
    switch (subtask.status) {
      case 'created': return 0;
      case 'executing': return 50;
      case 'completed': return 100;
      default: return 0;
    }
  }
}