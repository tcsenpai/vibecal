import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import { logger, logDatabaseQuery, logPerformance } from './logger';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
  
  // Connection pooling configuration
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  min: parseInt(process.env.DB_POOL_MIN || '5'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
  
  // SSL configuration
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Pool event handlers
pool.on('connect', (client: PoolClient) => {
  logger.info('Database pool: New client connected');
});

pool.on('error', (err: Error) => {
  logger.error('Database pool error:', err);
});

pool.on('remove', () => {
  logger.info('Database pool: Client removed');
});

// Enhanced query function with logging and performance monitoring
export const query = async (text: string, params?: any[]): Promise<any> => {
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    logDatabaseQuery(text, params, duration);
    
    // Log slow queries
    if (duration > 1000) {
      logPerformance('slow_query', duration, { query: text, params });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Database query failed:', {
      query: text,
      params,
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : error
    });
    throw error;
  }
};

// Transaction helper
export const transaction = async <T>(callback: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Database health check
export const checkDatabaseHealth = async (): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> => {
  try {
    const start = Date.now();
    const result = await pool.query('SELECT NOW() as current_time, version() as version');
    const responseTime = Date.now() - start;
    
    const stats = {
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingConnections: pool.waitingCount
    };
    
    return {
      status: 'healthy',
      details: {
        responseTime: `${responseTime}ms`,
        serverTime: result.rows[0].current_time,
        version: result.rows[0].version,
        connectionPool: stats
      }
    };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      status: 'unhealthy',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionPool: {
          totalConnections: pool.totalCount,
          idleConnections: pool.idleCount,
          waitingConnections: pool.waitingCount
        }
      }
    };
  }
};

// Graceful shutdown
export const closeDatabaseConnection = async (): Promise<void> => {
  try {
    await pool.end();
    logger.info('Database pool closed successfully');
  } catch (error) {
    logger.error('Error closing database pool:', error);
    throw error;
  }
};

export default pool;