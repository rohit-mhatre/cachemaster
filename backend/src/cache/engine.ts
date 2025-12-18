import { LRUPolicy } from './eviction-policies/lru';
import { LFUPolicy } from './eviction-policies/lfu';
import { FIFOPolicy } from './eviction-policies/fifo';
import { EvictionPolicy } from './eviction-policies/types';
import { StatisticsTracker } from './statistics';
import config from '../config';
import logger from '../utils/logger';

export interface CacheEntry<T = any> {
  value: T;
  expiresAt?: number; // Timestamp when entry expires
  size: number; // Approximate memory size in bytes
}

export interface SetOptions {
  ttl?: number; // Time to live in milliseconds
}

export interface CacheConfig {
  maxMemoryMB?: number;
  maxKeys?: number;
  evictionPolicy?: 'LRU' | 'LFU' | 'FIFO';
}

export class CacheEngine {
  private store: Map<string, CacheEntry>;
  private evictionPolicy: EvictionPolicy<string, CacheEntry>;
  private stats: StatisticsTracker;
  private maxMemoryBytes: number;
  private currentMemoryBytes: number;
  private memoryThreshold: number; // 90% of max memory
  private cacheConfig: Required<CacheConfig>;

  constructor(overrideConfig?: CacheConfig) {
    this.store = new Map();
    this.stats = new StatisticsTracker();

    // Merge config with overrides for testing
    this.cacheConfig = {
      maxMemoryMB: config.maxMemoryMB,
      maxKeys: config.maxKeys,
      evictionPolicy: config.evictionPolicy,
      ...overrideConfig,
    };

    this.maxMemoryBytes = this.cacheConfig.maxMemoryMB * 1024 * 1024; // Convert MB to bytes
    this.currentMemoryBytes = 0;
    this.memoryThreshold = Math.floor(this.maxMemoryBytes * 0.9);

    // Initialize eviction policy based on config
    this.evictionPolicy = this.createEvictionPolicy();

    logger.info('Cache engine initialized', {
      evictionPolicy: this.cacheConfig.evictionPolicy,
      maxMemoryMB: this.cacheConfig.maxMemoryMB,
      maxKeys: this.cacheConfig.maxKeys,
    });
  }

  get(key: string): any | null {
    const entry = this.store.get(key);

    if (!entry) {
      this.stats.recordMiss();
      return null;
    }

    // Check if entry has expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      // Remove expired entry
      this.delete(key);
      this.stats.recordExpiration();
      this.stats.recordMiss();
      return null;
    }

    // Update eviction policy (marks as recently used)
    this.evictionPolicy.get(key);

    this.stats.recordHit();
    return entry.value;
  }

  set(key: string, value: any, options: SetOptions = {}): boolean {
    const now = Date.now();
    const expiresAt = options.ttl ? now + options.ttl : undefined;

    // Calculate approximate memory size of the entry
    const entrySize = this.calculateEntrySize(key, value);

    // Check if we need to make room for this entry
    if (this.currentMemoryBytes + entrySize > this.memoryThreshold) {
      this.enforceMemoryLimit(entrySize);
    }

    const existingEntry = this.store.get(key);
    if (existingEntry) {
      // Update existing entry
      this.currentMemoryBytes -= existingEntry.size;
      existingEntry.value = value;
      existingEntry.expiresAt = expiresAt;
      existingEntry.size = entrySize;
      this.currentMemoryBytes += entrySize;

      // Update eviction policy
      this.evictionPolicy.set(key, existingEntry);
    } else {
      // Create new entry
      const entry: CacheEntry = {
        value,
        expiresAt,
        size: entrySize,
      };

      this.store.set(key, entry);
      this.currentMemoryBytes += entrySize;

      // Add to eviction policy (may trigger eviction)
      const evictedKey = this.evictionPolicy.set(key, entry);
      if (evictedKey) {
        // Remove evicted entry from store
        const evictedEntry = this.store.get(evictedKey);
        if (evictedEntry) {
          this.currentMemoryBytes -= evictedEntry.size;
          this.store.delete(evictedKey);
          this.stats.recordEviction();
        }
      }
    }

    return true;
  }

  delete(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;

    this.currentMemoryBytes -= entry.size;
    this.store.delete(key);
    this.evictionPolicy.delete(key);

    return true;
  }

  exists(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key);
      this.stats.recordExpiration();
      return false;
    }

    return true;
  }

  increment(key: string, amount: number = 1): number {
    const currentValue = this.get(key);

    if (currentValue === null) {
      // Key doesn't exist, set to increment amount
      this.set(key, amount);
      return amount;
    }

    if (typeof currentValue !== 'number') {
      throw new Error('Cannot increment non-numeric value');
    }

    const newValue = currentValue + amount;
    this.set(key, newValue);
    return newValue;
  }

  updateTTL(key: string, ttl: number): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;

    entry.expiresAt = Date.now() + ttl;
    return true;
  }

  clear(): void {
    this.store.clear();
    this.evictionPolicy.clear();
    this.currentMemoryBytes = 0;
  }

  getStats() {
    return this.stats.getStats(this.store.size, this.currentMemoryBytes);
  }

  resetStats(): void {
    this.stats.reset();
  }

  // Get all keys (for listing)
  keys(): string[] {
    return Array.from(this.store.keys());
  }

  // Batch operations
  getMultiple(keys: string[]): { [key: string]: any } {
    const result: { [key: string]: any } = {};
    for (const key of keys) {
      const value = this.get(key);
      if (value !== null) {
        result[key] = value;
      }
    }
    return result;
  }

  setMultiple(entries: Array<{ key: string; value: any; ttl?: number }>): boolean {
    for (const entry of entries) {
      this.set(entry.key, entry.value, { ttl: entry.ttl });
    }
    return true;
  }

  deleteMultiple(keys: string[]): string[] {
    const deletedKeys: string[] = [];
    for (const key of keys) {
      if (this.delete(key)) {
        deletedKeys.push(key);
      }
    }
    return deletedKeys;
  }

  // Cleanup expired entries
  cleanup(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.delete(key);
        this.stats.recordExpiration();
        cleaned++;
      }
    }

    return cleaned;
  }

  // Get memory usage percentage
  getMemoryUsagePercent(): number {
    return Math.round((this.currentMemoryBytes / this.maxMemoryBytes) * 10000) / 100;
  }

  private createEvictionPolicy(): EvictionPolicy<string, CacheEntry> {
    const capacity = this.cacheConfig.maxKeys;

    switch (this.cacheConfig.evictionPolicy) {
      case 'LRU':
        return new LRUPolicy(capacity);
      case 'LFU':
        return new LFUPolicy(capacity);
      case 'FIFO':
        return new FIFOPolicy(capacity);
      default:
        logger.warn(`Unknown eviction policy: ${this.cacheConfig.evictionPolicy}, defaulting to LRU`);
        return new LRUPolicy(capacity);
    }
  }

  private calculateEntrySize(key: string, value: any): number {
    // Rough estimation: key size + value size + overhead
    const keySize = Buffer.byteLength(key, 'utf8');
    const valueSize = this.estimateValueSize(value);
    const overhead = 64; // Fixed overhead per entry (pointers, timestamps, etc.)
    return keySize + valueSize + overhead;
  }

  private estimateValueSize(value: any): number {
    if (value === null || value === undefined) return 8;
    if (typeof value === 'boolean') return 1;
    if (typeof value === 'number') return 8;
    if (typeof value === 'string') return Buffer.byteLength(value, 'utf8');
    if (Array.isArray(value)) {
      return value.reduce((size, item) => size + this.estimateValueSize(item), 16); // 16 bytes array overhead
    }
    if (typeof value === 'object') {
      let size = 16; // Object overhead
      for (const [key, val] of Object.entries(value)) {
        size += Buffer.byteLength(key, 'utf8') + this.estimateValueSize(val);
      }
      return size;
    }
    return 16; // Default fallback
  }

  private enforceMemoryLimit(requiredSpace: number): void {
    // Keep evicting until we have enough space
    while (this.currentMemoryBytes + requiredSpace > this.memoryThreshold && this.store.size > 0) {
      const evictedKey = this.evictOne();
      if (!evictedKey) break; // No more items to evict
    }
  }

  private evictOne(): string | undefined {
    // Use eviction policy to determine which key to evict
    const keyToEvict = this.evictionPolicy.evict();
    if (!keyToEvict) return undefined;

    const entry = this.store.get(keyToEvict);
    if (entry) {
      this.currentMemoryBytes -= entry.size;
      this.store.delete(keyToEvict);
      this.stats.recordEviction();
      return keyToEvict;
    }

    return undefined;
  }
}
