import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Custom error class
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error types
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed') {
    super(message, 500);
  }
}

// Global error handler middleware
export const globalErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = err;

  // Convert non-AppError instances to AppError
  if (!(error instanceof AppError)) {
    // Handle specific error types
    if (error.name === 'ValidationError') {
      error = new ValidationError(error.message);
    } else if (error.name === 'JsonWebTokenError') {
      error = new AuthenticationError('Invalid token');
    } else if (error.name === 'TokenExpiredError') {
      error = new AuthenticationError('Token expired');
    } else if (error.message?.includes('duplicate key value')) {
      error = new ConflictError('Resource already exists');
    } else if (error.message?.includes('foreign key constraint')) {
      error = new ValidationError('Invalid reference to related resource');
    } else if (error.message?.includes('connection')) {
      error = new DatabaseError('Database connection failed');
    } else {
      // Unknown error
      error = new AppError('Internal server error', 500, false);
    }
  }

  const appError = error as AppError;

  // Log error details
  if (appError.statusCode >= 500) {
    logger.error('Server Error:', {
      message: appError.message,
      stack: appError.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.userId
    });
  } else {
    logger.warn('Client Error:', {
      message: appError.message,
      statusCode: appError.statusCode,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userId: (req as any).user?.userId
    });
  }

  // Send error response
  const response: any = {
    error: appError.message,
    statusCode: appError.statusCode
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development' && appError.statusCode >= 500) {
    response.stack = appError.stack;
  }

  // Add request ID for tracking
  if (req.headers['x-request-id']) {
    response.requestId = req.headers['x-request-id'];
  }

  res.status(appError.statusCode).json(response);
};

// Async wrapper to catch promise rejections
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  next(new NotFoundError(`Route ${req.originalUrl} not found`));
};

// Unhandled promise rejection handler
export const unhandledRejectionHandler = () => {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection:', {
      reason: reason.toString(),
      stack: reason.stack
    });
    
    // Don't exit in development
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });
};

// Uncaught exception handler
export const uncaughtExceptionHandler = () => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', {
      message: error.message,
      stack: error.stack
    });
    
    // Always exit on uncaught exceptions
    process.exit(1);
  });
};