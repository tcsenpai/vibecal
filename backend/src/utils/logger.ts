import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = '\n' + JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create transports
const transports: winston.transport[] = [];

// Console transport (always enabled)
transports.push(
  new winston.transports.Console({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    format: consoleFormat
  })
);

// File transports (only in production or when explicitly enabled)
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
  // Error log file
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: fileFormat,
      maxSize: '10m',
      maxFiles: '30d',
      zippedArchive: true
    })
  );

  // Combined log file
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      format: fileFormat,
      maxSize: '10m',
      maxFiles: '30d',
      zippedArchive: true
    })
  );
}

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: fileFormat,
  defaultMeta: { service: 'vibecal-backend' },
  transports,
  // Don't exit on handled exceptions in development
  exitOnError: process.env.NODE_ENV === 'production'
});

// Add request logging middleware
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.userId,
    requestId: req.headers['x-request-id']
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger.log(level, 'Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.user?.userId,
      requestId: req.headers['x-request-id']
    });
  });

  next();
};

// Database query logger
export const logDatabaseQuery = (query: string, params?: any[], duration?: number) => {
  if (process.env.NODE_ENV === 'development' || process.env.LOG_DB_QUERIES === 'true') {
    logger.debug('Database query', {
      query: query.replace(/\s+/g, ' ').trim(),
      params,
      duration: duration ? `${duration}ms` : undefined
    });
  }
};

// Security event logger
export const logSecurityEvent = (event: string, details: any) => {
  logger.warn('Security event', {
    event,
    ...details,
    timestamp: new Date().toISOString()
  });
};

// Performance monitoring
export const logPerformance = (operation: string, duration: number, metadata?: any) => {
  const level = duration > 1000 ? 'warn' : 'info';
  logger.log(level, 'Performance metric', {
    operation,
    duration: `${duration}ms`,
    ...metadata
  });
};