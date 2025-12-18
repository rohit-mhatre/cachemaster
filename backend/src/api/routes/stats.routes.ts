import { Router } from 'express';
import { CacheEngine } from '../../cache/engine';

export default function createStatsRoutes(cache: CacheEngine): Router {
  const router = Router();

  // GET /api/stats
  router.get('/stats', (_req, res) => {
    const stats = cache.getStats();

    res.json({
      ...stats,
      memoryUsagePercent: cache.getMemoryUsagePercent(),
      timestamp: new Date().toISOString(),
    });
  });

  // POST /api/stats/reset
  router.post('/stats/reset', (_req, res) => {
    cache.resetStats();

    res.json({
      success: true,
      message: 'Statistics reset successfully',
      timestamp: new Date().toISOString(),
    });
  });

  // GET /api/config
  router.get('/config', (_req, res) => {
    import('../../config').then(({ default: config }) => {
      res.json({
        port: config.port,
        nodeEnv: config.nodeEnv,
        evictionPolicy: config.evictionPolicy,
        maxMemoryMB: config.maxMemoryMB,
        maxKeys: config.maxKeys,
        cleanupIntervalMs: config.cleanupIntervalMs,
        logLevel: config.logLevel,
        enableCompression: config.enableCompression,
        rateLimitPerMinute: config.rateLimitPerMinute,
        corsOrigins: config.corsOrigins,
      });
    });
  });

  return router;
}
