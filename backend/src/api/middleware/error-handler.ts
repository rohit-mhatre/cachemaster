import { Request, Response, NextFunction } from 'express';
import logger from '../../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Log error details
  const errorLog = {
    message: err.message,
    stack: err.stack,
    statusCode,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    isOperational: err.isOperational,
  };

  if (statusCode >= 500) {
    logger.error('Server error occurred', errorLog);
  } else if (statusCode >= 400) {
    logger.warn('Client error occurred', errorLog);
  }

  // Don't leak error details in production for server errors
  if (statusCode >= 500 && process.env.NODE_ENV === 'production') {
    message = 'Internal Server Error';
  }

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  }

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err.message,
    }),
  });
}

// Utility function to create operational errors
export function createError(
  message: string,
  statusCode: number = 500,
  isOperational: boolean = true
): AppError {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = isOperational;
  return error;
}
