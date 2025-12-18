export interface CacheStats {
  totalKeys: number;
  hits: number;
  misses: number;
  hitRate: number;
  memoryUsage: number;
  evictions: number;
  expirations: number;
  opsPerSecond: number;
}

export class StatisticsTracker {
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private expirations = 0;
  private operations: number[] = [];
  private operationWindow = 10000; // 10 seconds window for ops/sec calculation

  recordHit(): void {
    this.hits++;
    this.recordOperation();
  }

  recordMiss(): void {
    this.misses++;
    this.recordOperation();
  }

  recordEviction(): void {
    this.evictions++;
  }

  recordExpiration(): void {
    this.expirations++;
  }

  private recordOperation(): void {
    const now = Date.now();
    this.operations.push(now);
    // Remove operations older than the window
    const cutoff = now - this.operationWindow;
    this.operations = this.operations.filter((time) => time > cutoff);
  }

  getStats(totalKeys: number, memoryUsage: number): CacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;
    const opsPerSecond = this.operations.length / (this.operationWindow / 1000);

    return {
      totalKeys,
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(hitRate * 10000) / 100, // Percentage with 2 decimal places
      memoryUsage,
      evictions: this.evictions,
      expirations: this.expirations,
      opsPerSecond: Math.round(opsPerSecond),
    };
  }

  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.expirations = 0;
    this.operations = [];
  }
}
