export interface EvictionPolicy<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): K | undefined; // Returns evicted key if any
  delete(key: K): boolean;
  has(key: K): boolean;
  size(): number;
  clear(): void;
  keys(): K[];
  evict(): K | undefined; // Returns key to evict
}
