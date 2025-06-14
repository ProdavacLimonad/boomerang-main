import { getLogger } from './logger.js';
import RetryManager from './retry.js';

/**
 * Webhook manager pro notifikace o stavu úkolů
 */
export class WebhookManager {
  constructor(options = {}) {
    this.logger = getLogger();
    this.webhookUrls = new Set();
    this.retryManager = new RetryManager({
      maxRetries: 3,
      baseDelay: 1000,
      retryCondition: RetryManager.createRetryCondition()
    });
    
    // Načíst webhook URLs z environment variables
    this.loadWebhookUrls();
  }

  /**
   * Načte webhook URLs z prostředí
   */
  loadWebhookUrls() {
    const webhookEnvVars = [
      'BOOMERANG_WEBHOOK_URL',
      'BOOMERANG_SLACK_WEBHOOK',
      'BOOMERANG_DISCORD_WEBHOOK',
      'BOOMERANG_TEAMS_WEBHOOK'
    ];

    for (const envVar of webhookEnvVars) {
      const url = process.env[envVar];
      if (url) {
        this.addWebhook(url);
      }
    }

    this.logger.info(`Loaded ${this.webhookUrls.size} webhook URLs`);
  }

  /**
   * Přidá webhook URL
   */
  addWebhook(url) {
    try {
      new URL(url); // Validace URL
      this.webhookUrls.add(url);
      this.logger.debug('Webhook URL added', { url });
    } catch (error) {
      this.logger.error('Invalid webhook URL', { url, error: error.message });
    }
  }

  /**
   * Odebere webhook URL
   */
  removeWebhook(url) {
    this.webhookUrls.delete(url);
    this.logger.debug('Webhook URL removed', { url });
  }

  /**
   * Získá seznam webhook URLs
   */
  getWebhooks() {
    return Array.from(this.webhookUrls);
  }

  /**
   * Pošle webhook notifikaci
   */
  async sendNotification(event, data, options = {}) {
    if (this.webhookUrls.size === 0) {
      this.logger.debug('No webhook URLs configured, skipping notification');
      return;
    }

    const payload = this.createPayload(event, data, options);
    const promises = [];

    for (const url of this.webhookUrls) {
      promises.push(this.sendWebhook(url, payload));
    }

    // Poslat všechny webhooky paralelně
    const results = await Promise.allSettled(promises);
    
    // Logovat výsledky
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    this.logger.info('Webhook notifications sent', {
      event,
      successful,
      failed,
      total: this.webhookUrls.size
    });
  }

  /**
   * Vytvoří payload pro webhook
   */
  createPayload(event, data, options) {
    const payload = {
      timestamp: new Date().toISOString(),
      event,
      server: 'boomerang-mcp-server',
      version: '1.0.0',
      data,
      ...options
    };

    // Přidat formatting pro různé služby
    if (options.slack || options.discord) {
      payload.text = this.formatMessage(event, data);
      payload.attachments = this.createAttachments(event, data);
    }

    return payload;
  }

  /**
   * Formátuje zprávu pro chat služby
   */
  formatMessage(event, data) {
    const emoji = this.getEventEmoji(event);
    
    switch (event) {
      case 'task.created':
        return `${emoji} Nový úkol vytvořen: "${data.description}"`;
      
      case 'task.completed':
        return `${emoji} Úkol dokončen: "${data.title}" (${data.duration})`;
      
      case 'task.failed':
        return `${emoji} Úkol selhal: "${data.title}" - ${data.error}`;
      
      case 'subtask.created':
        return `${emoji} Podúkol vytvořen: "${data.title}"`;
      
      case 'subtask.executed':
        return `${emoji} Podúkol spuštěn: "${data.title}"`;
      
      case 'results.merged':
        return `${emoji} Výsledky sloučeny pro úkol: "${data.parentTaskTitle}"`;
      
      default:
        return `${emoji} Event: ${event}`;
    }
  }

  /**
   * Získá emoji pro typ eventu
   */
  getEventEmoji(event) {
    const emojiMap = {
      'task.created': '🚀',
      'task.completed': '✅',
      'task.failed': '❌',
      'subtask.created': '📝',
      'subtask.executed': '⚡',
      'results.merged': '🔄',
      'server.started': '🟢',
      'server.error': '🔴'
    };
    
    return emojiMap[event] || '📌';
  }

  /**
   * Vytvoří attachments pro bohatší zobrazení
   */
  createAttachments(event, data) {
    const attachments = [];
    
    if (data.taskId) {
      attachments.push({
        title: 'Task Details',
        fields: [
          {
            title: 'Task ID',
            value: data.taskId,
            short: true
          }
        ]
      });
    }

    if (data.complexity) {
      attachments[0].fields.push({
        title: 'Complexity',
        value: `${data.complexity}/10`,
        short: true
      });
    }

    if (data.executionTime || data.duration) {
      attachments[0].fields.push({
        title: 'Duration',
        value: data.executionTime || data.duration,
        short: true
      });
    }

    return attachments;
  }

  /**
   * Pošle konkrétní webhook s retry logikou
   */
  async sendWebhook(url, payload) {
    return this.retryManager.executeWithRetry(
      () => this.performWebhookRequest(url, payload),
      { webhookUrl: url, event: payload.event }
    );
  }

  /**
   * Samotné odeslání webhook requestu
   */
  async performWebhookRequest(url, payload) {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Boomerang-MCP-Server/1.0'
      },
      body: JSON.stringify(payload),
      timeout: 10000 // 10 sekund timeout
    });

    if (!response.ok) {
      const error = new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      error.statusCode = response.status;
      throw error;
    }

    return response;
  }

  /**
   * Praktické metody pro různé eventy
   */
  async notifyTaskCreated(task) {
    await this.sendNotification('task.created', {
      taskId: task.id,
      description: task.description,
      complexity: task.analysis?.complexity,
      shouldBreakDown: task.analysis?.shouldBreakDown
    });
  }

  async notifyTaskCompleted(task, duration) {
    await this.sendNotification('task.completed', {
      taskId: task.id,
      title: task.description,
      duration,
      status: task.status
    });
  }

  async notifyTaskFailed(task, error) {
    await this.sendNotification('task.failed', {
      taskId: task.id,
      title: task.description,
      error: error.message,
      status: task.status
    });
  }

  async notifySubtaskCreated(subtask) {
    await this.sendNotification('subtask.created', {
      subtaskId: subtask.id,
      parentTaskId: subtask.parentId,
      title: subtask.title,
      type: subtask.type,
      priority: subtask.priority
    });
  }

  async notifySubtaskExecuted(subtask, results) {
    await this.sendNotification('subtask.executed', {
      subtaskId: subtask.id,
      title: subtask.title,
      status: subtask.status,
      executionTime: results.executionTime
    });
  }

  async notifyResultsMerged(parentTask, mergedResults) {
    await this.sendNotification('results.merged', {
      parentTaskId: parentTask.id,
      parentTaskTitle: parentTask.description,
      subtaskCount: mergedResults.subtaskCount,
      overallSuccess: mergedResults.finalSummary.overallSuccess
    });
  }

  async notifyServerStarted() {
    await this.sendNotification('server.started', {
      message: 'Boomerang MCP Server started successfully'
    });
  }

  async notifyServerError(error) {
    await this.sendNotification('server.error', {
      error: error.message,
      stack: error.stack
    });
  }
}

// Export singleton instance
let defaultWebhookManager;

export function getWebhookManager(options) {
  if (!defaultWebhookManager) {
    defaultWebhookManager = new WebhookManager(options);
  }
  return defaultWebhookManager;
}

// Convenience function pro approval system
export async function sendWebhookNotification(message) {
  const manager = getWebhookManager();
  return await manager.sendNotification('approval.notification', message);
}

export default getWebhookManager();