import { FIFOPolicy } from '../eviction-policies/fifo';

describe('FIFOPolicy', () => {
  let policy: FIFOPolicy<string, any>;

  beforeEach(() => {
    policy = new FIFOPolicy(3);
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

  describe('FIFO Eviction Logic', () => {
    test('should evict oldest item when capacity is exceeded', () => {
      policy.set('first', 'value1');  // Queue: first
      policy.set('second', 'value2'); // Queue: first, second
      policy.set('third', 'value3');  // Queue: first, second, third

      // Add fourth, should evict 'first' (oldest)
      const evicted = policy.set('fourth', 'value4');
      expect(evicted).toBe('first');
      expect(policy.size()).toBe(3);
      expect(policy.get('first')).toBeUndefined();
      expect(policy.get('second')).toBe('value2');
      expect(policy.get('third')).toBe('value3');
      expect(policy.get('fourth')).toBe('value4');
    });

    test('should maintain insertion order', () => {
      policy.set('a', 'valueA');
      policy.set('b', 'valueB');
      policy.set('c', 'valueC');

      // Access order doesn't matter in FIFO
      policy.get('b');
      policy.get('a');
      policy.get('c');

      // Still evicts 'a' (first inserted)
      const evicted = policy.set('d', 'valueD');
      expect(evicted).toBe('a');
    });

    test('should update existing key without changing position', () => {
      policy.set('a', 'valueA');
      policy.set('b', 'valueB');
      policy.set('c', 'valueC');

      // Update 'a' - should not change its position
      const evicted = policy.set('a', 'newValueA');
      expect(evicted).toBeUndefined();
      expect(policy.size()).toBe(3);

      // Add 'd' - should still evict 'a' (still first)
      const evicted2 = policy.set('d', 'valueD');
      expect(evicted2).toBe('a');
    });
  });

  describe('Edge Cases', () => {
    test('should handle capacity of 1', () => {
      const smallPolicy = new FIFOPolicy<string, any>(1);
      smallPolicy.set('key1', 'value1');
      expect(smallPolicy.size()).toBe(1);

      const evicted = smallPolicy.set('key2', 'value2');
      expect(evicted).toBe('key1');
      expect(smallPolicy.size()).toBe(1);
      expect(smallPolicy.get('key2')).toBe('value2');
    });

    test('should handle capacity of 0', () => {
      const zeroPolicy = new FIFOPolicy<string, any>(0);
      const evicted = zeroPolicy.set('key1', 'value1');
      expect(evicted).toBeUndefined();
      expect(zeroPolicy.size()).toBe(0);
    });

    test('should handle deletion from middle of queue', () => {
      policy.set('a', 'valueA'); // Queue: a
      policy.set('b', 'valueB'); // Queue: a, b
      policy.set('c', 'valueC'); // Queue: a, b, c

      policy.delete('b'); // Queue: a, c

      // Add d - should not evict since we're under capacity (2 < 3)
      const evicted = policy.set('d', 'valueD');
      expect(evicted).toBeUndefined();
      expect(policy.has('a')).toBe(true);
      expect(policy.has('c')).toBe(true);
      expect(policy.has('d')).toBe(true);
      expect(policy.size()).toBe(3);
    });

    test('should handle deletion of head', () => {
      policy.set('a', 'valueA');
      policy.set('b', 'valueB');
      policy.set('c', 'valueC');

      policy.delete('a'); // Queue: b, c

      // Add d - should not evict since we're under capacity
      const evicted = policy.set('d', 'valueD');
      expect(evicted).toBeUndefined();
      expect(policy.has('b')).toBe(true);
      expect(policy.has('c')).toBe(true);
      expect(policy.has('d')).toBe(true);
    });

    test('should handle deletion of tail', () => {
      policy.set('a', 'valueA');
      policy.set('b', 'valueB');
      policy.set('c', 'valueC');

      policy.delete('c'); // Queue: a, b

      // Add d - should not evict since we're under capacity
      const evicted = policy.set('d', 'valueD');
      expect(evicted).toBeUndefined();
      expect(policy.has('a')).toBe(true);
      expect(policy.has('b')).toBe(true);
      expect(policy.has('d')).toBe(true);
    });
  });

  describe('Complex Scenarios', () => {
    test('should handle mixed operations correctly', () => {
      policy.set('a', 'valueA'); // Queue: a
      policy.set('b', 'valueB'); // Queue: a, b
      policy.set('c', 'valueC'); // Queue: a, b, c

      // Delete middle element
      policy.delete('b'); // Queue: a, c

      // Add d - should not evict (2 -> 3, under capacity)
      policy.set('d', 'valueD');
      expect(policy.has('a')).toBe(true);
      expect(policy.has('c')).toBe(true);
      expect(policy.has('d')).toBe(true);

      // Add e - should not evict (3 -> 4, exceeds capacity)
      const evicted = policy.set('e', 'valueE');
      expect(evicted).toBe('a'); // evict oldest
      expect(policy.has('a')).toBe(false);
      expect(policy.has('c')).toBe(true);
      expect(policy.has('d')).toBe(true);
      expect(policy.has('e')).toBe(true);
    });

    test('should maintain correct order after multiple deletions', () => {
      policy.set('1', 'a'); // Queue: 1
      policy.set('2', 'b'); // Queue: 1, 2
      policy.set('3', 'c'); // Queue: 1, 2, 3

      // Delete 2 and 3
      policy.delete('2');
      policy.delete('3');

      // Queue should be: 1
      expect(policy.size()).toBe(1);

      // Add 4 - should not evict (1 -> 2, under capacity)
      const evicted = policy.set('4', 'd');
      expect(evicted).toBeUndefined();
      expect(policy.has('1')).toBe(true);
      expect(policy.has('4')).toBe(true);

      // Add 5 - should not evict (2 -> 3, at capacity)
      const evicted2 = policy.set('5', 'e');
      expect(evicted2).toBeUndefined();
      expect(policy.has('1')).toBe(true);
      expect(policy.has('4')).toBe(true);
      expect(policy.has('5')).toBe(true);
    });
  });

  describe('Keys Method', () => {
    test('should return keys in correct order', () => {
      policy.set('first', '1');
      policy.set('second', '2');
      policy.set('third', '3');

      const keys = policy.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('first');
      expect(keys).toContain('second');
      expect(keys).toContain('third');
    });

    test('should return empty array when empty', () => {
      expect(policy.keys()).toEqual([]);
    });

    test('should return remaining keys after deletions', () => {
      policy.set('a', '1');
      policy.set('b', '2');
      policy.set('c', '3');

      policy.delete('b');
      const keys = policy.keys();
      expect(keys).toHaveLength(2);
      expect(keys).toContain('a');
      expect(keys).toContain('c');
    });
  });
});
