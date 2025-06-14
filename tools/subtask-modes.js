/**
 * Specializované subtask módy inspirované Roo Code Boomerang Tasks
 * Každý mód má specifické chování a context requirements
 */

export class SubtaskModes {
  static MODES = {
    ORCHESTRATOR: {
      id: 'orchestrator',
      name: '🪃 Orchestrator',
      description: 'Řídí workflow a deleguje úkoly na jiné módy',
      capabilities: ['task_breakdown', 'workflow_management', 'delegation'],
      contextRequirements: ['project_overview', 'requirements'],
      outputFormat: 'workflow_plan'
    },
    
    CODE: {
      id: 'code', 
      name: '💻 Code',
      description: 'Implementuje kod, refaktoruje a opravuje chyby',
      capabilities: ['implementation', 'refactoring', 'bug_fixing', 'code_review'],
      contextRequirements: ['technical_specs', 'existing_codebase'],
      outputFormat: 'code_changes'
    },

    ARCHITECT: {
      id: 'architect',
      name: '🏗️ Architect', 
      description: 'Navrhuje architekturu, komponenty a systémové řešení',
      capabilities: ['system_design', 'architecture_planning', 'component_design'],
      contextRequirements: ['requirements', 'constraints', 'existing_architecture'],
      outputFormat: 'architecture_docs'
    },

    DEBUG: {
      id: 'debug',
      name: '🐛 Debug',
      description: 'Ladí chyby, analyzuje problémy a navrhuje opravy',
      capabilities: ['error_analysis', 'log_analysis', 'performance_debugging'],
      contextRequirements: ['error_reports', 'logs', 'reproduction_steps'],
      outputFormat: 'debug_report'
    },

    TEST: {
      id: 'test',
      name: '🧪 Test',
      description: 'Vytváří testy, zajišťuje kvalitu a pokrytí',
      capabilities: ['unit_testing', 'integration_testing', 'test_automation'],
      contextRequirements: ['code_to_test', 'test_requirements'],
      outputFormat: 'test_suite'
    },

    REVIEW: {
      id: 'review',
      name: '👁️ Review',
      description: 'Recenzuje kod, dokumentaci a návrhy',
      capabilities: ['code_review', 'security_review', 'performance_review'],
      contextRequirements: ['code_changes', 'review_criteria'],
      outputFormat: 'review_report'
    },

    DOCS: {
      id: 'docs',
      name: '📚 Docs',
      description: 'Vytváří a udržuje dokumentaci',
      capabilities: ['technical_writing', 'api_docs', 'user_guides'],
      contextRequirements: ['code_structure', 'user_requirements'],
      outputFormat: 'documentation'
    }
  };

  /**
   * Automaticky vybere nejlepší mód pro daný typ úkolu
   */
  static selectBestMode(taskDescription, taskType) {
    const desc = taskDescription.toLowerCase();
    const type = taskType?.toLowerCase() || '';

    // Klíčová slova pro každý mód
    const modeKeywords = {
      code: ['implement', 'code', 'function', 'method', 'class', 'refactor', 'fix bug'],
      architect: ['design', 'architecture', 'structure', 'component', 'system', 'plan'],
      debug: ['debug', 'error', 'bug', 'issue', 'problem', 'crash', 'fail'],
      test: ['test', 'testing', 'unit test', 'integration', 'coverage', 'qa'],
      review: ['review', 'check', 'validate', 'audit', 'inspect', 'analyze'],
      docs: ['document', 'documentation', 'readme', 'guide', 'manual', 'api docs']
    };

    // Skóre pro každý mód
    const scores = {};
    
    Object.entries(modeKeywords).forEach(([mode, keywords]) => {
      scores[mode] = keywords.filter(keyword => 
        desc.includes(keyword) || type.includes(keyword)
      ).length;
    });

    // Najdi mód s nejvyšším skóre
    const bestMode = Object.entries(scores).reduce((best, [mode, score]) => {
      return score > best.score ? { mode, score } : best;
    }, { mode: 'code', score: 0 });

    // Fallback logika podle typu úkolu
    if (bestMode.score === 0) {
      switch (type) {
        case 'design': return this.MODES.ARCHITECT;
        case 'implementation': return this.MODES.CODE;
        case 'testing': return this.MODES.TEST;
        case 'deployment': return this.MODES.CODE;
        case 'execution': return this.MODES.CODE;
        default: return this.MODES.CODE;
      }
    }

    return this.MODES[bestMode.mode.toUpperCase()];
  }

  /**
   * Získá mód podle ID
   */
  static getMode(modeId) {
    const mode = Object.values(this.MODES).find(m => m.id === modeId);
    if (!mode) {
      throw new Error(`Unknown mode: ${modeId}`);
    }
    return mode;
  }

  /**
   * Získá všechny dostupné módy
   */
  static getAllModes() {
    return Object.values(this.MODES);
  }

  /**
   * Validuje, zda mód má potřebný kontext
   */
  static validateModeContext(mode, availableContext) {
    const missing = mode.contextRequirements.filter(req => 
      !availableContext.hasOwnProperty(req) && 
      !availableContext.data?.hasOwnProperty(req)
    );

    return {
      valid: missing.length === 0,
      missingContext: missing
    };
  }

  /**
   * Generuje kontext specifický pro mód
   */
  static generateModeContext(mode, originalContext, additionalData = {}) {
    const modeContext = {
      ...originalContext,
      mode: {
        id: mode.id,
        name: mode.name,
        capabilities: mode.capabilities,
        outputFormat: mode.outputFormat
      },
      modeSpecificData: additionalData
    };

    // Přidej mode-specific instructions
    switch (mode.id) {
      case 'code':
        modeContext.instructions = [
          'Zaměř se na čistý, udržovatelný kod',
          'Dodržuj coding standards projektu',
          'Přidej komentáře k složitým částem',
          'Proveď základní error handling'
        ];
        break;

      case 'architect':
        modeContext.instructions = [
          'Navrhni škálovatelnou architekturu',
          'Zvaž bezpečnostní aspekty',
          'Dokumentuj architektonická rozhodnutí',
          'Vyber vhodné design patterny'
        ];
        break;

      case 'debug':
        modeContext.instructions = [
          'Systematicky analyzuj problém',
          'Identifikuj root cause',
          'Navrhni minimální reprodukční kroky',
          'Doporuč preventivní opatření'
        ];
        break;

      case 'test':
        modeContext.instructions = [
          'Vytvoř comprehensive test suite',
          'Pokryj edge cases',
          'Zaměř se na integration testy',
          'Automatizuj test execution'
        ];
        break;

      case 'review':
        modeContext.instructions = [
          'Kontroluj bezpečnostní vulnerabilities',
          'Ověř performance implications',
          'Zkontroluj code style a conventions',
          'Vyhodnoť maintainability'
        ];
        break;

      case 'docs':
        modeContext.instructions = [
          'Piš jasnou a stručnou dokumentaci',
          'Přidej praktické příklady',
          'Dokumentuj API a interfaces',
          'Udržuj dokumentaci aktuální'
        ];
        break;
    }

    return modeContext;
  }

  /**
   * Formatuje výstup podle módu
   */
  static formatModeOutput(mode, results) {
    const baseOutput = {
      mode: mode.name,
      timestamp: new Date().toISOString(),
      ...results
    };

    switch (mode.outputFormat) {
      case 'code_changes':
        return {
          ...baseOutput,
          filesModified: results.filesModified || [],
          codeChanges: results.codeChanges || [],
          testResults: results.testResults || null
        };

      case 'architecture_docs':
        return {
          ...baseOutput,
          architectureDecisions: results.architectureDecisions || [],
          componentDiagram: results.componentDiagram || null,
          techStack: results.techStack || []
        };

      case 'debug_report':
        return {
          ...baseOutput,
          rootCause: results.rootCause || 'Not identified',
          reproductionSteps: results.reproductionSteps || [],
          suggestedFix: results.suggestedFix || 'Under investigation'
        };

      case 'test_suite':
        return {
          ...baseOutput,
          testsCovered: results.testsCovered || [],
          coverage: results.coverage || 'Unknown',
          testResults: results.testResults || 'Not run'
        };

      case 'review_report':
        return {
          ...baseOutput,
          issuesFound: results.issuesFound || [],
          recommendations: results.recommendations || [],
          approvalStatus: results.approvalStatus || 'Pending review'
        };

      case 'documentation':
        return {
          ...baseOutput,
          documentsCreated: results.documentsCreated || [],
          apiDocumentation: results.apiDocumentation || null,
          userGuides: results.userGuides || []
        };

      default:
        return baseOutput;
    }
  }
}