import { Router } from 'express';
import config from '../../config';

const router = Router();

// GET /health
router.get('/', (_req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.round(uptime * 100) / 100, // Round to 2 decimal places
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100, // MB
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100, // MB
    },
    config: {
      port: config.port,
      nodeEnv: config.nodeEnv,
      evictionPolicy: config.evictionPolicy,
      maxMemoryMB: config.maxMemoryMB,
      maxKeys: config.maxKeys,
    },
  });
});

// GET /health/detailed
router.get('/detailed', (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  const cacheStats = req.app.locals.cache?.getStats() || {};

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.round(uptime * 100) / 100,
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
    },
    cache: {
      ...cacheStats,
      memoryUsagePercent: req.app.locals.cache?.getMemoryUsagePercent() || 0,
    },
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      pid: process.pid,
    },
  });
});

export default router;
