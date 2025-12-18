import { EvictionPolicy } from './types';

interface LFUNode<K, V> {
  key: K;
  value: V;
  frequency: number;
  prev: LFUNode<K, V> | null;
  next: LFUNode<K, V> | null;
}

interface FrequencyList<K, V> {
  frequency: number;
  head: LFUNode<K, V> | null;
  tail: LFUNode<K, V> | null;
}

export class LFUPolicy<K, V> implements EvictionPolicy<K, V> {
  private capacity: number;
  private cache: Map<K, LFUNode<K, V>>;
  private frequencyMap: Map<number, FrequencyList<K, V>>;
  private minFrequency: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
    this.frequencyMap = new Map();
    this.minFrequency = 0;
  }

  get(key: K): V | undefined {
    const node = this.cache.get(key);
    if (!node) return undefined;

    // Increase frequency and move to appropriate frequency list
    this.increaseFrequency(node);
    return node.value;
  }

  set(key: K, value: V): K | undefined {
    let evictedKey: K | undefined;
    const existingNode = this.cache.get(key);

    if (existingNode) {
      // Update existing node value
      existingNode.value = value;
      // Increase frequency
      this.increaseFrequency(existingNode);
    } else {
      // Check if we need to evict
      if (this.capacity > 0 && this.cache.size >= this.capacity) {
        evictedKey = this.evictLFU();
      }

      // Don't add if capacity is 0
      if (this.capacity === 0) {
        return undefined;
      }

      // Create new node with frequency 1
      const newNode: LFUNode<K, V> = {
        key,
        value,
        frequency: 1,
        prev: null,
        next: null,
      };

      this.cache.set(key, newNode);
      this.addToFrequencyList(newNode, 1);

      if (this.minFrequency === 0 || this.minFrequency > 1) {
        this.minFrequency = 1;
      }
    }

    return evictedKey;
  }

  delete(key: K): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    this.removeFromFrequencyList(node);
    this.cache.delete(key);

    // Update minFrequency if this was the last node in the minFrequency list
    if (this.minFrequency > 0 && !this.frequencyMap.has(this.minFrequency)) {
      this.minFrequency++;
    }

    return true;
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
    this.frequencyMap.clear();
    this.minFrequency = 0;
  }

  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  private increaseFrequency(node: LFUNode<K, V>): void {
    const oldFrequency = node.frequency;
    const newFrequency = oldFrequency + 1;

    this.removeFromFrequencyList(node);
    node.frequency = newFrequency;
    this.addToFrequencyList(node, newFrequency);

    // Update minFrequency if needed
    if (oldFrequency === this.minFrequency && !this.frequencyMap.has(oldFrequency)) {
      this.minFrequency = newFrequency;
    }
  }

  private addToFrequencyList(node: LFUNode<K, V>, frequency: number): void {
    if (!this.frequencyMap.has(frequency)) {
      this.frequencyMap.set(frequency, {
        frequency,
        head: null,
        tail: null,
      });
    }

    const freqList = this.frequencyMap.get(frequency)!;

    // Add to end of frequency list (most recently used in this frequency)
    node.prev = freqList.tail;
    node.next = null;

    if (freqList.tail) {
      freqList.tail.next = node;
    }
    freqList.tail = node;

    if (!freqList.head) {
      freqList.head = node;
    }
  }

  private removeFromFrequencyList(node: LFUNode<K, V>): void {
    const freqList = this.frequencyMap.get(node.frequency);
    if (!freqList) return;

    if (node.prev) {
      node.prev.next = node.next;
    } else {
      freqList.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      freqList.tail = node.prev;
    }

    // Remove frequency list if empty
    if (!freqList.head) {
      this.frequencyMap.delete(node.frequency);
    }
  }

  evict(): K | undefined {
    return this.evictLFU();
  }

  private evictLFU(): K | undefined {
    if (this.minFrequency === 0) return undefined;

    const freqList = this.frequencyMap.get(this.minFrequency);
    if (!freqList || !freqList.head) return undefined;

    // Evict the least recently used item in the lowest frequency list
    const evictedNode = freqList.head;
    const evictedKey = evictedNode.key;

    this.removeFromFrequencyList(evictedNode);
    this.cache.delete(evictedKey);

    return evictedKey;
  }
}
