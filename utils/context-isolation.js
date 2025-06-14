/**
 * Enhanced Context Isolation s Roo Code Boomerang principy
 * - Upward/Downward context flow
 * - Conversation history per subtask
 * - Navigation mezi parent/child taskami
 */
import { getLogger } from './logger.js';

export class ContextIsolation {
  static logger = getLogger();

  /**
   * Vytvoří izolovaný kontext s enhanced funkcionalitou
   */
  static createIsolatedContext(parentContext, subtaskDescription, passedData = {}, mode = null) {
    const contextId = Math.random().toString(36).substring(2, 15);
    
    return {
      id: contextId,
      parentId: parentContext?.id || null,
      subtaskDescription,
      
      // Enhanced context data
      passedData: this.sanitizePassedData(passedData),
      mode: mode,
      
      // Context flow
      downwardContext: this.createDownwardContext(parentContext, passedData),
      upwardContext: null, // bude naplněn při completion
      
      // Conversation history
      conversationHistory: [],
      
      // Navigation
      childContexts: [],
      
      // Metadata
      createdAt: new Date().toISOString(),
      status: 'pending',
      results: null,
      summary: null,
      
      // Performance tracking
      startedAt: null,
      completedAt: null,
      executionTime: null
    };
  }

  /**
   * Vytvoří downward context (data předávaná z parent do child)
   */
  static createDownwardContext(parentContext, passedData) {
    if (!parentContext) {
      return {
        isRoot: true,
        projectContext: passedData.projectContext || {},
        globalRequirements: passedData.requirements || [],
        globalConstraints: passedData.constraints || []
      };
    }

    return {
      isRoot: false,
      parentTaskId: parentContext.id,
      parentDescription: parentContext.subtaskDescription,
      
      // Explicitně předávaná data
      explicitData: passedData,
      
      // Zděděná data z parent contextu
      inheritedProjectContext: parentContext.downwardContext?.projectContext || {},
      inheritedRequirements: parentContext.downwardContext?.globalRequirements || [],
      inheritedConstraints: parentContext.downwardContext?.globalConstraints || [],
      
      // Relevantní results z parent siblings
      siblingResults: this.extractSiblingResults(parentContext),
      
      // Context chain pro debugging
      contextChain: this.buildContextChain(parentContext)
    };
  }

  /**
   * Vytvoří upward context (data předávaná z child do parent)
   */
  static createUpwardContext(childContext, results) {
    return {
      childTaskId: childContext.id,
      childDescription: childContext.subtaskDescription,
      childMode: childContext.mode,
      
      // Výsledky pro parent
      summary: this.generateExecutiveSummary(childContext, results),
      keyOutputs: results.keyOutputs || [],
      deliverables: results.deliverables || [],
      
      // Doporučení pro další kroky
      recommendations: results.recommendations || [],
      nextSteps: results.nextSteps || [],
      
      // Dependencies a integrace
      createdDependencies: results.dependencies || [],
      integrationPoints: results.integrationPoints || [],
      
      // Lessons learned
      lessonsLearned: results.lessonsLearned || [],
      improvementSuggestions: results.improvements || [],
      
      completedAt: new Date().toISOString()
    };
  }

  /**
   * Přidá zprávu do conversation history
   */
  static addToConversationHistory(context, message, role = 'assistant') {
    if (!context.conversationHistory) {
      context.conversationHistory = [];
    }

    context.conversationHistory.push({
      id: Math.random().toString(36).substring(2, 15),
      role,
      content: message,
      timestamp: new Date().toISOString(),
      mode: context.mode?.id || 'unknown'
    });

    // Omezit velikost historie (posledních 50 zpráv)
    if (context.conversationHistory.length > 50) {
      context.conversationHistory = context.conversationHistory.slice(-50);
    }

    this.logger.debug('Added message to conversation history', {
      contextId: context.id,
      role,
      messageLength: message.length,
      totalMessages: context.conversationHistory.length
    });
  }

  /**
   * Získá kontext pro navigaci mezi taskami
   */
  static getNavigationContext(context) {
    return {
      current: {
        id: context.id,
        description: context.subtaskDescription,
        mode: context.mode?.name || 'Unknown',
        status: context.status
      },
      parent: context.parentId ? {
        id: context.parentId,
        canNavigate: true
      } : null,
      children: context.childContexts.map(childId => ({
        id: childId,
        canNavigate: true
      })),
      siblings: this.getSiblingContexts(context),
      breadcrumb: this.buildBreadcrumb(context)
    };
  }

  /**
   * Sanitizuje předávaná data
   */
  static sanitizePassedData(passedData) {
    // Odstraň citlivé informace
    const sensitiveKeys = ['password', 'apiKey', 'secret', 'token', 'credentials'];
    const sanitized = { ...passedData };

    const sanitizeObject = (obj) => {
      for (const key in obj) {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    };

    sanitizeObject(sanitized);
    return sanitized;
  }

  /**
   * Extrahuje relevantní výsledky ze sibling tasků
   */
  static extractSiblingResults(parentContext) {
    if (!parentContext || !parentContext.childContexts) {
      return [];
    }

    return parentContext.childContexts
      .filter(childId => childId !== parentContext.id)
      .map(childId => ({
        siblingId: childId,
        // V reálné implementaci by se načetly výsledky z storage
        summary: 'Sibling task results would be loaded here',
        status: 'completed' // nebo jiný status
      }));
  }

  /**
   * Sestaví context chain pro debugging
   */
  static buildContextChain(context) {
    const chain = [];
    let current = context;
    
    while (current && chain.length < 10) { // Prevence nekonečné smyčky
      chain.unshift({
        id: current.id,
        description: current.subtaskDescription?.substring(0, 50) + '...',
        mode: current.mode?.id || 'unknown'
      });
      
      // V reálné implementaci by se načetl parent z storage
      current = null; // Zatím ukončíme
    }
    
    return chain;
  }

  /**
   * Generuje executive summary pro upward context
   */
  static generateExecutiveSummary(context, results) {
    return {
      taskId: context.id,
      description: context.subtaskDescription,
      mode: context.mode?.name || 'Unknown',
      status: 'completed',
      
      // Klíčové metriky
      executionTime: context.executionTime,
      complexity: results.complexity || 'medium',
      
      // Hlavní výstupy
      primaryOutputs: results.keyOutputs?.slice(0, 3) || [],
      
      // Dopad
      impact: results.impact || 'medium',
      quality: results.quality || 'good',
      
      // Krátký text summary
      textSummary: this.generateTextSummary(context, results),
      
      completedAt: new Date().toISOString()
    };
  }

  /**
   * Generuje textový souhrn
   */
  static generateTextSummary(context, results) {
    const mode = context.mode?.name || 'Task';
    const outputs = results.keyOutputs?.length || 0;
    const files = results.filesModified?.length || 0;
    
    return `${mode} úspěšně dokončen. ` +
           `Vytvořeno ${outputs} výstupů${files > 0 ? `, upraveno ${files} souborů` : ''}. ` +
           `${results.recommendations?.length || 0} doporučení pro další kroky.`;
  }

  /**
   * Získá sibling kontexty
   */
  static getSiblingContexts(context) {
    if (!context.parentId) {
      return [];
    }
    
    // V reálné implementaci by se načetly ze storage
    return [];
  }

  /**
   * Sestaví breadcrumb navigaci
   */
  static buildBreadcrumb(context) {
    const breadcrumb = [];
    
    // V reálné implementaci by se prošel celý chain
    breadcrumb.push({
      id: context.id,
      description: context.subtaskDescription?.substring(0, 30) + '...',
      isCurrent: true
    });
    
    return breadcrumb;
  }

  // Zachované původní metody pro kompatibilitu
  static sanitizeContext(context) {
    return {
      description: context.subtaskDescription,
      data: context.passedData,
      mode: context.mode,
      downwardContext: context.downwardContext,
      requirements: context.downwardContext?.globalRequirements || [],
      constraints: context.downwardContext?.globalConstraints || []
    };
  }

  static mergeResults(parentContext, subtaskResults) {
    if (!parentContext.subtaskResults) {
      parentContext.subtaskResults = [];
    }
    
    // Enhanced merge s upward context
    const upwardContext = this.createUpwardContext(subtaskResults.context || {}, subtaskResults.results || {});
    
    parentContext.subtaskResults.push({
      subtaskId: subtaskResults.id,
      summary: subtaskResults.summary,
      results: subtaskResults.results,
      upwardContext: upwardContext,
      completedAt: new Date().toISOString()
    });
    
    // Přidat child context ID
    if (!parentContext.childContexts) {
      parentContext.childContexts = [];
    }
    if (!parentContext.childContexts.includes(subtaskResults.id)) {
      parentContext.childContexts.push(subtaskResults.id);
    }
    
    return parentContext;
  }

  static generateSummary(context, results) {
    return {
      taskId: context.id,
      description: context.subtaskDescription,
      mode: context.mode?.name || 'Unknown',
      status: 'completed',
      keyOutputs: results.keyOutputs || [],
      filesModified: results.filesModified || [],
      recommendations: results.recommendations || [],
      
      // Enhanced summary data
      upwardContext: this.createUpwardContext(context, results),
      conversationSummary: this.summarizeConversation(context),
      navigationContext: this.getNavigationContext(context),
      
      completedAt: new Date().toISOString()
    };
  }

  /**
   * Sumarizuje conversation history
   */
  static summarizeConversation(context) {
    if (!context.conversationHistory || context.conversationHistory.length === 0) {
      return { totalMessages: 0, summary: 'No conversation recorded' };
    }

    const totalMessages = context.conversationHistory.length;
    const modes = [...new Set(context.conversationHistory.map(msg => msg.mode))];
    const firstMessage = context.conversationHistory[0];
    const lastMessage = context.conversationHistory[context.conversationHistory.length - 1];

    return {
      totalMessages,
      modesUsed: modes,
      duration: new Date(lastMessage.timestamp) - new Date(firstMessage.timestamp),
      summary: `${totalMessages} zpráv napříč ${modes.length} módy`
    };
  }
}