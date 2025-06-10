export class ContextIsolation {
  static createIsolatedContext(parentContext, subtaskDescription, passedData = {}) {
    return {
      id: Math.random().toString(36).substring(2, 15),
      parentId: parentContext?.id || null,
      subtaskDescription,
      passedData,
      createdAt: new Date().toISOString(),
      status: 'pending',
      results: null,
      summary: null
    };
  }

  static sanitizeContext(context) {
    const sanitized = {
      description: context.subtaskDescription,
      data: context.passedData,
      requirements: context.requirements || [],
      constraints: context.constraints || []
    };
    
    return sanitized;
  }

  static mergeResults(parentContext, subtaskResults) {
    if (!parentContext.subtaskResults) {
      parentContext.subtaskResults = [];
    }
    
    parentContext.subtaskResults.push({
      subtaskId: subtaskResults.id,
      summary: subtaskResults.summary,
      results: subtaskResults.results,
      completedAt: new Date().toISOString()
    });
    
    return parentContext;
  }

  static generateSummary(context, results) {
    return {
      taskId: context.id,
      description: context.subtaskDescription,
      status: 'completed',
      keyOutputs: results.keyOutputs || [],
      filesModified: results.filesModified || [],
      recommendations: results.recommendations || [],
      completedAt: new Date().toISOString()
    };
  }
}