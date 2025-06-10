import { spawn } from 'child_process';
import { promisify } from 'util';
import https from 'https';
import http from 'http';
import RetryManager from '../utils/retry.js';
import { getLogger } from '../utils/logger.js';

export class TaskExecutor {
  constructor() {
    this.activeProcesses = new Map();
    this.maxConcurrentTasks = parseInt(process.env.BOOMERANG_MAX_CONCURRENT_TASKS) || 5;
    this.logger = getLogger();
    this.retryManager = new RetryManager({
      maxRetries: 3,
      baseDelay: 1000,
      retryCondition: RetryManager.createRetryCondition()
    });
  }

  /**
   * Spustí úkol podle jeho typu
   * @param {Object} subtask - Podúkol k provedení
   * @param {string} executionMode - 'simulation' nebo 'real'
   */
  async executeTask(subtask, executionMode = 'real') {
    if (executionMode === 'simulation') {
      return this.simulateExecution(subtask);
    }

    // Kontrola limitu souběžných úkolů
    if (this.activeProcesses.size >= this.maxConcurrentTasks) {
      throw new Error(`Maximum concurrent tasks (${this.maxConcurrentTasks}) reached`);
    }

    const taskType = subtask.context?.passedData?.taskType || 'custom';
    
    try {
      this.activeProcesses.set(subtask.id, { startTime: Date.now() });
      
      switch (taskType) {
        case 'shell-command':
          return await this.executeShellCommand(subtask);
        case 'http-request':
          return await this.executeHTTPRequest(subtask);
        case 'mcp-call':
          return await this.executeMCPCall(subtask);
        case 'claude-code':
          return await this.executeClaudeCode(subtask);
        default:
          return await this.executeCustomTask(subtask);
      }
    } finally {
      this.activeProcesses.delete(subtask.id);
    }
  }

  /**
   * Spustí shell příkaz
   */
  async executeShellCommand(subtask) {
    const { command, args = [], options = {} } = subtask.context.passedData;
    
    if (!command) {
      throw new Error('Shell command not specified');
    }

    // Bezpečnostní kontrola - whitelist povolených příkazů
    const allowedCommands = ['ls', 'pwd', 'echo', 'node', 'npm', 'git'];
    const baseCommand = command.split(' ')[0];
    
    if (!allowedCommands.includes(baseCommand)) {
      throw new Error(`Command '${baseCommand}' is not in allowed list`);
    }

    return new Promise((resolve, reject) => {
      const timeout = parseInt(process.env.BOOMERANG_TASK_TIMEOUT) || 300000;
      
      const proc = spawn(command, args, {
        ...options,
        timeout,
        shell: true
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            output: stdout,
            executionTime: Date.now() - this.activeProcesses.get(subtask.id).startTime,
            taskType: 'shell-command',
            command: `${command} ${args.join(' ')}`
          });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (error) => {
        reject(new Error(`Command execution failed: ${error.message}`));
      });
    });
  }

  /**
   * Provede HTTP request s retry logikou
   */
  async executeHTTPRequest(subtask) {
    const { url, method = 'GET', headers = {}, body } = subtask.context.passedData;
    
    if (!url) {
      throw new Error('URL not specified for HTTP request');
    }

    return this.retryManager.executeWithRetry(
      () => this.performHTTPRequest(subtask, url, method, headers, body),
      { subtaskId: subtask.id, url, method }
    );
  }

  /**
   * Samotné provedení HTTP requestu
   */
  async performHTTPRequest(subtask, url, method, headers, body) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: {
          'User-Agent': 'Boomerang-MCP-Server/1.0',
          ...headers
        },
        timeout: 30000 // 30 sekund timeout
      };

      const req = client.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          const result = {
            success: res.statusCode >= 200 && res.statusCode < 300,
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
            executionTime: Date.now() - this.activeProcesses.get(subtask.id).startTime,
            taskType: 'http-request'
          };

          // Hodit chybu pro 5xx a 429 kódy (budou retry)
          if (res.statusCode >= 500 || res.statusCode === 429) {
            const error = new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`);
            error.statusCode = res.statusCode;
            error.response = result;
            reject(error);
          } else {
            resolve(result);
          }
        });
      });

      req.on('error', (error) => {
        // Přidat status code pro retry logiku
        error.statusCode = error.statusCode || 0;
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        const error = new Error('HTTP request timeout');
        error.code = 'ETIMEDOUT';
        reject(error);
      });

      if (body) {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
   * Volá jiný MCP server
   */
  async executeMCPCall(subtask) {
    const { serverName, toolName, arguments: toolArgs } = subtask.context.passedData;
    
    if (!serverName || !toolName) {
      throw new Error('MCP server name and tool name must be specified');
    }

    // Zde by byla implementace volání MCP serveru
    // Pro demonstraci vrátíme simulovaný výsledek
    return {
      success: true,
      result: {
        message: `Would call ${toolName} on ${serverName} with args: ${JSON.stringify(toolArgs)}`
      },
      executionTime: Date.now() - this.activeProcesses.get(subtask.id).startTime,
      taskType: 'mcp-call'
    };
  }

  /**
   * Spustí Claude Code
   */
  async executeClaudeCode(subtask) {
    const { prompt } = subtask.context.passedData;
    
    if (!prompt) {
      throw new Error('Prompt not specified for Claude Code execution');
    }

    // Spustí Claude Code v one-shot módu
    const command = 'claude';
    const args = ['code', '--dangerously-skip-permissions', prompt];
    
    return this.executeShellCommand({
      ...subtask,
      context: {
        passedData: {
          command,
          args,
          taskType: 'shell-command'
        }
      }
    });
  }

  /**
   * Vlastní implementace úkolu
   */
  async executeCustomTask(subtask) {
    // Zde můžete přidat vlastní logiku pro specifické typy úkolů
    return {
      success: true,
      message: 'Custom task executed',
      executionTime: Date.now() - this.activeProcesses.get(subtask.id).startTime,
      taskType: 'custom'
    };
  }

  /**
   * Simuluje provedení úkolu
   */
  simulateExecution(subtask) {
    const simulationTime = Math.random() * 2000 + 1000;
    
    return new Promise((resolve) => {
      setTimeout(() => {
        // Vrátit formát kompatibilní s původní implementací
        const result = {
          keyOutputs: [],
          filesModified: [],
          recommendations: [],
          executionTime: `${Math.round(simulationTime)}ms`,
          mode: 'simulation'
        };

        // Generovat výsledky podle typu úkolu
        switch (subtask.type || subtask.taskType) {
          case 'design':
            result.keyOutputs = ['Architecture plan', 'Component specifications', 'Implementation strategy'];
            result.filesModified = ['docs/design.md'];
            result.recommendations = ['Use modular architecture', 'Implement error handling'];
            break;
          
          case 'implementation':
            result.keyOutputs = ['Core functionality implemented', 'API endpoints created', 'Database models updated'];
            result.filesModified = ['src/main.js', 'src/models/user.js', 'src/routes/api.js'];
            result.recommendations = ['Add input validation', 'Implement caching'];
            break;
          
          case 'testing':
            result.keyOutputs = ['Unit tests created', 'Integration tests passed', 'Coverage report generated'];
            result.filesModified = ['tests/unit.test.js', 'tests/integration.test.js'];
            result.recommendations = ['Increase test coverage', 'Add performance tests'];
            break;
          
          case 'deployment':
            result.keyOutputs = ['Build completed', 'Deployment configured', 'CI/CD pipeline ready'];
            result.filesModified = ['.github/workflows/deploy.yml', 'Dockerfile'];
            result.recommendations = ['Monitor performance', 'Set up alerts'];
            break;
          
          default:
            result.keyOutputs = [
              `Simulated output for ${subtask.title}`,
              `Task type: ${subtask.type}`,
              `Context data received`
            ];
            result.filesModified = ['output.json'];
            result.recommendations = ['Review results', 'Plan next steps'];
        }

        resolve(result);
      }, simulationTime);
    });
  }

  /**
   * Získá informace o aktivních úkolech
   */
  getActiveTasksInfo() {
    return {
      count: this.activeProcesses.size,
      limit: this.maxConcurrentTasks,
      tasks: Array.from(this.activeProcesses.entries()).map(([id, info]) => ({
        id,
        runningTime: Date.now() - info.startTime
      }))
    };
  }
}