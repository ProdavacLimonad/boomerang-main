#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

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
    
    this.server = new McpServer({
      name: 'boomerang-mcp-server',
      version: '1.0.0',
    });

    this.storage = new Storage('./storage');
    this.orchestrator = new Orchestrator(this.storage);
    this.subtaskManager = new SubtaskManager(this.storage);
    this.resultsMerger = new ResultsMerger(this.storage);
    this.webhookManager = getWebhookManager();

    this.setupTools();
    
    this.logger.info('Server initialized successfully');
  }

  setupTools() {
    // boomerang_analyze_task tool
    this.server.tool(
      'boomerang_analyze_task',
      {
        description: z.string().describe('Description of the task to analyze'),
        projectContext: z.object({}).optional().describe('Optional project context and constraints')
      },
      async ({ description, projectContext = {} }) => {
        try {
          const validation = validator.validate('analyzeTask', { description, projectContext });
          if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
          }
          
          const result = await this.handleAnalyzeTask({ description, projectContext });
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          this.logger.error('Tool boomerang_analyze_task failed', { error: error.message });
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }]
          };
        }
      }
    );

    // boomerang_create_subtask tool
    this.server.tool(
      'boomerang_create_subtask',
      {
        parentTaskId: z.string().describe('ID of the parent task'),
        subtaskConfig: z.object({
          title: z.string(),
          description: z.string(),
          type: z.string(),
          priority: z.enum(['high', 'medium', 'low'])
        }).describe('Configuration for the subtask'),
        contextToPass: z.object({}).optional().describe('Context data to pass to the subtask')
      },
      async ({ parentTaskId, subtaskConfig, contextToPass = {} }) => {
        try {
          const validation = validator.validate('createSubtask', { parentTaskId, subtaskConfig, contextToPass });
          if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
          }
          
          const result = await this.handleCreateSubtask({ parentTaskId, subtaskConfig, contextToPass });
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          this.logger.error('Tool boomerang_create_subtask failed', { error: error.message });
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }]
          };
        }
      }
    );

    // boomerang_execute_subtask tool
    this.server.tool(
      'boomerang_execute_subtask',
      {
        subtaskId: z.string().describe('ID of the subtask to execute'),
        executionMode: z.enum(['simulation', 'real']).optional().describe('Execution mode (simulation or real)')
      },
      async ({ subtaskId, executionMode = 'simulation' }) => {
        try {
          const validation = validator.validate('executeSubtask', { subtaskId, executionMode });
          if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
          }
          
          const result = await this.handleExecuteSubtask({ subtaskId, executionMode });
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          this.logger.error('Tool boomerang_execute_subtask failed', { error: error.message });
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }]
          };
        }
      }
    );

    // boomerang_get_subtask_status tool
    this.server.tool(
      'boomerang_get_subtask_status',
      {
        subtaskId: z.string().describe('ID of the subtask to check')
      },
      async ({ subtaskId }) => {
        try {
          const validation = validator.validate('getSubtaskStatus', { subtaskId });
          if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
          }
          
          const result = await this.handleGetSubtaskStatus({ subtaskId });
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          this.logger.error('Tool boomerang_get_subtask_status failed', { error: error.message });
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }]
          };
        }
      }
    );

    // boomerang_merge_results tool
    this.server.tool(
      'boomerang_merge_results',
      {
        taskId: z.string().describe('ID of the main task')
      },
      async ({ taskId }) => {
        try {
          const validation = validator.validate('mergeResults', { taskId });
          if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
          }
          
          const result = await this.handleMergeResults({ taskId });
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          this.logger.error('Tool boomerang_merge_results failed', { error: error.message });
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }]
          };
        }
      }
    );

    // boomerang_get_task_progress tool
    this.server.tool(
      'boomerang_get_task_progress',
      {
        taskId: z.string().describe('ID of the task to check progress for')
      },
      async ({ taskId }) => {
        try {
          const validation = validator.validate('getTaskProgress', { taskId });
          if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
          }
          
          const result = await this.handleGetTaskProgress({ taskId });
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          this.logger.error('Tool boomerang_get_task_progress failed', { error: error.message });
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }]
          };
        }
      }
    );
  }

  async handleAnalyzeTask(args) {
    const timer = this.logger.startTimer('Tool execution: boomerang_analyze_task');
    
    try {
      const analysis = await this.orchestrator.analyzeTask(args.description, args.projectContext);
      
      timer.done({ level: 'info', message: 'Task analysis completed successfully' });
      
      return {
        status: 'success',
        emoji: '🪃',
        message: '🪃 Task analyzed using Boomerang pattern',
        analysis,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      timer.done({ level: 'error', message: 'Task analysis failed' });
      throw error;
    }
  }

  async handleCreateSubtask(args) {
    const timer = this.logger.startTimer('Tool execution: boomerang_create_subtask');
    
    try {
      const subtask = await this.subtaskManager.createSubtask(
        args.parentTaskId,
        args.subtaskConfig,
        args.contextToPass
      );
      
      timer.done({ level: 'info', message: 'Subtask created successfully' });
      
      return {
        status: 'success',
        emoji: '🪃',
        message: '🪃 Subtask created with specialized mode',
        subtask,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      timer.done({ level: 'error', message: 'Subtask creation failed' });
      throw error;
    }
  }

  async handleExecuteSubtask(args) {
    const timer = this.logger.startTimer('Tool execution: boomerang_execute_subtask');
    
    try {
      const result = await this.subtaskManager.executeSubtask(args.subtaskId, args.executionMode);
      
      timer.done({ level: 'info', message: 'Subtask execution completed' });
      
      return {
        status: 'success',
        emoji: '🪃',
        message: '🪃 Subtask executed in isolation',
        result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      timer.done({ level: 'error', message: 'Subtask execution failed' });
      throw error;
    }
  }

  async handleGetSubtaskStatus(args) {
    const timer = this.logger.startTimer('Tool execution: boomerang_get_subtask_status');
    
    try {
      const status = await this.subtaskManager.getSubtaskStatus(args.subtaskId);
      
      timer.done({ level: 'info', message: 'Subtask status retrieved' });
      
      return {
        status: 'success',
        emoji: '🪃',
        message: '🪃 Subtask status retrieved',
        subtaskStatus: status,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      timer.done({ level: 'error', message: 'Failed to get subtask status' });
      throw error;
    }
  }

  async handleMergeResults(args) {
    const timer = this.logger.startTimer('Tool execution: boomerang_merge_results');
    
    try {
      const mergedResults = await this.resultsMerger.mergeResults(args.taskId);
      
      timer.done({ level: 'info', message: 'Results merged successfully' });
      
      return {
        status: 'success',
        emoji: '🪃',
        message: '🪃 Results merged with context flow',
        mergedResults,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      timer.done({ level: 'error', message: 'Results merging failed' });
      throw error;
    }
  }

  async handleGetTaskProgress(args) {
    const timer = this.logger.startTimer('Tool execution: boomerang_get_task_progress');
    
    try {
      const progress = await this.orchestrator.getTaskProgress(args.taskId);
      
      timer.done({ level: 'info', message: 'Task progress retrieved' });
      
      return {
        status: 'success',
        emoji: '🪃',
        message: '🪃 Task progress calculated',
        progress,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      timer.done({ level: 'error', message: 'Failed to get task progress' });
      throw error;
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info('Boomerang MCP Server started and connected via stdio');
  }
}

// Přidat Zod do dependencies
const server = new BoomerangMCPServer();
server.start().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});