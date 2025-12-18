import { CacheEngine } from '../src/cache/engine';

function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

async function runSetBenchmark(): Promise<void> {
  console.log('🚀 Running SET Operations Benchmark\n');

  const cache = new CacheEngine({
    maxMemoryMB: 512,
    maxKeys: 100000,
    evictionPolicy: 'LRU'
  });

  // Benchmark different payload sizes
  const payloadSizes = [
    { name: 'Small (50 bytes)', value: 'x'.repeat(50) },
    { name: 'Medium (500 bytes)', value: 'x'.repeat(500) },
    { name: 'Large (5KB)', value: 'x'.repeat(5000) },
  ];

  console.log('📊 SET Operations Results:\n');

  for (const payload of payloadSizes) {
    console.log(`📝 Payload: ${payload.name}`);

    // Clear cache for each test
    cache.clear();

    const iterations = 10000;
    const keys: string[] = Array.from({ length: iterations }, (_, i) => `key_${i}`);

    // Warm-up
    for (let i = 0; i < 100; i++) {
      cache.set(`warmup_${i}`, payload.value);
    }

    // Benchmark
    const startTime = process.hrtime.bigint();

    for (let i = 0; i < iterations; i++) {
      cache.set(keys[i], payload.value);
    }

    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    const opsPerSecond = Math.round((iterations / durationMs) * 1000);
    const avgLatency = durationMs / iterations;

    console.log(`   Operations: ${formatNumber(iterations)}`);
    console.log(`   Duration: ${formatTime(durationMs)}`);
    console.log(`   Throughput: ${formatNumber(opsPerSecond)} ops/sec`);
    console.log(`   Avg Latency: ${avgLatency.toFixed(4)}ms`);
    console.log('');
  }

  cache.clear();
}

async function runSetWithTTL(): Promise<void> {
  console.log('⏰ Running SET with TTL Benchmark\n');

  const cache = new CacheEngine({
    maxMemoryMB: 512,
    maxKeys: 100000,
    evictionPolicy: 'LRU'
  });

  const iterations = 5000;
  const ttlValues = [1000, 60000, 3600000]; // 1s, 1min, 1hour

  console.log('📊 SET with TTL Results:\n');

  for (const ttl of ttlValues) {
    console.log(`⏰ TTL: ${ttl}ms`);

    cache.clear();

    const startTime = process.hrtime.bigint();

    for (let i = 0; i < iterations; i++) {
      cache.set(`ttl_key_${i}`, `value_${i}`, { ttl });
    }

    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    const opsPerSecond = Math.round((iterations / durationMs) * 1000);
    const avgLatency = durationMs / iterations;

    console.log(`   Operations: ${formatNumber(iterations)}`);
    console.log(`   Duration: ${formatTime(durationMs)}`);
    console.log(`   Throughput: ${formatNumber(opsPerSecond)} ops/sec`);
    console.log(`   Avg Latency: ${avgLatency.toFixed(4)}ms`);
    console.log('');
  }

  cache.clear();
}

async function runConcurrentSetBenchmark(): Promise<void> {
  console.log('🔄 Running Concurrent SET Operations Benchmark\n');

  const cache = new CacheEngine({
    maxMemoryMB: 512,
    maxKeys: 100000,
    evictionPolicy: 'LRU'
  });

  const concurrencyLevels = [1, 10, 50, 100];
  const operationsPerWorker = 1000;

  console.log('📊 Concurrent SET Results:\n');

  for (const concurrency of concurrencyLevels) {
    console.log(`🔄 Concurrency Level: ${concurrency}`);

    cache.clear();

    const workers = Array.from({ length: concurrency }, (_, workerId) => {
      return async () => {
        const startTime = process.hrtime.bigint();

        for (let i = 0; i < operationsPerWorker; i++) {
          cache.set(`concurrent_key_${workerId}_${i}`, `value_${workerId}_${i}`);
        }

        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1_000_000;

        return { durationMs };
      };
    });

    const startTime = process.hrtime.bigint();
    await Promise.all(workers.map(w => w()));

    const endTime = process.hrtime.bigint();
    const totalDurationMs = Number(endTime - startTime) / 1_000_000;
    const totalOps = concurrency * operationsPerWorker;
    const opsPerSecond = Math.round((totalOps / totalDurationMs) * 1000);
    const avgLatency = totalDurationMs / totalOps;

    console.log(`   Total Operations: ${formatNumber(totalOps)}`);
    console.log(`   Duration: ${formatTime(totalDurationMs)}`);
    console.log(`   Throughput: ${formatNumber(opsPerSecond)} ops/sec`);
    console.log(`   Avg Latency: ${avgLatency.toFixed(4)}ms`);
    console.log('');
  }

  cache.clear();
}

async function runEvictionBenchmark(): Promise<void> {
  console.log('🔄 Running SET with Eviction Benchmark\n');

  const scenarios = [
    { name: 'LRU Policy', policy: 'LRU' as const },
    { name: 'LFU Policy', policy: 'LFU' as const },
    { name: 'FIFO Policy', policy: 'FIFO' as const },
  ];

  console.log('📊 Eviction Policy Comparison:\n');

  for (const scenario of scenarios) {
    console.log(`📋 ${scenario.name}`);

    const cache = new CacheEngine({
      maxMemoryMB: 10, // Small memory to trigger eviction
      maxKeys: 1000,
      evictionPolicy: scenario.policy
    });

    const iterations = 5000;

    const startTime = process.hrtime.bigint();

    for (let i = 0; i < iterations; i++) {
      cache.set(`evict_key_${i}`, `value_${i}_with_some_extra_data_to_fill_memory`);
    }

    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    const opsPerSecond = Math.round((iterations / durationMs) * 1000);
    const avgLatency = durationMs / iterations;

    const stats = cache.getStats();

    console.log(`   Operations: ${formatNumber(iterations)}`);
    console.log(`   Duration: ${formatTime(durationMs)}`);
    console.log(`   Throughput: ${formatNumber(opsPerSecond)} ops/sec`);
    console.log(`   Avg Latency: ${avgLatency.toFixed(4)}ms`);
    console.log(`   Evictions: ${formatNumber(stats.evictions)}`);
    console.log(`   Final Cache Size: ${formatNumber(stats.totalKeys)}`);
    console.log('');
  }
}

// Run benchmarks
async function main() {
  console.log('🎯 Cache Layer - SET Operations Performance Benchmark');
  console.log('=' .repeat(60));
  console.log('');

  try {
    await runSetBenchmark();
    console.log('-'.repeat(60));
    await runSetWithTTL();
    console.log('-'.repeat(60));
    await runConcurrentSetBenchmark();
    console.log('-'.repeat(60));
    await runEvictionBenchmark();

    console.log('✅ Benchmark completed successfully!');
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { runSetBenchmark, runSetWithTTL, runConcurrentSetBenchmark, runEvictionBenchmark };
