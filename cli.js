#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { Storage } from './utils/storage.js';
import { getTaskCache } from './utils/cache.js';
import { getPriorityQueue } from './utils/priority-queue.js';

/**
 * CLI utilita pro monitoring Boomerang MCP serveru
 */
class BoomerangCLI {
  constructor() {
    this.storage = new Storage('./storage');
    this.cache = getTaskCache();
    this.priorityQueue = getPriorityQueue();
    this.program = new Command();
    this.setupCommands();
  }

  setupCommands() {
    this.program
      .name('boomerang')
      .description('CLI pro monitoring Boomerang MCP serveru')
      .version('1.0.0');

    // Status příkaz
    this.program
      .command('status')
      .description('Zobrazí celkový status serveru')
      .option('-v, --verbose', 'Detailní výstup')
      .action((options) => this.handleStatus(options));

    // Tasks příkaz
    this.program
      .command('tasks')
      .description('Zobrazí seznam úkolů')
      .option('-s, --status <status>', 'Filtrovat podle stavu (pending, executing, completed, failed)')
      .option('-l, --limit <number>', 'Limit počtu zobrazených úkolů', '10')
      .action((options) => this.handleTasks(options));

    // Queue příkaz
    this.program
      .command('queue')
      .description('Správa prioritní fronty')
      .addCommand(
        new Command('status')
          .description('Zobrazí stav fronty')
          .action(() => this.handleQueueStatus())
      )
      .addCommand(
        new Command('list')
          .description('Zobrazí úkoly ve frontě')
          .action(() => this.handleQueueList())
      )
      .addCommand(
        new Command('clear')
          .description('Vymaže frontu')
          .action(() => this.handleQueueClear())
      );

    // Cache příkaz
    this.program
      .command('cache')
      .description('Správa cache')
      .addCommand(
        new Command('stats')
          .description('Zobrazí statistiky cache')
          .action(() => this.handleCacheStats())
      )
      .addCommand(
        new Command('list')
          .description('Zobrazí cached položky')
          .action(() => this.handleCacheList())
      )
      .addCommand(
        new Command('clear')
          .description('Vymaže celou cache')
          .action(() => this.handleCacheClear())
      );

    // Logs příkaz
    this.program
      .command('logs')
      .description('Zobrazí logy')
      .option('-f, --follow', 'Sledovat logy v real-time')
      .option('-n, --lines <number>', 'Počet posledních řádků', '50')
      .option('--level <level>', 'Filtrovat podle úrovně (debug, info, warn, error)')
      .action((options) => this.handleLogs(options));

    // Health příkaz
    this.program
      .command('health')
      .description('Ověří zdraví serveru')
      .action(() => this.handleHealth());

    // Cleanup příkaz
    this.program
      .command('cleanup')
      .description('Vyčistí staré soubory a logy')
      .option('--days <number>', 'Smazat soubory starší než X dní', '7')
      .action((options) => this.handleCleanup(options));
  }

  async handleStatus(options) {
    console.log('🚀 Boomerang MCP Server Status\n');

    try {
      // Základní informace
      console.log('📊 Overview:');
      const tasksCount = await this.getTasksCount();
      console.log(`  Tasks: ${tasksCount.total} total (${tasksCount.completed} completed, ${tasksCount.failed} failed)`);

      // Cache statistiky
      const cacheStats = this.cache.getStats();
      console.log(`  Cache: ${cacheStats.size} items, ${cacheStats.hitRate}% hit rate`);

      if (options.verbose) {
        console.log('\n💾 Cache Details:');
        console.log(`  Size: ${cacheStats.size}/${cacheStats.maxSize}`);
        console.log(`  TTL: ${Math.round(cacheStats.ttl / 1000)}s`);
        console.log(`  Hits: ${cacheStats.hits}, Misses: ${cacheStats.misses}`);
        console.log(`  Evictions: ${cacheStats.evictions}`);

        // Storage informace
        console.log('\n💿 Storage:');
        const storageInfo = await this.getStorageInfo();
        console.log(`  Tasks directory: ${storageInfo.tasksSize} files`);
        console.log(`  Contexts directory: ${storageInfo.contextsSize} files`);
        console.log(`  Total size: ${storageInfo.totalSize}`);
      }

    } catch (error) {
      console.error('❌ Error getting status:', error.message);
      process.exit(1);
    }
  }

  async handleTasks(options) {
    console.log('📝 Tasks Overview\n');

    try {
      const tasks = await this.getTasks(options);
      
      if (tasks.length === 0) {
        console.log('No tasks found.');
        return;
      }

      console.log(`Found ${tasks.length} tasks:\n`);

      for (const task of tasks) {
        const status = this.getStatusEmoji(task.status);
        const duration = this.formatDuration(task.createdAt, task.completedAt);
        
        console.log(`${status} ${task.id}`);
        console.log(`  Description: ${task.description?.substring(0, 80)}...`);
        console.log(`  Status: ${task.status}`);
        console.log(`  Created: ${new Date(task.createdAt).toLocaleString()}`);
        if (duration) console.log(`  Duration: ${duration}`);
        if (task.analysis?.complexity) console.log(`  Complexity: ${task.analysis.complexity}/10`);
        console.log('');
      }

    } catch (error) {
      console.error('❌ Error getting tasks:', error.message);
      process.exit(1);
    }
  }

  async handleCacheStats() {
    console.log('💾 Cache Statistics\n');

    const stats = this.cache.getStats();
    
    console.log(`Status: ${stats.enabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`Size: ${stats.size}/${stats.maxSize} items`);
    console.log(`Hit Rate: ${stats.hitRate}%`);
    console.log(`TTL: ${Math.round(stats.ttl / 1000)}s`);
    console.log('');
    console.log(`Hits: ${stats.hits}`);
    console.log(`Misses: ${stats.misses}`);
    console.log(`Evictions: ${stats.evictions}`);
  }

  async handleCacheList() {
    console.log('📋 Cached Items\n');

    const items = this.cache.getAllItems();
    
    if (items.length === 0) {
      console.log('Cache is empty.');
      return;
    }

    for (const item of items) {
      const expired = item.expired ? '⏰ EXPIRED' : '✅ Valid';
      const ttlRemaining = Math.round(item.ttlRemaining / 1000);
      
      console.log(`🔑 ${item.key}`);
      console.log(`  Description: ${item.description?.substring(0, 60)}...`);
      console.log(`  Status: ${expired}`);
      console.log(`  TTL Remaining: ${ttlRemaining}s`);
      console.log(`  Last Accessed: ${new Date(item.accessedAt).toLocaleString()}`);
      console.log('');
    }
  }

  async handleCacheClear() {
    console.log('🧹 Clearing cache...');
    this.cache.clear();
    console.log('✅ Cache cleared successfully.');
  }

  async handleLogs(options) {
    const logPath = process.env.BOOMERANG_LOG_FILE || './storage/logs/boomerang.log';
    
    console.log(`📄 Logs from: ${logPath}\n`);

    try {
      if (options.follow) {
        console.log('Following logs (Ctrl+C to exit)...\n');
        await this.followLogs(logPath, options);
      } else {
        await this.showLogs(logPath, options);
      }
    } catch (error) {
      console.error('❌ Error reading logs:', error.message);
      process.exit(1);
    }
  }

  async handleHealth() {
    console.log('🏥 Health Check\n');

    const checks = [
      {
        name: 'Storage Directory',
        check: () => this.checkStorageDirectory()
      },
      {
        name: 'Log Directory', 
        check: () => this.checkLogDirectory()
      },
      {
        name: 'Cache',
        check: () => this.checkCache()
      }
    ];

    let allHealthy = true;

    for (const { name, check } of checks) {
      try {
        await check();
        console.log(`✅ ${name}: OK`);
      } catch (error) {
        console.log(`❌ ${name}: ${error.message}`);
        allHealthy = false;
      }
    }

    console.log(`\n${allHealthy ? '✅' : '❌'} Overall Health: ${allHealthy ? 'Healthy' : 'Issues Found'}`);
    
    if (!allHealthy) {
      process.exit(1);
    }
  }

  async handleCleanup(options) {
    const days = parseInt(options.days);
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    console.log(`🧹 Cleaning up files older than ${days} days (before ${cutoffDate.toLocaleDateString()})\n`);

    try {
      let deletedCount = 0;

      // Vyčistit staré task soubory
      const tasksDir = path.join('./storage', 'tasks');
      const taskFiles = await fs.readdir(tasksDir);
      
      for (const file of taskFiles) {
        const filePath = path.join(tasksDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          deletedCount++;
          console.log(`🗑️  Deleted task: ${file}`);
        }
      }

      // Vyčistit staré context soubory
      const contextsDir = path.join('./storage', 'contexts');
      const contextFiles = await fs.readdir(contextsDir);
      
      for (const file of contextFiles) {
        const filePath = path.join(contextsDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          deletedCount++;
          console.log(`🗑️  Deleted context: ${file}`);
        }
      }

      console.log(`\n✅ Cleanup completed. Deleted ${deletedCount} files.`);

    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
      process.exit(1);
    }
  }

  // Pomocné metody

  async getTasksCount() {
    try {
      const tasksDir = path.join('./storage', 'tasks');
      const files = await fs.readdir(tasksDir);
      
      let completed = 0, failed = 0;
      
      for (const file of files.slice(0, 100)) { // Omezit pro rychlost
        try {
          const content = await fs.readFile(path.join(tasksDir, file), 'utf8');
          const task = JSON.parse(content);
          if (task.status === 'completed') completed++;
          if (task.status === 'failed') failed++;
        } catch (e) {
          // Ignorovat chybné soubory
        }
      }
      
      return { total: files.length, completed, failed };
    } catch (error) {
      return { total: 0, completed: 0, failed: 0 };
    }
  }

  async getTasks(options) {
    try {
      const tasksDir = path.join('./storage', 'tasks');
      const files = await fs.readdir(tasksDir);
      const tasks = [];
      const limit = parseInt(options.limit) || 10;
      
      // Seřadit podle času (nejnovější první)
      const sortedFiles = files.sort().reverse();
      
      for (const file of sortedFiles.slice(0, limit * 2)) {
        try {
          const content = await fs.readFile(path.join(tasksDir, file), 'utf8');
          const task = JSON.parse(content);
          
          if (!options.status || task.status === options.status) {
            tasks.push(task);
            if (tasks.length >= limit) break;
          }
        } catch (e) {
          // Ignorovat chybné soubory
        }
      }
      
      return tasks;
    } catch (error) {
      return [];
    }
  }

  async getStorageInfo() {
    const info = { tasksSize: 0, contextsSize: 0, totalSize: '0 B' };
    
    try {
      const tasksDir = path.join('./storage', 'tasks');
      const taskFiles = await fs.readdir(tasksDir);
      info.tasksSize = taskFiles.length;
      
      const contextsDir = path.join('./storage', 'contexts');
      const contextFiles = await fs.readdir(contextsDir);
      info.contextsSize = contextFiles.length;
      
      // Přibližná velikost
      const estimatedSize = (info.tasksSize + info.contextsSize) * 1024; // 1KB per file
      info.totalSize = this.formatBytes(estimatedSize);
    } catch (error) {
      // Ignorovat chyby
    }
    
    return info;
  }

  getStatusEmoji(status) {
    const emojiMap = {
      'pending': '⏳',
      'executing': '⚡',
      'completed': '✅',
      'failed': '❌',
      'analyzing': '🔍'
    };
    return emojiMap[status] || '❓';
  }

  formatDuration(startTime, endTime) {
    if (!endTime) return null;
    const duration = new Date(endTime) - new Date(startTime);
    return `${Math.round(duration / 1000)}s`;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async showLogs(logPath, options) {
    try {
      const content = await fs.readFile(logPath, 'utf8');
      const lines = content.trim().split('\n').slice(-parseInt(options.lines));
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const log = JSON.parse(line);
            if (!options.level || log.level.toLowerCase() === options.level.toLowerCase()) {
              console.log(this.formatLogLine(log));
            }
          } catch (e) {
            console.log(line); // Fallback pro non-JSON logy
          }
        }
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('No log file found. Server may not be running or logging is disabled.');
      } else {
        throw error;
      }
    }
  }

  async followLogs(logPath, options) {
    // Simplified tail implementation
    console.log('Log following not implemented in this demo. Use: tail -f ' + logPath);
  }

  formatLogLine(log) {
    const colors = {
      DEBUG: '\x1b[36m',
      INFO: '\x1b[32m',
      WARN: '\x1b[33m',
      ERROR: '\x1b[31m'
    };
    const reset = '\x1b[0m';
    const color = colors[log.level] || reset;
    
    return `${color}[${log.level}]${reset} ${log.timestamp} - ${log.message}`;
  }

  async checkStorageDirectory() {
    const storageDir = './storage';
    await fs.access(storageDir);
    await fs.access(path.join(storageDir, 'tasks'));
    await fs.access(path.join(storageDir, 'contexts'));
  }

  async checkLogDirectory() {
    const logDir = path.dirname(process.env.BOOMERANG_LOG_FILE || './storage/logs/boomerang.log');
    await fs.access(logDir);
  }

  checkCache() {
    const stats = this.cache.getStats();
    if (!stats.enabled) {
      throw new Error('Cache is disabled');
    }
    return true;
  }

  async handleQueueStatus() {
    console.log('📋 Priority Queue Status\n');

    const queueInfo = this.priorityQueue.getStats();
    const sizes = queueInfo.sizes;

    console.log('Queue Sizes:');
    console.log(`  High Priority: ${sizes.high} tasks`);
    console.log(`  Medium Priority: ${sizes.medium} tasks`);
    console.log(`  Low Priority: ${sizes.low} tasks`);
    console.log(`  Total: ${sizes.total} tasks`);
    console.log('');

    console.log('Statistics:');
    console.log(`  Total Processed: ${queueInfo.stats.stats.totalProcessed}`);
    console.log(`  SLA Violations: ${Object.values(queueInfo.stats.slaViolationRate).reduce((a, b) => a + b, 0)}%`);
    console.log('');

    console.log('Average Wait Times:');
    Object.entries(queueInfo.avgWaitTimes).forEach(([priority, time]) => {
      console.log(`  ${priority}: ${Math.round(time / 1000)}s`);
    });
  }

  async handleQueueList() {
    console.log('📋 Queued Tasks\n');

    const tasks = this.priorityQueue.getAllTasks();

    if (tasks.length === 0) {
      console.log('No tasks in queue.');
      return;
    }

    for (const task of tasks) {
      const priorityEmoji = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
      const slaStatus = task.slaTimeRemaining > 0 ? '✅' : '⚠️';
      
      console.log(`${priorityEmoji} ${task.id} (${task.priority})`);
      console.log(`  Position: ${task.queuePosition}`);
      console.log(`  Wait Time: ${Math.round(task.waitTime / 1000)}s`);
      console.log(`  SLA: ${slaStatus} ${Math.round(task.slaTimeRemaining / 1000)}s remaining`);
      console.log('');
    }
  }

  async handleQueueClear() {
    console.log('🧹 Clearing priority queue...');
    const removedCount = this.priorityQueue.clear();
    console.log(`✅ Removed ${removedCount} tasks from queue.`);
  }

  run() {
    this.program.parse();
  }
}

// Spustit CLI
const cli = new BoomerangCLI();
cli.run();