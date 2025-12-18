import 'dotenv/config';
import { CacheEngine } from './cache/engine';
import { createServer } from './api/server';
import config from './config';
import logger from './utils/logger';

// Initialize cache engine
const cache = new CacheEngine();

// Create server app
const app = createServer(cache);

// Start server with HTTP
const server = app.listen(config.port, () => {
  logger.info(`Cache server listening on port ${config.port}`, {
    port: config.port,
    nodeEnv: config.nodeEnv,
    evictionPolicy: config.evictionPolicy,
    maxMemoryMB: config.maxMemoryMB,
  });
});

// Start cleanup worker
import('./workers/cleanup-worker').then(({ startCleanupWorker }) => {
  startCleanupWorker(cache);
}).catch((err) => {
  logger.error('Failed to start cleanup worker', { error: err.message });
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  // Stop accepting new requests
  server.close((err?: Error) => {
    if (err) {
      logger.error('Error closing server', { error: err.message });
      process.exit(1);
    }

    logger.info('Server closed successfully');

    // Cleanup resources
    cache.clear();

    logger.info('Cache cleared, exiting');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.kill(process.pid, 'SIGTERM');
});
