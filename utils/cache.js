import crypto from 'crypto';
import { getLogger } from './logger.js';

/**
 * Cache manager pro opakované úkoly
 */
export class TaskCache {
  constructor(options = {}) {
    this.logger = getLogger();
    this.cache = new Map();
    this.ttl = options.ttl || parseInt(process.env.BOOMERANG_CACHE_TTL) || 3600000; // 1 hodina default
    this.maxSize = options.maxSize || parseInt(process.env.BOOMERANG_CACHE_MAX_SIZE) || 1000;
    this.enabled = options.enabled !== false && process.env.BOOMERANG_CACHE_ENABLED !== 'false';
    
    // Statistiky cache
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0
    };
    
    // Spustit cleanup každých 10 minut
    this.cleanupInterval = setInterval(() => this.cleanup(), 10 * 60 * 1000);
    
    this.logger.info('Task cache initialized', { 
      enabled: this.enabled,
      ttl: this.ttl,
      maxSize: this.maxSize 
    });
  }

  /**
   * Vytvoří cache klíč z úkolu
   */
  createCacheKey(taskDescription, projectContext = {}) {
    const data = {
      description: taskDescription.trim().toLowerCase(),
      context: this.normalizeContext(projectContext)
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Normalizuje kontext pro konzistentní cachování
   */
  normalizeContext(context) {
    const normalized = {};
    
    // Seřadit klíče a převést na string pro konzistenci
    for (const key of Object.keys(context).sort()) {
      const value = context[key];
      if (typeof value === 'string') {
        normalized[key] = value.trim().toLowerCase();
      } else {
        normalized[key] = value;
      }
    }
    
    return normalized;
  }

  /**
   * Získá úkol z cache
   */
  get(taskDescription, projectContext = {}) {
    if (!this.enabled) {
      return null;
    }

    const key = this.createCacheKey(taskDescription, projectContext);
    const cached = this.cache.get(key);
    
    if (!cached) {
      this.stats.misses++;
      this.logger.debug('Cache miss', { key });
      return null;
    }
    
    // Zkontrolovat TTL
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      this.logger.debug('Cache expired', { key });
      return null;
    }
    
    // Cache hit
    this.stats.hits++;
    this.logger.debug('Cache hit', { key });
    
    // Aktualizovat access time pro LRU
    cached.accessedAt = Date.now();
    
    return JSON.parse(JSON.stringify(cached.data)); // Deep clone
  }

  /**
   * Uloží úkol do cache
   */
  set(taskDescription, projectContext = {}, taskData) {
    if (!this.enabled) {
      return;
    }

    const key = this.createCacheKey(taskDescription, projectContext);
    const now = Date.now();
    
    const cached = {
      data: JSON.parse(JSON.stringify(taskData)), // Deep clone
      createdAt: now,
      accessedAt: now,
      expiresAt: now + this.ttl
    };
    
    // Zkontrolovat velikost cache
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }
    
    this.cache.set(key, cached);
    this.stats.size = this.cache.size;
    
    this.logger.debug('Task cached', { 
      key, 
      size: this.cache.size,
      expiresIn: `${Math.round(this.ttl / 1000)}s`
    });
  }

  /**
   * Vymaže nejméně používané položky (LRU)
   */
  evictLRU() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, cached] of this.cache) {
      if (cached.accessedAt < oldestTime) {
        oldestTime = cached.accessedAt;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      this.logger.debug('Cache LRU eviction', { key: oldestKey });
    }
  }

  /**
   * Vyčistí expirované položky
   */
  cleanup() {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, cached] of this.cache) {
      if (now > cached.expiresAt) {
        this.cache.delete(key);
        removedCount++;
      }
    }
    
    this.stats.size = this.cache.size;
    this.stats.evictions += removedCount;
    
    if (removedCount > 0) {
      this.logger.info('Cache cleanup completed', { 
        removed: removedCount,
        remaining: this.cache.size 
      });
    }
  }

  /**
   * Vymaže celou cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.size = 0;
    this.stats.evictions += size;
    
    this.logger.info('Cache cleared', { removedItems: size });
  }

  /**
   * Vymaže konkrétní položku
   */
  delete(taskDescription, projectContext = {}) {
    const key = this.createCacheKey(taskDescription, projectContext);
    const deleted = this.cache.delete(key);
    
    if (deleted) {
      this.stats.size = this.cache.size;
      this.stats.evictions++;
      this.logger.debug('Cache item deleted', { key });
    }
    
    return deleted;
  }

  /**
   * Získá statistiky cache
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
      : 0;
    
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      enabled: this.enabled,
      ttl: this.ttl,
      maxSize: this.maxSize
    };
  }

  /**
   * Získá informace o všech cached úkolech
   */
  getAllItems() {
    const items = [];
    const now = Date.now();
    
    for (const [key, cached] of this.cache) {
      items.push({
        key,
        description: cached.data.description,
        complexity: cached.data.analysis?.complexity,
        createdAt: new Date(cached.createdAt).toISOString(),
        accessedAt: new Date(cached.accessedAt).toISOString(),
        expiresAt: new Date(cached.expiresAt).toISOString(),
        ttlRemaining: Math.max(0, cached.expiresAt - now),
        expired: now > cached.expiresAt
      });
    }
    
    return items.sort((a, b) => b.accessedAt.localeCompare(a.accessedAt));
  }

  /**
   * Ukončí cache a vyčistí interval
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
    this.logger.info('Task cache destroyed');
  }

  /**
   * Metody pro specifické typy cachování
   */

  /**
   * Cache pro analýzu úkolů
   */
  async cacheTaskAnalysis(taskDescription, projectContext, analysisFunction) {
    // Pokusit se získat z cache
    const cached = this.get(taskDescription, projectContext);
    if (cached) {
      this.logger.info('Task analysis served from cache', { 
        description: taskDescription.substring(0, 50) + '...'
      });
      return cached;
    }

    // Není v cache, provést analýzu
    const result = await analysisFunction();
    
    // Uložit do cache pouze pokud byla analýza úspěšná
    if (result && result.analysis) {
      this.set(taskDescription, projectContext, result);
    }
    
    return result;
  }

  /**
   * Cache pro výsledky podúkolů podle typu
   */
  cacheSubtaskResults(subtaskType, contextHash, results) {
    const key = `subtask:${subtaskType}:${contextHash}`;
    this.cache.set(key, {
      data: results,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      expiresAt: Date.now() + (this.ttl / 2) // Kratší TTL pro podúkoly
    });
  }

  /**
   * Získá cached výsledky podúkolu
   */
  getCachedSubtaskResults(subtaskType, contextHash) {
    const key = `subtask:${subtaskType}:${contextHash}`;
    const cached = this.cache.get(key);
    return cached?.data || null;
  }
}

// Export singleton instance
let defaultCache;

export function getTaskCache(options) {
  if (!defaultCache) {
    defaultCache = new TaskCache(options);
  }
  return defaultCache;
}

export default getTaskCache();