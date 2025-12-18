import { EvictionPolicy } from './types';

interface FIFONode<K, V> {
  key: K;
  value: V;
  prev: FIFONode<K, V> | null;
  next: FIFONode<K, V> | null;
}

export class FIFOPolicy<K, V> implements EvictionPolicy<K, V> {
  private capacity: number;
  private cache: Map<K, FIFONode<K, V>>;
  private head: FIFONode<K, V> | null; // Oldest item (first to evict)
  private tail: FIFONode<K, V> | null; // Newest item

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
    this.head = null;
    this.tail = null;
  }

  get(key: K): V | undefined {
    const node = this.cache.get(key);
    return node ? node.value : undefined;
  }

  set(key: K, value: V): K | undefined {
    let evictedKey: K | undefined;
    const existingNode = this.cache.get(key);

    if (existingNode) {
      // Update existing node value
      existingNode.value = value;
    } else {
      // Check if we need to evict
      if (this.capacity > 0 && this.cache.size >= this.capacity) {
        evictedKey = this.evictFIFO();
      }

      // Don't add if capacity is 0
      if (this.capacity === 0) {
        return undefined;
      }

      // Add new node to tail (newest)
      const newNode: FIFONode<K, V> = {
        key,
        value,
        prev: null,
        next: null,
      };

      this.cache.set(key, newNode);
      this.addToTail(newNode);
    }

    return evictedKey;
  }

  delete(key: K): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    this.removeNode(node);
    this.cache.delete(key);
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
    this.head = null;
    this.tail = null;
  }

  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  private addToTail(node: FIFONode<K, V>): void {
    node.prev = this.tail;
    node.next = null;

    if (this.tail) {
      this.tail.next = node;
    }
    this.tail = node;

    if (!this.head) {
      this.head = node;
    }
  }

  private removeNode(node: FIFONode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  evict(): K | undefined {
    return this.evictFIFO();
  }

  private evictFIFO(): K | undefined {
    if (!this.head) return undefined;

    const evictedKey = this.head.key;
    this.removeNode(this.head);
    this.cache.delete(evictedKey);

    return evictedKey;
  }
}
