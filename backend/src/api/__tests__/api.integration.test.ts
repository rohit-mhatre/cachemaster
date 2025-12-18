import request from 'supertest';
import { CacheEngine } from '../../cache/engine';
import { createServer } from '../server';

describe('API Integration Tests', () => {
  let app: ReturnType<typeof createServer>;
  let cache: CacheEngine;

  beforeEach(() => {
    // Create a test cache with small limits for testing
    cache = new CacheEngine({
      maxMemoryMB: 1,
      maxKeys: 10,
      evictionPolicy: 'LRU'
    });
    app = createServer(cache);
  });

  afterEach(() => {
    cache.clear();
  });

  describe('Health Endpoint', () => {
    test('GET /health returns healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('config');
    });

    test('GET /health/detailed returns detailed health info', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('cache');
      expect(response.body).toHaveProperty('system');
    });
  });

  describe('Cache Operations', () => {
    describe('GET /api/get/:key', () => {
      test('returns existing key value', async () => {
        await cache.set('testKey', 'testValue');

        const response = await request(app)
          .get('/api/get/testKey')
          .expect(200);

        expect(response.body).toEqual({
          key: 'testKey',
          value: 'testValue',
          exists: true
        });
      });

      test('returns null for non-existent key', async () => {
        const response = await request(app)
          .get('/api/get/nonexistent')
          .expect(200);

        expect(response.body).toEqual({
          key: 'nonexistent',
          value: null,
          exists: false
        });
      });

      test('handles special characters in key', async () => {
        await cache.set('special:key@123', 'special value');

        const response = await request(app)
          .get('/api/get/special:key@123')
          .expect(200);

        expect(response.body.value).toBe('special value');
      });
    });

    describe('POST /api/set', () => {
      test('sets a key-value pair', async () => {
        const response = await request(app)
          .post('/api/set')
          .send({ key: 'testKey', value: 'testValue' })
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          key: 'testKey',
          ttl: undefined
        });

        // Verify the key was actually set
        expect(await cache.get('testKey')).toBe('testValue');
      });

      test('sets a key with TTL', async () => {
        const response = await request(app)
          .post('/api/set')
          .send({ key: 'ttlKey', value: 'ttlValue', ttl: 5000 })
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          key: 'ttlKey',
          ttl: 5000
        });

        expect(await cache.get('ttlKey')).toBe('ttlValue');
      });

      test('handles different value types', async () => {
        // String
        await request(app)
          .post('/api/set')
          .send({ key: 'string', value: 'hello' })
          .expect(200);

        // Number
        await request(app)
          .post('/api/set')
          .send({ key: 'number', value: 42 })
          .expect(200);

        // Object
        await request(app)
          .post('/api/set')
          .send({ key: 'object', value: { name: 'test', count: 5 } })
          .expect(200);

        // Array
        await request(app)
          .post('/api/set')
          .send({ key: 'array', value: [1, 2, 3] })
          .expect(200);

        // Verify all were stored
        expect(await cache.get('string')).toBe('hello');
        expect(await cache.get('number')).toBe(42);
        expect(await cache.get('object')).toEqual({ name: 'test', count: 5 });
        expect(await cache.get('array')).toEqual([1, 2, 3]);
      });

      test('validates required fields', async () => {
        // Missing key
        await request(app)
          .post('/api/set')
          .send({ value: 'test' })
          .expect(400);

        // Missing value
        await request(app)
          .post('/api/set')
          .send({ key: 'test' })
          .expect(400);
      });

      test('validates TTL format', async () => {
        // Invalid TTL (negative)
        await request(app)
          .post('/api/set')
          .send({ key: 'test', value: 'value', ttl: -100 })
          .expect(400);

        // Invalid TTL (too large)
        await request(app)
          .post('/api/set')
          .send({ key: 'test', value: 'value', ttl: 999999999 })
          .expect(400);
      });
    });

    describe('DELETE /api/delete/:key', () => {
      test('deletes existing key', async () => {
        await cache.set('testKey', 'testValue');

        const response = await request(app)
          .delete('/api/delete/testKey')
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          key: 'testKey'
        });

        expect(await cache.exists('testKey')).toBe(false);
      });

      test('returns success for non-existent key', async () => {
        const response = await request(app)
          .delete('/api/delete/nonexistent')
          .expect(200);

        expect(response.body).toEqual({
          success: false,
          key: 'nonexistent'
        });
      });
    });

    describe('GET /api/exists/:key', () => {
      test('returns true for existing key', async () => {
        await cache.set('testKey', 'testValue');

        const response = await request(app)
          .get('/api/exists/testKey')
          .expect(200);

        expect(response.body).toEqual({
          key: 'testKey',
          exists: true
        });
      });

      test('returns false for non-existent key', async () => {
        const response = await request(app)
          .get('/api/exists/nonexistent')
          .expect(200);

        expect(response.body).toEqual({
          key: 'nonexistent',
          exists: false
        });
      });
    });

    describe('POST /api/increment/:key', () => {
      test('increments existing numeric value', async () => {
        await cache.set('counter', 5);

        const response = await request(app)
          .post('/api/increment/counter')
          .send({ amount: 3 })
          .expect(200);

        expect(response.body).toEqual({
          key: 'counter',
          value: 8,
          amount: 3
        });

        expect(await cache.get('counter')).toBe(8);
      });

      test('increments with default amount of 1', async () => {
        await cache.set('counter', 10);

        const response = await request(app)
          .post('/api/increment/counter')
          .expect(200);

        expect(response.body).toEqual({
          key: 'counter',
          value: 11,
          amount: 1
        });
      });

      test('sets to increment amount if key does not exist', async () => {
        const response = await request(app)
          .post('/api/increment/newcounter')
          .send({ amount: 5 })
          .expect(200);

        expect(response.body).toEqual({
          key: 'newcounter',
          value: 5,
          amount: 5
        });
      });

      test('returns error for non-numeric values', async () => {
        await cache.set('text', 'hello');

        const response = await request(app)
          .post('/api/increment/text')
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('Cannot increment non-numeric value');
      });
    });

    describe('POST /api/update-ttl/:key', () => {
      test('updates TTL of existing key', async () => {
        await cache.set('ttlKey', 'value', { ttl: 1000 });

        const response = await request(app)
          .post('/api/update-ttl/ttlKey')
          .send({ ttl: 5000 })
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          key: 'ttlKey',
          ttl: 5000
        });
      });

      test('returns false for non-existent key', async () => {
        const response = await request(app)
          .post('/api/update-ttl/nonexistent')
          .send({ ttl: 1000 })
          .expect(200);

        expect(response.body).toEqual({
          success: false,
          key: 'nonexistent',
          ttl: 1000
        });
      });
    });

    describe('GET /api/keys', () => {
      test('returns all keys', async () => {
        await cache.set('key1', 'value1');
        await cache.set('key2', 'value2');
        await cache.set('key3', 'value3');

        const response = await request(app)
          .get('/api/keys')
          .expect(200);

        expect(response.body).toHaveProperty('keys');
        expect(response.body).toHaveProperty('total', 3);
        expect(response.body).toHaveProperty('limit', 100);
        expect(response.body).toHaveProperty('offset', 0);
        expect(response.body.keys).toHaveLength(3);
        expect(response.body.keys).toContain('key1');
        expect(response.body.keys).toContain('key2');
        expect(response.body.keys).toContain('key3');
      });

      test('supports pagination', async () => {
        // Set up more keys
        for (let i = 1; i <= 10; i++) {
          await cache.set(`key${i}`, `value${i}`);
        }

        const response = await request(app)
          .get('/api/keys?limit=3&offset=2')
          .expect(200);

        expect(response.body.keys).toHaveLength(3);
        expect(response.body.limit).toBe(3);
        expect(response.body.offset).toBe(2);
        expect(response.body.total).toBe(10);
      });
    });
  });

  describe('Batch Operations', () => {
    describe('POST /api/batch/set', () => {
      test('sets multiple entries', async () => {
        const entries = [
          { key: 'batch1', value: 'value1' },
          { key: 'batch2', value: 'value2', ttl: 5000 },
          { key: 'batch3', value: 42 }
        ];

        const response = await request(app)
          .post('/api/batch/set')
          .send({ entries })
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          count: 3
        });

        // Verify entries were set
        expect(await cache.get('batch1')).toBe('value1');
        expect(await cache.get('batch2')).toBe('value2');
        expect(await cache.get('batch3')).toBe(42);
      });

      test('validates batch entries', async () => {
        // Empty batch
        await request(app)
          .post('/api/batch/set')
          .send({ entries: [] })
          .expect(400);

        // Too many entries
        const tooManyEntries = Array.from({ length: 101 }, (_, i) => ({
          key: `key${i}`,
          value: `value${i}`
        }));

        await request(app)
          .post('/api/batch/set')
          .send({ entries: tooManyEntries })
          .expect(400);
      });
    });

    describe('POST /api/batch/get', () => {
      test('gets multiple entries', async () => {
        await cache.set('key1', 'value1');
        await cache.set('key2', 'value2');
        await cache.set('key3', 'value3');

        const response = await request(app)
          .post('/api/batch/get')
          .send({ keys: ['key1', 'key3', 'nonexistent'] })
          .expect(200);

        expect(response.body).toEqual({
          result: {
            key1: 'value1',
            key3: 'value3'
          },
          requested: 3,
          found: 2
        });
      });

      test('validates keys array', async () => {
        // Empty array
        await request(app)
          .post('/api/batch/get')
          .send({ keys: [] })
          .expect(400);

        // Too many keys
        const tooManyKeys = Array.from({ length: 101 }, (_, i) => `key${i}`);

        await request(app)
          .post('/api/batch/get')
          .send({ keys: tooManyKeys })
          .expect(400);
      });
    });

    describe('POST /api/batch/delete', () => {
      test('deletes multiple entries', async () => {
        await cache.set('key1', 'value1');
        await cache.set('key2', 'value2');
        await cache.set('key3', 'value3');

        const response = await request(app)
          .post('/api/batch/delete')
          .send({ keys: ['key1', 'key3', 'nonexistent'] })
          .expect(200);

        expect(response.body).toEqual({
          deleted: ['key1', 'key3'],
          requested: 3,
          deletedCount: 2
        });

        expect(await cache.exists('key1')).toBe(false);
        expect(await cache.exists('key2')).toBe(true);
        expect(await cache.exists('key3')).toBe(false);
      });
    });
  });

  describe('Statistics and Configuration', () => {
    describe('GET /api/stats', () => {
      test('returns cache statistics', async () => {
        await cache.set('key1', 'value1');
        await cache.get('key1'); // hit
        await cache.get('key2'); // miss

        const response = await request(app)
          .get('/api/stats')
          .expect(200);

        expect(response.body).toHaveProperty('totalKeys', 1);
        expect(response.body).toHaveProperty('hits', 1);
        expect(response.body).toHaveProperty('misses', 1);
        expect(response.body).toHaveProperty('hitRate');
        expect(response.body).toHaveProperty('memoryUsage');
        expect(response.body).toHaveProperty('evictions', 0);
        expect(response.body).toHaveProperty('expirations', 0);
        expect(response.body).toHaveProperty('opsPerSecond');
        expect(response.body).toHaveProperty('memoryUsagePercent');
        expect(response.body).toHaveProperty('timestamp');
      });
    });

    describe('POST /api/stats/reset', () => {
      test('resets statistics', async () => {
        await cache.set('key1', 'value1');
        await cache.get('key1');

        // Reset stats
        const resetResponse = await request(app)
          .post('/api/stats/reset')
          .expect(200);

        expect(resetResponse.body).toEqual({
          success: true,
          message: 'Statistics reset successfully',
          timestamp: expect.any(String)
        });

        // Check stats are reset
        const statsResponse = await request(app)
          .get('/api/stats')
          .expect(200);

        expect(statsResponse.body.hits).toBe(0);
        expect(statsResponse.body.misses).toBe(0);
        expect(statsResponse.body.evictions).toBe(0);
      });
    });

    describe('GET /api/config', () => {
      test('returns current configuration', async () => {
        const response = await request(app)
          .get('/api/config')
          .expect(200);

        expect(response.body).toHaveProperty('port');
        expect(response.body).toHaveProperty('nodeEnv');
        expect(response.body).toHaveProperty('evictionPolicy', 'LRU');
        expect(response.body).toHaveProperty('maxMemoryMB', 1);
        expect(response.body).toHaveProperty('maxKeys', 10);
        expect(response.body).toHaveProperty('cleanupIntervalMs');
        expect(response.body).toHaveProperty('logLevel');
        expect(response.body).toHaveProperty('enableCompression');
        expect(response.body).toHaveProperty('rateLimitPerMinute');
        expect(response.body).toHaveProperty('corsOrigins');
      });
    });
  });

  describe('Error Handling', () => {
    test('returns 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown-route')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Not Found');
    });

    test('returns 400 for invalid JSON', async () => {
      await request(app)
        .post('/api/set')
        .set('Content-Type', 'application/json')
        .send('invalid json {')
        .expect(400);
    });

    test('handles rate limiting', async () => {
      // Make many requests quickly to trigger rate limiting
      const promises = [];
      for (let i = 0; i < 150; i++) {
        promises.push(
          request(app)
            .get('/health')
            .then(() => 'success')
            .catch(() => 'rate-limited')
        );
      }

      const results = await Promise.all(promises);
      const rateLimited = results.filter(r => r === 'rate-limited');

      // Should have some rate limited requests
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('TTL Expiration', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('expires keys after TTL', async () => {
      await request(app)
        .post('/api/set')
        .send({ key: 'ttlKey', value: 'ttlValue', ttl: 1000 })
        .expect(200);

      // Key should exist initially
      let response = await request(app)
        .get('/api/get/ttlKey')
        .expect(200);
      expect(response.body.exists).toBe(true);

      // Advance time past TTL
      jest.advanceTimersByTime(1100);

      // Key should be expired
      response = await request(app)
        .get('/api/get/ttlKey')
        .expect(200);
      expect(response.body.exists).toBe(false);
    });
  });
});
