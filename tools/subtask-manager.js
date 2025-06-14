import { ContextIsolation } from '../utils/context-isolation.js';
import { TaskExecutor } from './task-executor.js';
import { getPriorityQueue } from '../utils/priority-queue.js';
import { getLogger } from '../utils/logger.js';
import { SubtaskModes } from './subtask-modes.js';
import { ApprovalSystem } from './approval-system.js';

export class SubtaskManager {
  constructor(storage) {
    this.storage = storage;
    this.executor = new TaskExecutor();
    this.priorityQueue = getPriorityQueue();
    this.logger = getLogger();
    this.processingTasks = new Set(); // Sledování zpracovávaných úkolů
    
    // Nové Boomerang systémy
    this.approvalSystem = new ApprovalSystem(storage);
    
    // Spustit worker pro zpracování fronty
    this.startQueueProcessor();
  }

  /**
   * Enhanced createSubtask s Roo Code Boomerang funkcionalitou
   */
  async createSubtask(parentTaskId, subtaskConfig, contextToPass = {}, options = {}) {
    const parentTask = await this.storage.loadTask(parentTaskId);
    if (!parentTask) {
      throw new Error(`Parent task ${parentTaskId} not found`);
    }

    // Automaticky vybrat nejlepší mód pro úkol
    const selectedMode = options.mode || SubtaskModes.selectBestMode(
      subtaskConfig.description, 
      subtaskConfig.type
    );

    // Vytvořit enhanced isolated context
    const isolatedContext = ContextIsolation.createIsolatedContext(
      { id: parentTaskId },
      subtaskConfig.description,
      contextToPass,
      selectedMode
    );

    // Vytvořit enhanced subtask
    const subtask = {
      id: this.storage.generateId(),
      type: 'subtask',
      parentId: parentTaskId,
      title: subtaskConfig.title,
      description: subtaskConfig.description,
      taskType: subtaskConfig.type,
      priority: subtaskConfig.priority,
      
      // Enhanced Boomerang features
      mode: selectedMode,
      context: isolatedContext,
      approvalStatus: 'pending',
      requiresApproval: options.requiresApproval !== false, // default true
      
      // Status tracking
      status: 'created',
      createdAt: new Date().toISOString(),
      results: null,
      
      // Enhanced metadata
      estimatedDuration: subtaskConfig.estimatedDuration || '20-40 minutes',
      complexity: options.complexity || 'medium',
      dependencies: options.dependencies || [],
      tags: options.tags || []
    };

    // Validace mode context
    const contextValidation = SubtaskModes.validateModeContext(selectedMode, contextToPass);
    if (!contextValidation.valid) {
      this.logger.warn('Mode context validation failed', {
        subtaskId: subtask.id,
        mode: selectedMode.id,
        missingContext: contextValidation.missingContext
      });
      
      // Přidat varování do context
      subtask.context.warnings = contextValidation.missingContext.map(missing => 
        `Missing context requirement: ${missing}`
      );
    }

    // Uložit subtask
    await this.storage.saveTask(subtask);
    await this.storage.saveContext(isolatedContext.id, isolatedContext);

    // Aktualizovat parent task
    parentTask.subtasks.push(subtask.id);
    await this.storage.saveTask(parentTask);

    // Log creation
    this.logger.info('Enhanced subtask created', {
      subtaskId: subtask.id,
      parentId: parentTaskId,
      mode: selectedMode.name,
      priority: subtask.priority,
      requiresApproval: subtask.requiresApproval
    });

    // Spustit approval process pokud je potřeba
    if (subtask.requiresApproval) {
      // Optimalizovaná pravidla pro auto-approval podle módu
      const autoApprovalRules = {
        maxImpact: options.maxImpact || 
          (subtask.mode.id === 'docs' ? 'high' : 'medium'),
        allowedModes: options.allowedModes || 
          ['code', 'test', 'docs', 'debug'], // Přidat debug
        maxEstimatedTime: options.maxEstimatedTime || 
          (subtask.mode.id === 'test' ? 120 : 60), // Více času pro testy
        requiresManualReview: options.requiresManualReview || 
          (subtask.mode.id === 'architect') // Architect vždy manual
      };

      await this.approvalSystem.autoApprove(subtask.id, autoApprovalRules);
    }

    return subtask;
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

  // ============ Enhanced Boomerang Methods ============

  /**
   * Získá dostupné módy pro subtask
   */
  getAvailableModes() {
    return SubtaskModes.getAllModes();
  }

  /**
   * Změní mód subtask
   */
  async changeSubtaskMode(subtaskId, newModeId) {
    const subtask = await this.storage.loadTask(subtaskId);
    if (!subtask) {
      throw new Error(`Subtask ${subtaskId} not found`);
    }

    if (subtask.status !== 'created' && subtask.status !== 'approved') {
      throw new Error(`Cannot change mode of ${subtask.status} subtask`);
    }

    const newMode = SubtaskModes.getMode(newModeId);
    const oldMode = subtask.mode;

    // Aktualizuj mód
    subtask.mode = newMode;
    
    // Regeneruj context pro nový mód
    subtask.context.mode = newMode;
    
    await this.storage.saveTask(subtask);
    await this.storage.saveContext(subtask.context.id, subtask.context);

    this.logger.info('Subtask mode changed', {
      subtaskId,
      oldMode: oldMode?.name || 'Unknown',
      newMode: newMode.name
    });

    return subtask;
  }

  /**
   * Přidá zprávu do conversation history subtask
   */
  async addConversationMessage(subtaskId, message, role = 'assistant') {
    const subtask = await this.storage.loadTask(subtaskId);
    if (!subtask || !subtask.context) {
      throw new Error(`Subtask or context ${subtaskId} not found`);
    }

    const context = await this.storage.loadContext(subtask.context.id);
    ContextIsolation.addToConversationHistory(context, message, role);
    
    await this.storage.saveContext(subtask.context.id, context);

    return context.conversationHistory[context.conversationHistory.length - 1];
  }

  /**
   * Získá conversation history subtask
   */
  async getConversationHistory(subtaskId) {
    const subtask = await this.storage.loadTask(subtaskId);
    if (!subtask || !subtask.context) {
      throw new Error(`Subtask or context ${subtaskId} not found`);
    }

    const context = await this.storage.loadContext(subtask.context.id);
    return context.conversationHistory || [];
  }

  /**
   * Získá navigation kontext pro subtask
   */
  async getNavigationContext(subtaskId) {
    const subtask = await this.storage.loadTask(subtaskId);
    if (!subtask || !subtask.context) {
      throw new Error(`Subtask or context ${subtaskId} not found`);
    }

    const context = await this.storage.loadContext(subtask.context.id);
    return ContextIsolation.getNavigationContext(context);
  }

  /**
   * Naviguje k parent/child/sibling subtask
   */
  async navigateToTask(fromSubtaskId, toTaskId) {
    const fromSubtask = await this.storage.loadTask(fromSubtaskId);
    const toTask = await this.storage.loadTask(toTaskId);

    if (!fromSubtask || !toTask) {
      throw new Error('Source or target subtask not found');
    }

    // Validace, že navigace je povolena
    const navContext = await this.getNavigationContext(fromSubtaskId);
    const allowedTaskIds = [
      navContext.parent?.id,
      ...navContext.children.map(c => c.id),
      ...navContext.siblings.map(s => s.id)
    ].filter(Boolean);

    if (!allowedTaskIds.includes(toTaskId)) {
      throw new Error('Navigation to target task is not allowed');
    }

    this.logger.info('Task navigation performed', {
      from: fromSubtaskId,
      to: toTaskId,
      navigationType: toTaskId === navContext.parent?.id ? 'parent' : 
                     navContext.children.some(c => c.id === toTaskId) ? 'child' : 'sibling'
    });

    return toTask;
  }

  /**
   * Manuální schválení subtask
   */
  async approveSubtask(subtaskId, approvedBy = 'manual', reason = '') {
    return await this.approvalSystem.processApproval(
      subtaskId, 
      'approved', 
      approvedBy, 
      reason
    );
  }

  /**
   * Zamítnutí subtask
   */
  async rejectSubtask(subtaskId, rejectedBy = 'manual', reason = '') {
    return await this.approvalSystem.processApproval(
      subtaskId, 
      'rejected', 
      rejectedBy, 
      reason
    );
  }

  /**
   * Získá čekající schválení
   */
  async getPendingApprovals() {
    return await this.approvalSystem.getPendingApprovals();
  }

  /**
   * Získá enhanced status s Boomerang informacemi
   */
  async getEnhancedSubtaskStatus(subtaskId) {
    const basicStatus = await this.getSubtaskStatus(subtaskId);
    if (!basicStatus) {
      return null;
    }

    const subtask = await this.storage.loadTask(subtaskId);
    const navigationContext = await this.getNavigationContext(subtaskId);
    const conversationHistory = await this.getConversationHistory(subtaskId);

    return {
      ...basicStatus,
      
      // Enhanced Boomerang data
      mode: subtask.mode,
      approvalStatus: subtask.approvalStatus,
      complexity: subtask.complexity,
      dependencies: subtask.dependencies,
      tags: subtask.tags,
      
      // Navigation
      navigation: navigationContext,
      
      // Conversation summary
      conversationSummary: {
        totalMessages: conversationHistory.length,
        lastMessage: conversationHistory[conversationHistory.length - 1]?.timestamp,
        modesUsed: [...new Set(conversationHistory.map(msg => msg.mode))]
      },
      
      // Context flow
      hasUpwardContext: subtask.context?.upwardContext !== null,
      hasDownwardContext: subtask.context?.downwardContext !== null
    };
  }

  /**
   * Bulk operace na subtasky
   */
  async bulkOperation(subtaskIds, operation, options = {}) {
    const results = [];

    for (const subtaskId of subtaskIds) {
      try {
        let result;
        
        switch (operation) {
          case 'approve':
            result = await this.approveSubtask(subtaskId, options.approvedBy, options.reason);
            break;
          case 'reject':
            result = await this.rejectSubtask(subtaskId, options.rejectedBy, options.reason);
            break;
          case 'changeMode':
            result = await this.changeSubtaskMode(subtaskId, options.newModeId);
            break;
          case 'changePriority':
            result = await this.changeTaskPriority(subtaskId, options.newPriority);
            break;
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }

        results.push({ subtaskId, success: true, result });
      } catch (error) {
        results.push({ subtaskId, success: false, error: error.message });
        this.logger.error('Bulk operation failed for subtask', {
          subtaskId,
          operation,
          error: error.message
        });
      }
    }

    return {
      total: subtaskIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }
}