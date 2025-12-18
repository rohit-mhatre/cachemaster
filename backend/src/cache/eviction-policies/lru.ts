import { EvictionPolicy } from './types';

interface LRUNode<K, V> {
  key: K;
  value: V;
  prev: LRUNode<K, V> | null;
  next: LRUNode<K, V> | null;
}

export class LRUPolicy<K, V> implements EvictionPolicy<K, V> {
  private capacity: number;
  private cache: Map<K, LRUNode<K, V>>;
  private head: LRUNode<K, V> | null;
  private tail: LRUNode<K, V> | null;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
    this.head = null;
    this.tail = null;
  }

  get(key: K): V | undefined {
    const node = this.cache.get(key);
    if (!node) return undefined;

    // Move accessed node to head (most recently used)
    this.moveToHead(node);
    return node.value;
  }

  set(key: K, value: V): K | undefined {
    let evictedKey: K | undefined;
    const existingNode = this.cache.get(key);

    if (existingNode) {
      // Update existing node
      existingNode.value = value;
      this.moveToHead(existingNode);
    } else {
      // Check if we need to evict
      if (this.capacity > 0 && this.cache.size >= this.capacity) {
        evictedKey = this.evictLRU();
      }

      // Don't add if capacity is 0 and we're not updating existing
      if (this.capacity === 0) {
        return undefined;
      }

      // Add new node
      const newNode: LRUNode<K, V> = {
        key,
        value,
        prev: null,
        next: null,
      };

      this.cache.set(key, newNode);
      this.addToHead(newNode);
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

  private moveToHead(node: LRUNode<K, V>): void {
    this.removeNode(node);
    this.addToHead(node);
  }

  private addToHead(node: LRUNode<K, V>): void {
    node.next = this.head;
    node.prev = null;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  private removeNode(node: LRUNode<K, V>): void {
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
    return this.evictLRU();
  }

  private evictLRU(): K | undefined {
    if (!this.tail) return undefined;

    const evictedKey = this.tail.key;
    this.removeNode(this.tail);
    this.cache.delete(evictedKey);

    return evictedKey;
  }
}
