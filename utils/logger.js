import fs from 'fs/promises';
import path from 'path';

/**
 * Logger pro Boomerang MCP Server
 * Podporuje různé úrovně logování a výstup do souboru/konzole
 */
export class Logger {
  constructor(options = {}) {
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    this.level = this.levels[options.level || process.env.BOOMERANG_LOG_LEVEL || 'info'];
    this.logToFile = options.logToFile || process.env.BOOMERANG_LOG_TO_FILE === 'true';
    this.logFilePath = options.logFilePath || process.env.BOOMERANG_LOG_FILE || './storage/logs/boomerang.log';
    this.includeTimestamp = options.includeTimestamp !== false;
    this.includeLevel = options.includeLevel !== false;
    this.prettyPrint = options.prettyPrint || process.env.NODE_ENV === 'development';
    
    // Zajistit existenci adresáře pro logy
    if (this.logToFile) {
      this.ensureLogDirectory();
    }
  }

  async ensureLogDirectory() {
    const logDir = path.dirname(this.logFilePath);
    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  /**
   * Hlavní logovací metoda
   */
  async log(level, message, meta = {}) {
    if (this.levels[level] === undefined || this.levels[level] < this.level) {
      return;
    }

    const logEntry = this.formatLogEntry(level, message, meta);
    
    // Výstup do konzole
    this.logToConsole(level, logEntry);
    
    // Výstup do souboru
    if (this.logToFile) {
      await this.logToFileAsync(logEntry);
    }
  }

  /**
   * Formátování log záznamu
   */
  formatLogEntry(level, message, meta) {
    const entry = {};
    
    if (this.includeTimestamp) {
      entry.timestamp = new Date().toISOString();
    }
    
    if (this.includeLevel) {
      entry.level = level.toUpperCase();
    }
    
    entry.message = message;
    
    // Přidat metadata pokud existují
    if (Object.keys(meta).length > 0) {
      entry.meta = meta;
    }
    
    return entry;
  }

  /**
   * Výstup do konzole s barvami podle úrovně
   */
  logToConsole(level, entry) {
    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m'  // Red
    };
    const reset = '\x1b[0m';
    
    if (this.prettyPrint) {
      // Barevný výstup pro development
      const color = colors[level] || reset;
      const prefix = `${color}[${entry.level}]${reset}`;
      console.log(`${prefix} ${entry.timestamp} - ${entry.message}`);
      if (entry.meta) {
        console.log(`${color}  Meta:${reset}`, entry.meta);
      }
    } else {
      // JSON výstup pro produkci
      console.log(JSON.stringify(entry));
    }
  }

  /**
   * Asynchronní zápis do souboru
   */
  async logToFileAsync(entry) {
    try {
      const line = JSON.stringify(entry) + '\n';
      await fs.appendFile(this.logFilePath, line, 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  // Pomocné metody pro různé úrovně
  debug(message, meta) {
    return this.log('debug', message, meta);
  }

  info(message, meta) {
    return this.log('info', message, meta);
  }

  warn(message, meta) {
    return this.log('warn', message, meta);
  }

  error(message, meta) {
    return this.log('error', message, meta);
  }

  /**
   * Logování výkonu
   */
  startTimer(label) {
    return {
      label,
      startTime: Date.now()
    };
  }

  endTimer(timer, meta = {}) {
    const duration = Date.now() - timer.startTime;
    this.info(`${timer.label} completed`, {
      duration: `${duration}ms`,
      ...meta
    });
    return duration;
  }

  /**
   * Logování HTTP requestů
   */
  logRequest(method, url, statusCode, duration) {
    const level = statusCode >= 400 ? 'error' : 'info';
    this.log(level, `HTTP ${method} ${url}`, {
      statusCode,
      duration: `${duration}ms`
    });
  }

  /**
   * Logování úkolů
   */
  logTask(taskId, event, details = {}) {
    this.info(`Task ${event}`, {
      taskId,
      event,
      ...details
    });
  }

  /**
   * Logování chyb s stack trace
   */
  logError(error, context = {}) {
    this.error(error.message, {
      stack: error.stack,
      code: error.code,
      ...context
    });
  }
}

// Singleton instance
let defaultLogger;

export function getLogger(options) {
  if (!defaultLogger) {
    defaultLogger = new Logger(options);
  }
  return defaultLogger;
}

// Export default logger
export default getLogger();