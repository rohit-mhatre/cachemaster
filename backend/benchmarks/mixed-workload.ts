import { CacheEngine } from '../src/cache/engine';

function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

interface BenchmarkResult {
  totalOps: number;
  durationMs: number;
  opsPerSecond: number;
  avgLatency: number;
  hitRate?: number;
  evictions?: number;
}

function runWorkload(cache: CacheEngine, operations: Array<{ type: 'get' | 'set' | 'delete'; key: string; value?: any; ttl?: number }>): BenchmarkResult {
  const startTime = process.hrtime.bigint();
  let hits = 0;
  let misses = 0;

  for (const op of operations) {
    switch (op.type) {
      case 'get':
        const result = cache.get(op.key);
        if (result !== null) hits++;
        else misses++;
        break;
      case 'set':
        cache.set(op.key, op.value, op.ttl ? { ttl: op.ttl } : undefined);
        break;
      case 'delete':
        cache.delete(op.key);
        break;
    }
  }

  const endTime = process.hrtime.bigint();
  const durationMs = Number(endTime - startTime) / 1_000_000;
  const totalOps = operations.length;
  const opsPerSecond = Math.round((totalOps / durationMs) * 1000);
  const avgLatency = durationMs / totalOps;

  return {
    totalOps,
    durationMs,
    opsPerSecond,
    avgLatency,
    hitRate: (hits / (hits + misses)) * 100,
    evictions: cache.getStats().evictions
  };
}

async function runMixedWorkloadBenchmark(): Promise<void> {
  console.log('🚀 Running Mixed Workload Benchmark\n');

  const cache = new CacheEngine({
    maxMemoryMB: 512,
    maxKeys: 50000,
    evictionPolicy: 'LRU'
  });

  // Setup initial data
  console.log('📝 Setting up initial dataset...');
  for (let i = 0; i < 10000; i++) {
    cache.set(`initial_${i}`, `value_${i}`);
  }
  console.log('✅ Initial dataset ready\n');

  // Different workload patterns
  const workloads = [
    {
      name: 'Read-Heavy (80% GET, 15% SET, 5% DELETE)',
      ratios: { get: 0.8, set: 0.15, delete: 0.05 },
      totalOps: 10000
    },
    {
      name: 'Write-Heavy (20% GET, 70% SET, 10% DELETE)',
      ratios: { get: 0.2, set: 0.7, delete: 0.1 },
      totalOps: 10000
    },
    {
      name: 'Balanced (50% GET, 40% SET, 10% DELETE)',
      ratios: { get: 0.5, set: 0.4, delete: 0.1 },
      totalOps: 10000
    },
    {
      name: 'Cache Miss Heavy (90% GET on non-existent keys)',
      ratios: { get: 0.9, set: 0.1, delete: 0.0 },
      totalOps: 5000
    }
  ];

  console.log('📊 Mixed Workload Results:\n');

  for (const workload of workloads) {
    console.log(`🔄 ${workload.name}`);

    // Generate operations based on ratios
    const operations = [];
    let opCount = 0;

    for (let i = 0; i < workload.totalOps; i++) {
      const rand = Math.random();
      const key = `key_${Math.floor(Math.random() * 20000)}`; // Use wider range to create misses

      if (rand < workload.ratios.get) {
        operations.push({ type: 'get' as const, key });
      } else if (rand < workload.ratios.get + workload.ratios.set) {
        operations.push({
          type: 'set' as const,
          key: `new_key_${opCount++}`,
          value: `value_${opCount}_with_additional_data`
        });
      } else {
        operations.push({ type: 'delete' as const, key });
      }
    }

    // Run benchmark
    const result = runWorkload(cache, operations);

    console.log(`   Total Operations: ${formatNumber(result.totalOps)}`);
    console.log(`   Duration: ${formatTime(result.durationMs)}`);
    console.log(`   Throughput: ${formatNumber(result.opsPerSecond)} ops/sec`);
    console.log(`   Avg Latency: ${result.avgLatency.toFixed(4)}ms`);
    if (result.hitRate !== undefined) {
      console.log(`   Hit Rate: ${result.hitRate.toFixed(1)}%`);
    }
    if (result.evictions !== undefined && result.evictions > 0) {
      console.log(`   Evictions: ${formatNumber(result.evictions)}`);
    }
    console.log('');
  }

  cache.clear();
}

async function runScalabilityBenchmark(): Promise<void> {
  console.log('📈 Running Scalability Benchmark\n');

  const cacheSizes = [1000, 10000, 50000, 100000];

  console.log('📊 Cache Size Scalability:\n');

  for (const cacheSize of cacheSizes) {
    console.log(`📏 Cache Size: ${formatNumber(cacheSize)} keys`);

    const cache = new CacheEngine({
      maxMemoryMB: 512,
      maxKeys: cacheSize,
      evictionPolicy: 'LRU'
    });

    // Setup data (fill to 90% capacity)
    const setupSize = Math.floor(cacheSize * 0.9);
    for (let i = 0; i < setupSize; i++) {
      cache.set(`setup_${i}`, `value_${i}`);
    }

    // Benchmark operations
    const benchmarkOps = 5000;
    const operations = [];

    for (let i = 0; i < benchmarkOps; i++) {
      const key = `key_${Math.floor(Math.random() * cacheSize)}`;
      if (Math.random() < 0.7) {
        operations.push({ type: 'get' as const, key });
      } else {
        operations.push({
          type: 'set' as const,
          key: `set_key_${i}`,
          value: `set_value_${i}`
        });
      }
    }

    const result = runWorkload(cache, operations);

    console.log(`   Setup Size: ${formatNumber(setupSize)} keys`);
    console.log(`   Benchmark Ops: ${formatNumber(benchmarkOps)}`);
    console.log(`   Throughput: ${formatNumber(result.opsPerSecond)} ops/sec`);
    console.log(`   Avg Latency: ${result.avgLatency.toFixed(4)}ms`);
    console.log(`   Hit Rate: ${result.hitRate?.toFixed(1)}%`);
    console.log('');
  }
}

async function runTTLExpirationBenchmark(): Promise<void> {
  console.log('⏰ Running TTL Expiration Benchmark\n');

  const cache = new CacheEngine({
    maxMemoryMB: 512,
    maxKeys: 50000,
    evictionPolicy: 'LRU'
  });

  // Setup: Create keys with different TTL values
  console.log('📝 Setting up TTL test data...');
  const ttlValues = [1000, 5000, 30000, 300000]; // 1s, 5s, 30s, 5min
  const keysPerTTL = 1000;

  for (const ttl of ttlValues) {
    for (let i = 0; i < keysPerTTL; i++) {
      cache.set(`ttl_${ttl}_key_${i}`, `value_${ttl}_${i}`, { ttl });
    }
  }
  console.log('✅ TTL test data ready\n');

  // Benchmark GET operations on keys with different TTL states
  const scenarios = [
    { name: 'Fresh Keys (just set)', waitTime: 0 },
    { name: 'Keys nearing expiration (4s old)', waitTime: 4000 },
    { name: 'Mixed expired/fresh (10s old)', waitTime: 10000 },
  ];

  console.log('📊 TTL Performance Results:\n');

  for (const scenario of scenarios) {
    console.log(`⏰ ${scenario.name}`);

    // Wait for the scenario time
    if (scenario.waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, scenario.waitTime));
    }

    // Run GET operations
    const operations = [];
    for (let i = 0; i < 5000; i++) {
      const ttl = ttlValues[Math.floor(Math.random() * ttlValues.length)];
      const keyIndex = Math.floor(Math.random() * keysPerTTL);
      operations.push({
        type: 'get' as const,
        key: `ttl_${ttl}_key_${keyIndex}`
      });
    }

    const result = runWorkload(cache, operations);

    console.log(`   Operations: ${formatNumber(result.totalOps)}`);
    console.log(`   Throughput: ${formatNumber(result.opsPerSecond)} ops/sec`);
    console.log(`   Avg Latency: ${result.avgLatency.toFixed(4)}ms`);
    console.log(`   Hit Rate: ${result.hitRate?.toFixed(1)}%`);
    console.log('');
  }

  cache.clear();
}

// Run all benchmarks
async function main() {
  console.log('🎯 Cache Layer - Mixed Workload Performance Benchmark');
  console.log('=' .repeat(65));
  console.log('');

  try {
    await runMixedWorkloadBenchmark();
    console.log('-'.repeat(65));
    await runScalabilityBenchmark();
    console.log('-'.repeat(65));
    await runTTLExpirationBenchmark();

    console.log('✅ All benchmarks completed successfully!');
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { runMixedWorkloadBenchmark, runScalabilityBenchmark, runTTLExpirationBenchmark };
