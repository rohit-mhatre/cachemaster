import { CacheEngine } from '../src/cache/engine';

function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

async function runGetBenchmark(): Promise<void> {
  console.log('🚀 Running GET Operations Benchmark\n');

  const cache = new CacheEngine({
    maxMemoryMB: 512,
    maxKeys: 100000,
    evictionPolicy: 'LRU'
  });

  // Setup: Pre-populate cache with test data
  console.log('📝 Setting up test data...');
  const testDataSize = 100000;
  for (let i = 0; i < testDataSize; i++) {
    cache.set(`key_${i}`, `value_${i}_with_some_additional_data_to_make_it_more_realistic`);
  }
  console.log(`✅ Populated cache with ${formatNumber(testDataSize)} entries\n`);

  // Benchmark configurations
  const scenarios = [
    { name: 'Small Dataset (1K keys)', size: 1000, iterations: 10000 },
    { name: 'Medium Dataset (10K keys)', size: 10000, iterations: 10000 },
    { name: 'Large Dataset (100K keys)', size: 100000, iterations: 10000 },
  ];

  console.log('📊 Benchmark Results:\n');

  for (const scenario of scenarios) {
    console.log(`🔍 ${scenario.name}`);

    // Create random access pattern
    const keys: string[] = [];
    for (let i = 0; i < scenario.iterations; i++) {
      keys.push(`key_${Math.floor(Math.random() * scenario.size)}`);
    }

    // Warm-up phase
    for (let i = 0; i < 1000; i++) {
      cache.get(keys[i % keys.length]);
    }

    // Benchmark phase
    const startTime = process.hrtime.bigint();
    let hits = 0;
    let misses = 0;

    for (const key of keys) {
      const result = cache.get(key);
      if (result !== null) {
        hits++;
      } else {
        misses++;
      }
    }

    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
    const opsPerSecond = Math.round((scenario.iterations / durationMs) * 1000);
    const avgLatency = durationMs / scenario.iterations;

    console.log(`   Operations: ${formatNumber(scenario.iterations)}`);
    console.log(`   Duration: ${formatTime(durationMs)}`);
    console.log(`   Throughput: ${formatNumber(opsPerSecond)} ops/sec`);
    console.log(`   Avg Latency: ${avgLatency.toFixed(4)}ms`);
    console.log(`   Hit Rate: ${((hits / (hits + misses)) * 100).toFixed(1)}% (${formatNumber(hits)} hits, ${formatNumber(misses)} misses)`);
    console.log('');
  }

  // Memory usage report
  const stats = cache.getStats();
  console.log('💾 Memory Usage:');
  console.log(`   Current Memory: ${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Cache Size: ${formatNumber(stats.totalKeys)} keys`);
  console.log('');

  cache.clear();
}

async function runConcurrentGetBenchmark(): Promise<void> {
  console.log('🔄 Running Concurrent GET Operations Benchmark\n');

  const cache = new CacheEngine({
    maxMemoryMB: 512,
    maxKeys: 100000,
    evictionPolicy: 'LRU'
  });

  // Setup
  const testDataSize = 50000;
  for (let i = 0; i < testDataSize; i++) {
    cache.set(`key_${i}`, `value_${i}`);
  }

  const concurrencyLevels = [1, 10, 50, 100];
  const operationsPerWorker = 1000;

  for (const concurrency of concurrencyLevels) {
    console.log(`🔄 Concurrency Level: ${concurrency}`);

    const workers = Array.from({ length: concurrency }, () => {
      return async () => {
        let hits = 0;
        let misses = 0;
        const startTime = process.hrtime.bigint();

        for (let i = 0; i < operationsPerWorker; i++) {
          const key = `key_${Math.floor(Math.random() * testDataSize)}`;
          const result = cache.get(key);
          if (result !== null) hits++;
          else misses++;
        }

        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1_000_000;

        return { hits, misses, durationMs };
      };
    });

    const startTime = process.hrtime.bigint();
    const results = await Promise.all(workers.map(w => w()));

    const endTime = process.hrtime.bigint();
    const totalDurationMs = Number(endTime - startTime) / 1_000_000;
    const totalOps = concurrency * operationsPerWorker;
    const opsPerSecond = Math.round((totalOps / totalDurationMs) * 1000);
    const avgLatency = totalDurationMs / totalOps;

    const totalHits = results.reduce((sum, r) => sum + r.hits, 0);
    const totalMisses = results.reduce((sum, r) => sum + r.misses, 0);
    const hitRate = (totalHits / (totalHits + totalMisses)) * 100;

    console.log(`   Total Operations: ${formatNumber(totalOps)}`);
    console.log(`   Duration: ${formatTime(totalDurationMs)}`);
    console.log(`   Throughput: ${formatNumber(opsPerSecond)} ops/sec`);
    console.log(`   Avg Latency: ${avgLatency.toFixed(4)}ms`);
    console.log(`   Hit Rate: ${hitRate.toFixed(1)}%`);
    console.log('');
  }

  cache.clear();
}

// Run benchmarks
async function main() {
  console.log('🎯 Cache Layer - GET Operations Performance Benchmark');
  console.log('=' .repeat(60));
  console.log('');

  try {
    await runGetBenchmark();
    console.log('-'.repeat(60));
    await runConcurrentGetBenchmark();

    console.log('✅ Benchmark completed successfully!');
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { runGetBenchmark, runConcurrentGetBenchmark };
