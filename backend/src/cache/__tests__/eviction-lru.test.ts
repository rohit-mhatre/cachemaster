import { LRUPolicy } from '../eviction-policies/lru';

describe('LRUPolicy', () => {
  let policy: LRUPolicy<string, any>;

  beforeEach(() => {
    policy = new LRUPolicy(3);
  });

  describe('Basic Operations', () => {
    test('should store and retrieve values', () => {
      policy.set('key1', 'value1');
      expect(policy.get('key1')).toBe('value1');
    });

    test('should return undefined for non-existent keys', () => {
      expect(policy.get('nonexistent')).toBeUndefined();
    });

    test('should delete existing keys', () => {
      policy.set('key1', 'value1');
      expect(policy.delete('key1')).toBe(true);
      expect(policy.get('key1')).toBeUndefined();
    });

    test('should return false when deleting non-existent keys', () => {
      expect(policy.delete('nonexistent')).toBe(false);
    });

    test('should check existence of keys', () => {
      policy.set('key1', 'value1');
      expect(policy.has('key1')).toBe(true);
      expect(policy.has('nonexistent')).toBe(false);
    });

    test('should return correct size', () => {
      expect(policy.size()).toBe(0);
      policy.set('key1', 'value1');
      expect(policy.size()).toBe(1);
      policy.set('key2', 'value2');
      expect(policy.size()).toBe(2);
    });

    test('should return all keys', () => {
      policy.set('key1', 'value1');
      policy.set('key2', 'value2');
      const keys = policy.keys();
      expect(keys).toHaveLength(2);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });

    test('should clear all entries', () => {
      policy.set('key1', 'value1');
      policy.set('key2', 'value2');
      policy.clear();
      expect(policy.size()).toBe(0);
      expect(policy.get('key1')).toBeUndefined();
      expect(policy.get('key2')).toBeUndefined();
    });
  });

  describe('LRU Eviction Logic', () => {
    test('should evict least recently used item when capacity is exceeded', () => {
      policy.set('key1', 'value1'); // LRU: key1
      policy.set('key2', 'value2'); // LRU: key1, key2
      policy.set('key3', 'value3'); // LRU: key1, key2, key3

      // Access key1 to make it most recently used
      policy.get('key1'); // LRU: key2, key3, key1

      // Add key4, should evict key2 (LRU)
      const evicted = policy.set('key4', 'value4');
      expect(evicted).toBe('key2');
      expect(policy.size()).toBe(3);
      expect(policy.get('key2')).toBeUndefined();
      expect(policy.get('key1')).toBe('value1');
      expect(policy.get('key3')).toBe('value3');
      expect(policy.get('key4')).toBe('value4');
    });

    test('should update existing key without eviction', () => {
      policy.set('key1', 'value1');
      policy.set('key2', 'value2');
      policy.set('key3', 'value3');

      // Update existing key should not trigger eviction
      const evicted = policy.set('key1', 'newValue1');
      expect(evicted).toBeUndefined();
      expect(policy.size()).toBe(3);
      expect(policy.get('key1')).toBe('newValue1');
    });

    test('should handle access pattern correctly', () => {
      policy.set('a', 'valueA');
      policy.set('b', 'valueB');
      policy.set('c', 'valueC');

      // Access 'a' and 'b'
      policy.get('a');
      policy.get('b');

      // Add 'd', should evict 'c' (least recently used)
      policy.set('d', 'valueD');
      expect(policy.has('c')).toBe(false);
      expect(policy.has('a')).toBe(true);
      expect(policy.has('b')).toBe(true);
      expect(policy.has('d')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle capacity of 1', () => {
      const smallPolicy = new LRUPolicy<string, any>(1);
      smallPolicy.set('key1', 'value1');
      expect(smallPolicy.size()).toBe(1);

      const evicted = smallPolicy.set('key2', 'value2');
      expect(evicted).toBe('key1');
      expect(smallPolicy.size()).toBe(1);
      expect(smallPolicy.get('key1')).toBeUndefined();
      expect(smallPolicy.get('key2')).toBe('value2');
    });

    test('should handle capacity of 0', () => {
      const zeroPolicy = new LRUPolicy<string, any>(0);
      const evicted = zeroPolicy.set('key1', 'value1');
      expect(evicted).toBeUndefined(); // No eviction needed for capacity 0
      expect(zeroPolicy.size()).toBe(0);
      expect(zeroPolicy.get('key1')).toBeUndefined();
    });

    test('should handle duplicate keys correctly', () => {
      policy.set('key1', 'value1');
      policy.set('key2', 'value2');
      policy.set('key1', 'newValue1'); // Update existing

      expect(policy.size()).toBe(2);
      expect(policy.get('key1')).toBe('newValue1');
      expect(policy.get('key2')).toBe('value2');
    });

    test('should handle deletion of accessed keys', () => {
      policy.set('key1', 'value1');
      policy.set('key2', 'value2');

      policy.get('key1'); // Make key1 most recently used
      policy.delete('key1');

      expect(policy.size()).toBe(1);
      expect(policy.get('key1')).toBeUndefined();
      expect(policy.get('key2')).toBe('value2');
    });
  });
});
