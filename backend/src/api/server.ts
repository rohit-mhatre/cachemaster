import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { CacheEngine } from '../cache/engine';
import config from '../config';

// Import route handlers
import cacheRoutes from './routes/cache.routes';
import healthRoutes from './routes/health.routes';
import statsRoutes from './routes/stats.routes';

// Import middleware
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';

export function createServer(cache: CacheEngine): express.Application {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for API
  }));

  // CORS configuration
  app.use(cors({
    origin: config.corsOrigins === '*' ? true : config.corsOrigins.split(','),
    credentials: true,
  }));

  // Compression
  if (config.enableCompression) {
    app.use(compression());
  }

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: config.rateLimitPerMinute,
    message: {
      error: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging
  app.use(requestLogger());

  // Health check (no auth required)
  app.use('/health', healthRoutes);

  // API routes
  app.use('/api', cacheRoutes(cache));
  app.use('/api', statsRoutes(cache));

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    });
  });

  // Error handling middleware (must be last)
  app.use(errorHandler);

  return app;
}
