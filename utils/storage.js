import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class Storage {
  constructor(basePath = './storage') {
    this.basePath = basePath;
    this.tasksPath = path.join(basePath, 'tasks');
    this.contextsPath = path.join(basePath, 'contexts');
    this.approvalsPath = path.join(basePath, 'approvals'); // Nové
    this.metadataPath = path.join(basePath, 'metadata.json');
    this.initPromise = this.ensureDirectories();
  }

  async ensureDirectories() {
    const dirs = [
      this.basePath,
      this.tasksPath,
      this.contextsPath,
      this.approvalsPath // Nové
    ];
    
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.error(`Error creating directory ${dir}:`, error.message);
      }
    }
  }

  async saveTask(task) {
    await this.initPromise; // Počkat na vytvoření adresářů
    const taskId = task.id || this.generateId();
    const taskPath = path.join(this.tasksPath, `${taskId}.json`);
    await fs.writeFile(taskPath, JSON.stringify({ ...task, id: taskId }, null, 2));
    return taskId;
  }

  async loadTask(taskId) {
    const taskPath = path.join(this.tasksPath, `${taskId}.json`);
    try {
      const data = await fs.readFile(taskPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  async saveContext(contextId, context) {
    await this.initPromise; // Počkat na vytvoření adresářů
    const contextPath = path.join(this.contextsPath, `${contextId}.json`);
    await fs.writeFile(contextPath, JSON.stringify(context, null, 2));
  }

  async loadContext(contextId) {
    const contextPath = path.join(this.contextsPath, `${contextId}.json`);
    try {
      const data = await fs.readFile(contextPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  async saveMetadata(metadata) {
    await fs.writeFile(this.metadataPath, JSON.stringify(metadata, null, 2));
  }

  async loadMetadata() {
    try {
      const data = await fs.readFile(this.metadataPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return { tasks: {}, relationships: {} };
    }
  }

  // ============ Enhanced Boomerang Storage Methods ============

  /**
   * Approval system methods
   */
  async saveApprovalRequest(approval) {
    await this.initPromise;
    const approvalPath = path.join(this.approvalsPath, `${approval.id}.json`);
    await fs.writeFile(approvalPath, JSON.stringify(approval, null, 2));
    return approval.id;
  }

  async loadApprovalRequest(approvalId) {
    const approvalPath = path.join(this.approvalsPath, `${approvalId}.json`);
    try {
      const data = await fs.readFile(approvalPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  async deleteApprovalRequest(approvalId) {
    const approvalPath = path.join(this.approvalsPath, `${approvalId}.json`);
    try {
      await fs.unlink(approvalPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  async loadApprovalHistory(subtaskId) {
    try {
      const files = await fs.readdir(this.approvalsPath);
      const approvals = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const approvalData = await this.loadApprovalRequest(file.replace('.json', ''));
          if (approvalData && approvalData.subtaskId === subtaskId) {
            approvals.push(approvalData);
          }
        }
      }

      return approvals.sort((a, b) => new Date(a.requestedAt) - new Date(b.requestedAt));
    } catch (error) {
      return [];
    }
  }

  /**
   * Enhanced task queries
   */
  async getAllTasks(filter = {}) {
    try {
      const files = await fs.readdir(this.tasksPath);
      const tasks = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const task = await this.loadTask(file.replace('.json', ''));
          if (task && this.matchesFilter(task, filter)) {
            tasks.push(task);
          }
        }
      }

      return tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
      return [];
    }
  }

  async getSubtasksByParent(parentId) {
    const allTasks = await this.getAllTasks({ parentId, type: 'subtask' });
    return allTasks;
  }

  async getTasksByMode(modeId) {
    const allTasks = await this.getAllTasks({ type: 'subtask' });
    return allTasks.filter(task => task.mode?.id === modeId);
  }

  async getTasksByStatus(status) {
    return await this.getAllTasks({ status });
  }

  /**
   * Navigation support
   */
  async getParentTask(subtaskId) {
    const subtask = await this.loadTask(subtaskId);
    if (!subtask || !subtask.parentId) {
      return null;
    }
    return await this.loadTask(subtask.parentId);
  }

  async getChildTasks(parentId) {
    return await this.getSubtasksByParent(parentId);
  }

  async getSiblingTasks(subtaskId) {
    const subtask = await this.loadTask(subtaskId);
    if (!subtask || !subtask.parentId) {
      return [];
    }

    const siblings = await this.getSubtasksByParent(subtask.parentId);
    return siblings.filter(sibling => sibling.id !== subtaskId);
  }

  /**
   * Conversation history support
   */
  async saveConversationMessage(contextId, message) {
    const context = await this.loadContext(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} not found`);
    }

    if (!context.conversationHistory) {
      context.conversationHistory = [];
    }

    context.conversationHistory.push(message);
    await this.saveContext(contextId, context);
    return message;
  }

  /**
   * Bulk operations
   */
  async bulkUpdateTasks(taskIds, updates) {
    const results = [];

    for (const taskId of taskIds) {
      try {
        const task = await this.loadTask(taskId);
        if (task) {
          Object.assign(task, updates);
          await this.saveTask(task);
          results.push({ taskId, success: true });
        } else {
          results.push({ taskId, success: false, error: 'Task not found' });
        }
      } catch (error) {
        results.push({ taskId, success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Cleanup methods
   */
  async cleanupOldTasks(maxAgeDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    const allTasks = await this.getAllTasks();
    let cleaned = 0;

    for (const task of allTasks) {
      if (new Date(task.createdAt) < cutoffDate && task.status === 'completed') {
        try {
          await fs.unlink(path.join(this.tasksPath, `${task.id}.json`));
          
          // Také vyčisti context pokud existuje
          if (task.context?.id) {
            try {
              await fs.unlink(path.join(this.contextsPath, `${task.context.id}.json`));
            } catch (error) {
              // Context už neexistuje, ignoruj
            }
          }
          
          cleaned++;
        } catch (error) {
          console.error(`Failed to cleanup task ${task.id}:`, error.message);
        }
      }
    }

    return cleaned;
  }

  async cleanupOldContexts(maxAgeDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    try {
      const files = await fs.readdir(this.contextsPath);
      let cleaned = 0;

      for (const file of files) {
        if (file.endsWith('.json')) {
          const contextPath = path.join(this.contextsPath, file);
          const stats = await fs.stat(contextPath);
          
          if (stats.mtime < cutoffDate) {
            try {
              await fs.unlink(contextPath);
              cleaned++;
            } catch (error) {
              console.error(`Failed to cleanup context ${file}:`, error.message);
            }
          }
        }
      }

      return cleaned;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Helper methods
   */
  matchesFilter(task, filter) {
    for (const [key, value] of Object.entries(filter)) {
      if (task[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Statistics and reporting
   */
  async getStorageStats() {
    const stats = {
      tasks: 0,
      contexts: 0,
      approvals: 0,
      totalSize: 0
    };

    try {
      // Count tasks
      const taskFiles = await fs.readdir(this.tasksPath);
      stats.tasks = taskFiles.filter(f => f.endsWith('.json')).length;

      // Count contexts
      const contextFiles = await fs.readdir(this.contextsPath);
      stats.contexts = contextFiles.filter(f => f.endsWith('.json')).length;

      // Count approvals
      const approvalFiles = await fs.readdir(this.approvalsPath);
      stats.approvals = approvalFiles.filter(f => f.endsWith('.json')).length;

      // Calculate total size (approximate)
      const calculateDirSize = async (dirPath) => {
        const files = await fs.readdir(dirPath);
        let size = 0;
        for (const file of files) {
          try {
            const filePath = path.join(dirPath, file);
            const fileStat = await fs.stat(filePath);
            size += fileStat.size;
          } catch (error) {
            // Ignore files that can't be accessed
          }
        }
        return size;
      };

      stats.totalSize = 
        (await calculateDirSize(this.tasksPath)) +
        (await calculateDirSize(this.contextsPath)) +
        (await calculateDirSize(this.approvalsPath));

    } catch (error) {
      console.error('Error calculating storage stats:', error.message);
    }

    return stats;
  }

  generateId() {
    // Bezpečné generování ID pomocí crypto
    const timestamp = Date.now().toString(36);
    const randomPart = crypto.randomBytes(6).toString('hex');
    return `${timestamp}-${randomPart}`;
  }
}