import { getLogger } from './logger.js';

/**
 * Utility pro retry logiku s exponenciálním backoffem
 */
export class RetryManager {
  constructor(options = {}) {
    this.logger = getLogger();
    this.defaultOptions = {
      maxRetries: 3,
      baseDelay: 1000, // 1 sekunda
      maxDelay: 30000, // 30 sekund
      backoffFactor: 2,
      jitter: true,
      retryCondition: (error) => true // Retry všechny chyby defaultně
    };
    
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * Spustí funkci s retry logikou
   * @param {Function} fn - Funkce k opakování
   * @param {Object} context - Kontext pro logování
   * @param {Object} overrideOptions - Přepsání defaultních možností
   */
  async executeWithRetry(fn, context = {}, overrideOptions = {}) {
    const options = { ...this.options, ...overrideOptions };
    let lastError;
    
    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        this.logger.debug('Executing function', { 
          attempt: attempt + 1, 
          maxAttempts: options.maxRetries + 1,
          ...context 
        });
        
        const result = await fn();
        
        if (attempt > 0) {
          this.logger.info('Function succeeded after retry', { 
            attempt: attempt + 1,
            ...context 
          });
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        // Zkontrolovat, zda má smysl opakovat
        if (!options.retryCondition(error)) {
          this.logger.warn('Error not retryable', { 
            error: error.message,
            attempt: attempt + 1,
            ...context 
          });
          throw error;
        }
        
        // Pokud je to poslední pokus, hodit chybu
        if (attempt === options.maxRetries) {
          this.logger.error('Function failed after all retries', { 
            error: error.message,
            totalAttempts: attempt + 1,
            ...context 
          });
          throw error;
        }
        
        // Vypočítat delay pro další pokus
        const delay = this.calculateDelay(attempt, options);
        
        this.logger.warn('Function failed, retrying', { 
          error: error.message,
          attempt: attempt + 1,
          nextAttemptIn: `${delay}ms`,
          ...context 
        });
        
        // Počkat před dalším pokusem
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Vypočítá delay pro další pokus s exponenciálním backoffem
   */
  calculateDelay(attempt, options) {
    // Exponenciální backoff
    let delay = options.baseDelay * Math.pow(options.backoffFactor, attempt);
    
    // Omezit maximální delay
    delay = Math.min(delay, options.maxDelay);
    
    // Přidat jitter pro rozložení zatížení
    if (options.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }
    
    return Math.round(delay);
  }

  /**
   * Pomocná funkce pro čekání
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Vytvoří retry podmínku pro konkrétní typy chyb
   */
  static createRetryCondition(retryableCodes = []) {
    const defaultRetryableErrors = [
      'ECONNRESET',
      'ENOTFOUND', 
      'ECONNREFUSED',
      'ETIMEDOUT',
      'EPIPE'
    ];
    
    const allRetryableCodes = [...defaultRetryableErrors, ...retryableCodes];
    
    return (error) => {
      // Retry síťové chyby
      if (allRetryableCodes.includes(error.code)) {
        return true;
      }
      
      // Retry HTTP 5xx chyby
      if (error.statusCode && error.statusCode >= 500) {
        return true;
      }
      
      // Retry rate limiting
      if (error.statusCode === 429) {
        return true;
      }
      
      // Neretry 4xx chyby (kromě 429)
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        return false;
      }
      
      return true;
    };
  }

  /**
   * Wrapper pro časté případy použití
   */
  static async retryAsync(fn, options = {}) {
    const manager = new RetryManager(options);
    return manager.executeWithRetry(fn);
  }

  /**
   * Retry specificky pro HTTP requesty
   */
  static async retryHTTP(fn, options = {}) {
    const httpOptions = {
      maxRetries: 3,
      baseDelay: 1000,
      retryCondition: RetryManager.createRetryCondition(),
      ...options
    };
    
    return RetryManager.retryAsync(fn, httpOptions);
  }

  /**
   * Retry pro databázové operace
   */
  static async retryDatabase(fn, options = {}) {
    const dbOptions = {
      maxRetries: 5,
      baseDelay: 500,
      retryCondition: RetryManager.createRetryCondition([
        'ECONNRESET',
        'ER_LOCK_WAIT_TIMEOUT',
        'ER_LOCK_DEADLOCK'
      ]),
      ...options
    };
    
    return RetryManager.retryAsync(fn, dbOptions);
  }

  /**
   * Retry pro file operace
   */
  static async retryFileOperation(fn, options = {}) {
    const fileOptions = {
      maxRetries: 3,
      baseDelay: 100,
      retryCondition: RetryManager.createRetryCondition([
        'EBUSY',
        'EMFILE',
        'ENFILE',
        'ENOENT'
      ]),
      ...options
    };
    
    return RetryManager.retryAsync(fn, fileOptions);
  }
}

export default RetryManager;