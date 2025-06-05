import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number, isOperational = true, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const createError = (message: string, statusCode: number, code?: string) => {
  return new AppError(message, statusCode, true, code);
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  let error = { ...err } as AppError;
  error.message = err.message;

  // Log error
  logger.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.userId
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new AppError(message, 404);
  }

  // Mongoose duplicate key
  if ((err as any).code === 11000) {
    const message = 'Duplicate field value entered';
    error = new AppError(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = 'Invalid input data';
    error = new AppError(message, 400);
  }

  // PostgreSQL errors
  if ((err as any).code) {
    switch ((err as any).code) {
      case '23505': // unique_violation
        error = new AppError('Duplicate entry', 400, true, 'DUPLICATE_ENTRY');
        break;
      case '23503': // foreign_key_violation
        error = new AppError('Referenced resource not found', 400, true, 'INVALID_REFERENCE');
        break;
      case '23514': // check_violation
        error = new AppError('Invalid data format', 400, true, 'INVALID_FORMAT');
        break;
      case '42P01': // undefined_table
        error = new AppError('System error', 500, false, 'SYSTEM_ERROR');
        break;
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token', 401, true, 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token expired', 401, true, 'TOKEN_EXPIRED');
  }

  // Default to 500 server error
  if (!error.statusCode) {
    error.statusCode = 500;
    error.message = 'Internal server error';
  }

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.statusCode).json({
    error: error.message,
    ...(isDevelopment && { 
      stack: error.stack,
      code: error.code 
    }),
    ...(error.statusCode < 500 && { code: error.code })
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  const message = `Route ${req.originalUrl} not found`;
  logger.warn('Route not found:', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });
  
  res.status(404).json({
    error: message,
    code: 'ROUTE_NOT_FOUND'
  });
};