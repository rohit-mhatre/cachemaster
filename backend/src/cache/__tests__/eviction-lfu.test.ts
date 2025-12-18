import { LFUPolicy } from '../eviction-policies/lfu';

describe('LFUPolicy', () => {
  let policy: LFUPolicy<string, any>;

  beforeEach(() => {
    policy = new LFUPolicy(3);
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

    test('should clear all entries', () => {
      policy.set('key1', 'value1');
      policy.set('key2', 'value2');
      policy.clear();
      expect(policy.size()).toBe(0);
      expect(policy.get('key1')).toBeUndefined();
      expect(policy.get('key2')).toBeUndefined();
    });
  });

  describe('LFU Eviction Logic', () => {
    test('should increase frequency on access', () => {
      policy.set('key1', 'value1');
      policy.set('key2', 'value2');
      policy.set('key3', 'value3');

      // Access key1 multiple times
      policy.get('key1'); // freq: 2
      policy.get('key1'); // freq: 3
      policy.get('key1'); // freq: 4

      // Access key2 once
      policy.get('key2'); // freq: 2

      // key3 has freq: 1, should be evicted first
      const evicted = policy.set('key4', 'value4');
      expect(evicted).toBe('key3');
      expect(policy.has('key3')).toBe(false);
      expect(policy.has('key1')).toBe(true);
      expect(policy.has('key2')).toBe(true);
      expect(policy.has('key4')).toBe(true);
    });

    test('should evict least frequently used when frequencies are equal', () => {
      policy.set('a', 'valueA');
      policy.set('b', 'valueB');
      policy.set('c', 'valueC');

      // All have frequency 1, but 'a' was inserted first in frequency 1 list
      const evicted = policy.set('d', 'valueD');
      expect(evicted).toBe('a'); // Should evict the least recently used in lowest frequency
    });

    test('should handle frequency increases correctly', () => {
      policy.set('key1', 'value1');
      policy.set('key2', 'value2');
      policy.set('key3', 'value3');

      // key1: freq 2, key2: freq 1, key3: freq 1
      policy.get('key1');

      // Add key4, should evict key2 or key3 (both freq 1)
      const evicted = policy.set('key4', 'value4');
      expect(['key2', 'key3']).toContain(evicted);
      expect(policy.has(evicted!)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle capacity of 1', () => {
      const smallPolicy = new LFUPolicy<string, any>(1);
      smallPolicy.set('key1', 'value1');
      expect(smallPolicy.size()).toBe(1);

      const evicted = smallPolicy.set('key2', 'value2');
      expect(evicted).toBe('key1');
      expect(smallPolicy.size()).toBe(1);
      expect(smallPolicy.get('key2')).toBe('value2');
    });

    test('should handle capacity of 0', () => {
      const zeroPolicy = new LFUPolicy<string, any>(0);
      const evicted = zeroPolicy.set('key1', 'value1');
      expect(evicted).toBeUndefined();
      expect(zeroPolicy.size()).toBe(0);
    });

    test('should handle deletion and re-insertion', () => {
      policy.set('key1', 'value1');
      policy.set('key2', 'value2');

      policy.get('key1'); // freq: 2
      policy.delete('key1');

      // Re-insert key1, should start with freq 1
      policy.set('key1', 'newValue1');
      policy.set('key3', 'value3');

      // key1 and key2 both have freq 1, but key2 was inserted first
      const evicted = policy.set('key4', 'value4');
      expect(evicted).toBe('key2');
    });

    test('should handle multiple accesses correctly', () => {
      policy.set('a', 'valueA');
      policy.set('b', 'valueB');
      policy.set('c', 'valueC');

      // a: 3, b: 2, c: 1
      policy.get('a'); policy.get('a'); policy.get('a');
      policy.get('b'); policy.get('b');
      policy.get('c');

      // Should evict c (lowest frequency)
      const evicted = policy.set('d', 'valueD');
      expect(evicted).toBe('c');
    });
  });

  describe('Complex Scenarios', () => {
    test('should handle mixed operations correctly', () => {
      // Set up initial state
      policy.set('a', 'valueA'); // freq 1
      policy.set('b', 'valueB'); // freq 1
      policy.set('c', 'valueC'); // freq 1

      // Access pattern: a(3), b(2), c(1)
      policy.get('a'); policy.get('a'); policy.get('a');
      policy.get('b'); policy.get('b');
      policy.get('c');

      // Update existing key
      policy.set('a', 'newValueA'); // Should increase frequency

      // Evict - should remove c
      const evicted1 = policy.set('d', 'valueD');
      expect(evicted1).toBe('c');

      // Delete b
      policy.delete('b');

      // Add e - should not evict since we're under capacity
      const evicted2 = policy.set('e', 'valueE');
      expect(evicted2).toBeUndefined();

      // Final state check
      expect(policy.size()).toBe(3);
      expect(policy.has('a')).toBe(true);
      expect(policy.has('d')).toBe(true);
      expect(policy.has('e')).toBe(true);
    });
  });
});
