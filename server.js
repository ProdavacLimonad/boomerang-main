#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { Storage } from './utils/storage.js';
import { Orchestrator } from './tools/orchestrator.js';
import { SubtaskManager } from './tools/subtask-manager.js';
import { ResultsMerger } from './tools/results-merger.js';
import { getLogger } from './utils/logger.js';
import validator from './utils/validator.js';
import { getWebhookManager } from './utils/webhooks.js';

class BoomerangMCPServer {
  constructor() {
    this.logger = getLogger();
    this.logger.info('Initializing Boomerang MCP Server');
    
    this.server = new Server(
      {
        name: 'boomerang-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.storage = new Storage('./storage');
    this.orchestrator = new Orchestrator(this.storage);
    this.subtaskManager = new SubtaskManager(this.storage);
    this.resultsMerger = new ResultsMerger(this.storage);
    this.webhookManager = getWebhookManager();

    this.setupToolHandlers();
    this.setupRequestHandlers();
    
    this.logger.info('Server initialized successfully');
  }

  setupRequestHandlers() {
    // Health check endpoint pro ověření funkčnosti
    this.server.setRequestHandler('ping', async () => ({
      status: 'ok',
      name: 'boomerang-mcp-server',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'boomerang_analyze_task',
          description: 'Analyze a complex task and suggest breaking it into subtasks',
          inputSchema: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'Description of the task to analyze',
              },
              projectContext: {
                type: 'object',
                description: 'Optional project context and constraints',
                default: {},
              },
            },
            required: ['description'],
          },
        },
        {
          name: 'boomerang_create_subtask',
          description: 'Create a new subtask from the analysis',
          inputSchema: {
            type: 'object',
            properties: {
              parentTaskId: {
                type: 'string',
                description: 'ID of the parent task',
              },
              subtaskConfig: {
                type: 'object',
                description: 'Configuration for the subtask',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  type: { type: 'string' },
                  priority: { type: 'string' },
                },
                required: ['title', 'description', 'type'],
              },
              contextToPass: {
                type: 'object',
                description: 'Context data to pass to the subtask',
                default: {},
              },
            },
            required: ['parentTaskId', 'subtaskConfig'],
          },
        },
        {
          name: 'boomerang_execute_subtask',
          description: 'Execute a subtask in isolation',
          inputSchema: {
            type: 'object',
            properties: {
              subtaskId: {
                type: 'string',
                description: 'ID of the subtask to execute',
              },
              executionMode: {
                type: 'string',
                description: 'Execution mode: simulation or real',
                default: 'simulation',
              },
            },
            required: ['subtaskId'],
          },
        },
        {
          name: 'boomerang_get_subtask_status',
          description: 'Get the current status of a subtask',
          inputSchema: {
            type: 'object',
            properties: {
              subtaskId: {
                type: 'string',
                description: 'ID of the subtask',
              },
            },
            required: ['subtaskId'],
          },
        },
        {
          name: 'boomerang_merge_results',
          description: 'Merge results from completed subtasks',
          inputSchema: {
            type: 'object',
            properties: {
              parentTaskId: {
                type: 'string',
                description: 'ID of the parent task',
              },
            },
            required: ['parentTaskId'],
          },
        },
        {
          name: 'boomerang_get_task_progress',
          description: 'Get overall progress of a parent task',
          inputSchema: {
            type: 'object',
            properties: {
              parentTaskId: {
                type: 'string',
                description: 'ID of the parent task',
              },
            },
            required: ['parentTaskId'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      this.logger.debug(`Tool called: ${name}`, { args });
      const timer = this.logger.startTimer(`Tool execution: ${name}`);

      try {
        // Validace vstupů
        const validation = validator.validate(this.getValidationSchemaName(name), args);
        if (!validation.valid) {
          this.logger.warn(`Validation failed for ${name}`, { errors: validation.errors });
          throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
        }
        
        switch (name) {
          case 'boomerang_analyze_task':
            return await this.handleAnalyzeTask(args);
          case 'boomerang_create_subtask':
            return await this.handleCreateSubtask(args);
          case 'boomerang_execute_subtask':
            return await this.handleExecuteSubtask(args);
          case 'boomerang_get_subtask_status':
            return await this.handleGetSubtaskStatus(args);
          case 'boomerang_merge_results':
            return await this.handleMergeResults(args);
          case 'boomerang_get_task_progress':
            return await this.handleGetTaskProgress(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        this.logger.error(`Tool execution failed: ${name}`, { error: error.message });
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  setupToolHandlers() {
    // Tool handlers will be implemented here
  }

  async handleAnalyzeTask(args) {
    this.logger.info('Analyzing task', { description: args.description });
    const task = await this.orchestrator.analyzeTask(args.description, args.projectContext);
    this.logger.info('Task analysis completed', { taskId: task.id, complexity: task.analysis.complexity });
    
    // Poslat webhook notifikaci
    await this.webhookManager.notifyTaskCreated(task);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            taskId: task.id,
            analysis: task.analysis,
            message: task.analysis.shouldBreakDown 
              ? 'Task complexity suggests breaking into subtasks'
              : 'Task is simple enough to execute directly'
          }, null, 2),
        },
      ],
    };
  }

  async handleCreateSubtask(args) {
    this.logger.info('Creating subtask', { parentTaskId: args.parentTaskId, title: args.subtaskConfig.title });
    const subtask = await this.subtaskManager.createSubtask(
      args.parentTaskId,
      args.subtaskConfig,
      args.contextToPass
    );
    this.logger.info('Subtask created', { subtaskId: subtask.id, parentTaskId: args.parentTaskId });
    
    // Poslat webhook notifikaci
    await this.webhookManager.notifySubtaskCreated(subtask);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            subtaskId: subtask.id,
            title: subtask.title,
            status: subtask.status,
            contextId: subtask.context.id,
            message: 'Subtask created successfully with isolated context'
          }, null, 2),
        },
      ],
    };
  }

  async handleExecuteSubtask(args) {
    this.logger.info('Executing subtask', { subtaskId: args.subtaskId, mode: args.executionMode });
    const result = await this.subtaskManager.executeSubtask(args.subtaskId, args.executionMode);
    this.logger.info('Subtask execution completed', { subtaskId: args.subtaskId, status: result.status });
    
    // Poslat webhook notifikaci
    await this.webhookManager.notifySubtaskExecuted(result, result.results);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            subtaskId: result.id,
            status: result.status,
            results: result.results,
            summary: result.summary,
            message: 'Subtask execution completed'
          }, null, 2),
        },
      ],
    };
  }

  async handleGetSubtaskStatus(args) {
    const status = await this.subtaskManager.getSubtaskStatus(args.subtaskId);

    if (!status) {
      throw new Error(`Subtask ${args.subtaskId} not found`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(status, null, 2),
        },
      ],
    };
  }

  async handleMergeResults(args) {
    const mergedData = await this.resultsMerger.mergeSubtaskResults(args.parentTaskId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            parentTaskId: args.parentTaskId,
            finalSummary: mergedData.finalSummary,
            mergedResults: mergedData.mergedResults,
            message: `Successfully merged results from ${mergedData.subtaskCount} subtasks`
          }, null, 2),
        },
      ],
    };
  }

  async handleGetTaskProgress(args) {
    const progress = await this.resultsMerger.getTaskProgress(args.parentTaskId);

    if (!progress) {
      throw new Error(`Task ${args.parentTaskId} not found`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(progress, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info('Boomerang MCP Server running on stdio');
    
    // Poslat notifikaci o startu serveru
    await this.webhookManager.notifyServerStarted();
  }

  /**
   * Mapování názvů nástrojů na schémata validace
   */
  getValidationSchemaName(toolName) {
    const mapping = {
      'boomerang_analyze_task': 'analyzeTask',
      'boomerang_create_subtask': 'createSubtask', 
      'boomerang_execute_subtask': 'executeSubtask',
      'boomerang_get_subtask_status': 'getSubtaskStatus',
      'boomerang_merge_results': 'mergeResults',
      'boomerang_get_task_progress': 'getTaskProgress'
    };
    return mapping[toolName] || null;
  }
}

const server = new BoomerangMCPServer();
server.run().catch(console.error);