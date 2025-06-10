import { ContextIsolation } from '../utils/context-isolation.js';

export class ResultsMerger {
  constructor(storage) {
    this.storage = storage;
  }

  async mergeSubtaskResults(parentTaskId) {
    const parentTask = await this.storage.loadTask(parentTaskId);
    if (!parentTask) {
      throw new Error(`Parent task ${parentTaskId} not found`);
    }

    const subtaskResults = [];
    for (const subtaskId of parentTask.subtasks) {
      const subtask = await this.storage.loadTask(subtaskId);
      if (subtask && subtask.status === 'completed') {
        subtaskResults.push(subtask);
      }
    }

    const mergedResults = this.combineResults(subtaskResults);
    const finalSummary = this.generateFinalSummary(parentTask, subtaskResults, mergedResults);

    parentTask.status = 'completed';
    parentTask.completedAt = new Date().toISOString();
    parentTask.mergedResults = mergedResults;
    parentTask.finalSummary = finalSummary;

    await this.storage.saveTask(parentTask);

    return {
      parentTask,
      mergedResults,
      finalSummary,
      subtaskCount: subtaskResults.length
    };
  }

  combineResults(subtaskResults) {
    const combined = {
      allKeyOutputs: [],
      allFilesModified: [],
      allRecommendations: [],
      totalExecutionTime: 0,
      subtaskSummaries: []
    };

    for (const subtask of subtaskResults) {
      if (subtask.results) {
        combined.allKeyOutputs.push(...(subtask.results.keyOutputs || []));
        combined.allFilesModified.push(...(subtask.results.filesModified || []));
        combined.allRecommendations.push(...(subtask.results.recommendations || []));
        
        if (subtask.results.executionTime) {
          const timeMs = parseInt(subtask.results.executionTime.replace('ms', ''));
          combined.totalExecutionTime += timeMs;
        }
      }

      combined.subtaskSummaries.push({
        id: subtask.id,
        title: subtask.title,
        type: subtask.taskType,
        status: subtask.status,
        summary: subtask.summary
      });
    }

    combined.allFilesModified = [...new Set(combined.allFilesModified)];
    combined.totalExecutionTime = `${combined.totalExecutionTime}ms`;

    return combined;
  }

  generateFinalSummary(parentTask, subtaskResults, mergedResults) {
    const completedCount = subtaskResults.length;
    const totalCount = parentTask.subtasks.length;
    
    return {
      taskId: parentTask.id,
      originalDescription: parentTask.description,
      completionStatus: `${completedCount}/${totalCount} subtasks completed`,
      overallSuccess: completedCount === totalCount,
      keyAchievements: this.extractKeyAchievements(mergedResults),
      filesAffected: mergedResults.allFilesModified.length,
      recommendationsCount: mergedResults.allRecommendations.length,
      totalExecutionTime: mergedResults.totalExecutionTime,
      nextSteps: this.suggestNextSteps(parentTask, mergedResults),
      completedAt: new Date().toISOString()
    };
  }

  extractKeyAchievements(mergedResults) {
    const achievements = [];
    
    if (mergedResults.allKeyOutputs.length > 0) {
      achievements.push(`Generated ${mergedResults.allKeyOutputs.length} key outputs`);
    }
    
    if (mergedResults.allFilesModified.length > 0) {
      achievements.push(`Modified ${mergedResults.allFilesModified.length} files`);
    }
    
    const designOutputs = mergedResults.allKeyOutputs.filter(output => 
      output.toLowerCase().includes('design') || output.toLowerCase().includes('architecture')
    );
    if (designOutputs.length > 0) {
      achievements.push('Completed design and architecture phase');
    }
    
    const implementationOutputs = mergedResults.allKeyOutputs.filter(output =>
      output.toLowerCase().includes('implement') || output.toLowerCase().includes('functionality')
    );
    if (implementationOutputs.length > 0) {
      achievements.push('Completed core implementation');
    }
    
    const testingOutputs = mergedResults.allKeyOutputs.filter(output =>
      output.toLowerCase().includes('test') || output.toLowerCase().includes('coverage')
    );
    if (testingOutputs.length > 0) {
      achievements.push('Completed testing phase');
    }

    return achievements;
  }

  suggestNextSteps(parentTask, mergedResults) {
    const nextSteps = [];
    
    if (mergedResults.allRecommendations.length > 0) {
      nextSteps.push('Review and implement recommendations from subtasks');
    }
    
    if (mergedResults.allFilesModified.length > 0) {
      nextSteps.push('Verify all file modifications are correct');
      nextSteps.push('Run tests to ensure no regressions');
    }
    
    const hasImplementation = mergedResults.subtaskSummaries.some(s => s.type === 'implementation');
    const hasTesting = mergedResults.subtaskSummaries.some(s => s.type === 'testing');
    
    if (hasImplementation && !hasTesting) {
      nextSteps.push('Consider adding comprehensive tests');
    }
    
    nextSteps.push('Document the changes and update project documentation');
    nextSteps.push('Consider deployment or next iteration planning');

    return nextSteps;
  }

  async getTaskProgress(parentTaskId) {
    const parentTask = await this.storage.loadTask(parentTaskId);
    if (!parentTask) {
      return null;
    }

    const subtaskStatuses = [];
    for (const subtaskId of parentTask.subtasks) {
      const subtask = await this.storage.loadTask(subtaskId);
      if (subtask) {
        subtaskStatuses.push({
          id: subtask.id,
          title: subtask.title,
          status: subtask.status,
          type: subtask.taskType
        });
      }
    }

    const completedCount = subtaskStatuses.filter(s => s.status === 'completed').length;
    const progressPercentage = Math.round((completedCount / subtaskStatuses.length) * 100);

    return {
      parentTaskId,
      totalSubtasks: subtaskStatuses.length,
      completedSubtasks: completedCount,
      progressPercentage,
      subtasks: subtaskStatuses,
      overallStatus: parentTask.status
    };
  }
}