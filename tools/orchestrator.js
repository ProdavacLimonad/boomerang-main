import { ContextIsolation } from '../utils/context-isolation.js';
import { getTaskCache } from '../utils/cache.js';
import { getLogger } from '../utils/logger.js';
import { SubtaskModes } from './subtask-modes.js';

export class Orchestrator {
  constructor(storage) {
    this.storage = storage;
    this.cache = getTaskCache();
    this.logger = getLogger();
  }

  async analyzeTask(description, projectContext = {}) {
    // Použít cache pro analýzu úkolů
    return this.cache.cacheTaskAnalysis(description, projectContext, async () => {
      this.logger.debug('Performing fresh task analysis', { 
        description: description.substring(0, 50) + '...' 
      });
      
      const analysis = this.breakDownTask(description, projectContext);
      
      const task = {
        id: this.storage.generateId(),
        type: 'parent',
        description,
        projectContext,
        analysis,
        subtasks: [],
        status: 'analyzed',
        createdAt: new Date().toISOString()
      };

      await this.storage.saveTask(task);
      return task;
    });
  }

  breakDownTask(description, projectContext) {
    const complexity = this.assessComplexity(description);
    
    // Pouze úkoly se skóre 1 jsou považovány za jednoduché
    if (complexity.score === 1) {
      return {
        complexity: complexity.score,
        shouldBreakDown: false,
        reason: "Task is simple enough to execute directly (complexity score: 1)",
        suggestedSubtasks: []
      };
    }
    
    // Pro všechny ostatní úkoly (score 2+) použít Boomerang
    const subtasks = this.suggestSubtasks(description, complexity);
    
    return {
      complexity: complexity.score,
      shouldBreakDown: true,
      reason: `🪃 Task complexity score: ${complexity.score}/10. Using Boomerang pattern for optimal execution.`,
      suggestedSubtasks: subtasks,
      estimatedTime: this.estimateTime(subtasks)
    };
  }

  assessComplexity(description) {
    let score = 1;
    const factors = [];

    if (description.length > 200) {
      score += 1;
      factors.push("Long description suggests complex requirements");
    }

    const keywords = ['implement', 'create', 'build', 'design', 'refactor', 'test', 'deploy'];
    const keywordCount = keywords.filter(k => description.toLowerCase().includes(k)).length;
    score += Math.min(keywordCount, 3);
    
    if (keywordCount > 1) {
      factors.push(`Multiple action types detected: ${keywordCount}`);
    }

    if (description.includes(' and ') || description.includes(',')) {
      score += 1;
      factors.push("Multiple requirements detected");
    }

    if (description.toLowerCase().includes('file') || description.toLowerCase().includes('component')) {
      score += 1;
      factors.push("File/component manipulation required");
    }

    return { score: Math.min(score, 10), factors };
  }

  suggestSubtasks(description, complexity) {
    const subtasks = [];
    const desc = description.toLowerCase();

    if (desc.includes('implement') || desc.includes('create')) {
      const architectMode = SubtaskModes.selectBestMode(
        "Analyze requirements and create implementation plan", 
        "design"
      );
      
      subtasks.push({
        title: "Design and Planning",
        description: "Analyze requirements and create implementation plan",
        type: "design",
        priority: "high",
        estimatedDuration: "15-30 minutes",
        suggestedMode: architectMode
      });

      const codeMode = SubtaskModes.selectBestMode(
        "Implement the main functionality",
        "implementation"
      );
      
      subtasks.push({
        title: "Core Implementation",
        description: "Implement the main functionality",
        type: "implementation",
        priority: "high",
        estimatedDuration: "30-60 minutes",
        suggestedMode: codeMode
      });
    }

    if (desc.includes('test')) {
      const testMode = SubtaskModes.selectBestMode(
        "Create and run tests for the implementation",
        "testing"
      );
      
      subtasks.push({
        title: "Testing",
        description: "Create and run tests for the implementation",
        type: "testing",
        priority: "medium",
        estimatedDuration: "15-30 minutes",
        suggestedMode: testMode
      });
    }

    if (desc.includes('deploy') || desc.includes('build')) {
      const deployMode = SubtaskModes.selectBestMode(
        "Build the project and handle deployment",
        "deployment"
      );
      
      subtasks.push({
        title: "Build and Deployment",
        description: "Build the project and handle deployment",
        type: "deployment",
        priority: "medium",
        estimatedDuration: "10-20 minutes",
        suggestedMode: deployMode
      });
    }

    if (subtasks.length === 0) {
      const executionMode = SubtaskModes.selectBestMode(
        description, // Použít originální popis
        "execution"
      );
      
      subtasks.push({
        title: "Task Execution",
        description: "Execute the main task requirements",
        type: "execution",
        priority: "high",
        estimatedDuration: "20-40 minutes",
        suggestedMode: executionMode
      });
    }

    return subtasks;
  }

  estimateTime(subtasks) {
    const totalMin = subtasks.reduce((sum, task) => {
      const match = task.estimatedDuration.match(/(\d+)-(\d+)/);
      if (match) {
        return sum + (parseInt(match[1]) + parseInt(match[2])) / 2;
      }
      return sum + 30; // default
    }, 0);

    return `${Math.round(totalMin)} minutes total`;
  }

  async getTaskProgress(taskId) {
    const task = await this.storage.loadTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    const subtaskProgresses = await Promise.all(
      (task.subtasks || []).map(async (subtaskId) => {
        const subtask = await this.storage.loadTask(subtaskId);
        return {
          id: subtaskId,
          title: subtask?.title || 'Unknown',
          status: subtask?.status || 'unknown',
          mode: subtask?.mode?.name || 'N/A',
          approvalStatus: subtask?.approvalStatus || 'N/A',
          progress: this.calculateSubtaskProgress(subtask)
        };
      })
    );
    
    const totalProgress = subtaskProgresses.length > 0 
      ? subtaskProgresses.reduce((sum, st) => sum + st.progress, 0) / subtaskProgresses.length
      : 0;
    
    return {
      emoji: '🪃',
      taskId,
      description: task.description,
      status: task.status,
      totalProgress: Math.round(totalProgress),
      subtasks: subtaskProgresses,
      createdAt: task.createdAt,
      completedSubtasks: subtaskProgresses.filter(st => st.progress === 100).length,
      totalSubtasks: subtaskProgresses.length
    };
  }

  calculateSubtaskProgress(subtask) {
    if (!subtask) return 0;
    switch (subtask.status) {
      case 'created': return 0;
      case 'approved': return 25;
      case 'executing': return 50;
      case 'completed': return 100;
      case 'failed': return 0;
      case 'rejected': return 0;
      default: return 0;
    }
  }
}