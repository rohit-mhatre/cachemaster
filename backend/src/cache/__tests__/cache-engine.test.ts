import { CacheEngine } from '../engine';

describe('CacheEngine', () => {
  let cache: CacheEngine;

  beforeEach(() => {
    // Use a test configuration with small limits
    cache = new CacheEngine({
      maxMemoryMB: 1, // 1MB
      maxKeys: 10,    // 10 keys max
      evictionPolicy: 'LRU'
    });
  });

  afterEach(() => {
    cache.clear();
  });

  describe('Basic Operations', () => {
    test('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    test('should return null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    test('should delete existing keys', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeNull();
    });

    test('should return false when deleting non-existent keys', () => {
      expect(cache.delete('nonexistent')).toBe(false);
    });

    test('should check existence of keys', () => {
      cache.set('key1', 'value1');
      expect(cache.exists('key1')).toBe(true);
      expect(cache.exists('nonexistent')).toBe(false);
    });

    test('should handle different value types', () => {
      cache.set('string', 'hello');
      cache.set('number', 42);
      cache.set('boolean', true);
      cache.set('object', { name: 'test' });
      cache.set('array', [1, 2, 3]);

      expect(cache.get('string')).toBe('hello');
      expect(cache.get('number')).toBe(42);
      expect(cache.get('boolean')).toBe(true);
      expect(cache.get('object')).toEqual({ name: 'test' });
      expect(cache.get('array')).toEqual([1, 2, 3]);
    });
  });

  describe('TTL Functionality', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should expire keys after TTL', () => {
      cache.set('key1', 'value1', { ttl: 1000 }); // 1 second
      expect(cache.get('key1')).toBe('value1');

      // Advance time by 1.1 seconds
      jest.advanceTimersByTime(1100);

      expect(cache.get('key1')).toBeNull();
      expect(cache.exists('key1')).toBe(false);
    });

    test('should not expire keys without TTL', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      // Advance time significantly
      jest.advanceTimersByTime(100000);

      expect(cache.get('key1')).toBe('value1');
    });

    test('should update TTL of existing keys', () => {
      cache.set('key1', 'value1', { ttl: 1000 });
      expect(cache.updateTTL('key1', 2000)).toBe(true);

      // Advance time by 1.5 seconds (should still exist)
      jest.advanceTimersByTime(1500);
      expect(cache.get('key1')).toBe('value1');

      // Advance another 1 second (should expire now)
      jest.advanceTimersByTime(1000);
      expect(cache.get('key1')).toBeNull();
    });

    test('should return false when updating TTL of non-existent key', () => {
      expect(cache.updateTTL('nonexistent', 1000)).toBe(false);
    });
  });

  describe('Increment Operations', () => {
    test('should increment existing numeric values', () => {
      cache.set('counter', 5);
      const result = cache.increment('counter', 3);
      expect(result).toBe(8);
      expect(cache.get('counter')).toBe(8);
    });

    test('should increment with default amount of 1', () => {
      cache.set('counter', 10);
      const result = cache.increment('counter');
      expect(result).toBe(11);
    });

    test('should set to increment amount if key does not exist', () => {
      const result = cache.increment('newcounter', 5);
      expect(result).toBe(5);
      expect(cache.get('newcounter')).toBe(5);
    });

    test('should throw error for non-numeric values', () => {
      cache.set('text', 'hello');
      expect(() => cache.increment('text')).toThrow('Cannot increment non-numeric value');
    });
  });

  describe('Batch Operations', () => {
    test('should set multiple entries', () => {
      const entries = [
        { key: 'key1', value: 'value1', ttl: 1000 },
        { key: 'key2', value: 'value2' },
        { key: 'key3', value: 42 }
      ];

      const result = cache.setMultiple(entries);
      expect(result).toBe(true);

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe(42);
    });

    test('should get multiple entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const result = cache.getMultiple(['key1', 'key3', 'nonexistent']);
      expect(result).toEqual({
        key1: 'value1',
        key3: 'value3'
      });
    });

    test('should delete multiple entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const deleted = cache.deleteMultiple(['key1', 'key3', 'nonexistent']);
      expect(deleted).toEqual(['key1', 'key3']);

      expect(cache.exists('key1')).toBe(false);
      expect(cache.exists('key2')).toBe(true);
      expect(cache.exists('key3')).toBe(false);
    });
  });

  describe('Statistics', () => {
    test('should track hits and misses', () => {
      cache.set('key1', 'value1');

      cache.get('key1'); // hit
      cache.get('key2'); // miss
      cache.get('key1'); // hit

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(66.67); // 2/(2+1) * 100
    });

    test('should reset statistics', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key2');

      let stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);

      cache.resetStats();
      stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    test('should track evictions', () => {
      // Fill cache to capacity and force evictions
      for (let i = 0; i < 15; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      const stats = cache.getStats();
      // With maxKeys=10, adding 15 items should cause 5 evictions
      expect(stats.evictions).toBe(5);
      // Cache should have exactly 10 items
      expect(cache.keys()).toHaveLength(10);
    });
  });

  describe('Memory Management', () => {
    test('should enforce memory limits', () => {
      // Test with current cache that has 1MB limit
      // Add many large entries to trigger memory management
      let totalAdded = 0;
      for (let i = 0; i < 50; i++) {
        cache.set(`largeKey${i}`, 'x'.repeat(1000)); // 1000 byte values
        totalAdded++;
      }

      // Should have evicted some entries to stay within memory limits
      const stats = cache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
      expect(cache.getMemoryUsagePercent()).toBeLessThan(200); // Allow some tolerance
    });

    test('should calculate memory usage', () => {
      cache.set('small', 'x');
      cache.set('large', 'x'.repeat(100));

      const stats = cache.getStats();
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should cleanup expired keys', () => {
      cache.set('short', 'value1', { ttl: 1000 });
      cache.set('long', 'value2', { ttl: 5000 });

      expect(cache.cleanup()).toBe(0); // Nothing expired yet

      jest.advanceTimersByTime(2000);

      const cleaned = cache.cleanup();
      expect(cleaned).toBe(1);
      expect(cache.exists('short')).toBe(false);
      expect(cache.exists('long')).toBe(true);
    });
  });

  describe('Keys Listing', () => {
    test('should return all keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const keys = cache.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    test('should return empty array when cache is empty', () => {
      expect(cache.keys()).toEqual([]);
    });
  });

  describe('Clear Operation', () => {
    test('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.clear();

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.keys()).toEqual([]);
    });
  });
});
