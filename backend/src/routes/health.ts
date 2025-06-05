import { Router, Request, Response } from 'express';
import { checkDatabaseHealth } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// Basic health check (for load balancers)
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Detailed health check
router.get('/health/detailed', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Check database
    const dbHealth = await checkDatabaseHealth();
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    const memoryHealth = {
      status: memUsage.heapUsed < 1024 * 1024 * 1024 ? 'healthy' : 'warning', // 1GB threshold
      details: {
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
      }
    };

    // Check Node.js version and environment
    const systemHealth = {
      status: 'healthy',
      details: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        environment: process.env.NODE_ENV || 'development',
        pid: process.pid,
        uptime: `${Math.round(process.uptime())}s`
      }
    };

    const responseTime = Date.now() - startTime;
    const overallStatus = dbHealth.status === 'healthy' && memoryHealth.status !== 'unhealthy' 
      ? 'healthy' : 'unhealthy';

    const healthCheck = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      services: {
        database: dbHealth,
        memory: memoryHealth,
        system: systemHealth
      }
    };

    // Log health check results
    if (overallStatus === 'unhealthy') {
      logger.warn('Health check failed', healthCheck);
    }

    res.status(overallStatus === 'healthy' ? 200 : 503).json(healthCheck);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Readiness probe (for Kubernetes)
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    
    if (dbHealth.status === 'healthy') {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        reason: 'Database not available'
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed'
    });
  }
});

// Liveness probe (for Kubernetes)
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router;