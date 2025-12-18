import { CacheEngine } from '../cache/engine';
import config from '../config';
import logger from '../utils/logger';

let cleanupInterval: NodeJS.Timeout | null = null;

export function startCleanupWorker(cache: CacheEngine): void {
  if (cleanupInterval) {
    logger.warn('Cleanup worker is already running');
    return;
  }

  logger.info('Starting cleanup worker', {
    intervalMs: config.cleanupIntervalMs,
  });

  cleanupInterval = setInterval(() => {
    try {
      const cleaned = cache.cleanup();

      if (cleaned > 0) {
        logger.info('Cleanup completed', {
          keysCleaned: cleaned,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      logger.error('Cleanup worker error', {
        error: error.message,
        stack: error.stack,
      });
    }
  }, config.cleanupIntervalMs);
}

export function stopCleanupWorker(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('Cleanup worker stopped');
  }
}

// Graceful shutdown handler
process.on('SIGTERM', () => {
  stopCleanupWorker();
});

process.on('SIGINT', () => {
  stopCleanupWorker();
});
