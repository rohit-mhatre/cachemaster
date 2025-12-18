import { Request, Response, NextFunction } from 'express';
import logger from '../../utils/logger';

export interface RequestLoggerOptions {
  logLevel?: 'info' | 'debug' | 'warn';
  includeHeaders?: boolean;
  includeBody?: boolean;
  excludePaths?: string[];
}

export function requestLogger(options: RequestLoggerOptions = {}) {
  const {
    logLevel = 'info',
    includeHeaders = false,
    includeBody = false,
    excludePaths = ['/health'],
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Skip logging for excluded paths
    if (excludePaths.includes(req.path)) {
      return next();
    }

    // Log incoming request
    const requestLog = {
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      ...(includeHeaders && { headers: req.headers }),
      ...(includeBody && req.body && { body: req.body }),
    };

    logger[logLevel]('Request received', requestLog);

    // Listen for response finish to log completion
    res.on('finish', () => {
      const duration = Date.now() - startTime;

      const responseLog = {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
      };

      if (res.statusCode >= 400) {
        logger.warn('Request completed with error', responseLog);
      } else {
        logger[logLevel]('Request completed', responseLog);
      }
    });

    next();
  };
}
