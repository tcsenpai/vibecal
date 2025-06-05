import { Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../utils/database';
import { AuthRequest } from '../middleware/auth';
import { AppError, asyncHandler } from '../utils/errorHandler';
import { logger } from '../utils/logger';

// Middleware to check admin permissions
export const requireAdmin = asyncHandler(async (req: AuthRequest, res: Response, next: any) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, true, 'AUTH_REQUIRED');
  }

  // Check if user is admin (for now, check if user ID is 1 or has admin role)
  const result = await pool.query(
    'SELECT id, email, username FROM users WHERE id = $1 AND (id = 1 OR email LIKE \'%admin%\')',
    [req.user.userId]
  );

  if (result.rows.length === 0) {
    logger.warn('Admin access attempt denied', { userId: req.user.userId, email: req.user.email });
    throw new AppError('Admin access required', 403, true, 'ADMIN_REQUIRED');
  }

  logger.info('Admin access granted', { userId: req.user.userId });
  next();
});

// Get system statistics
export const getSystemStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const [
    userStats,
    eventStats,
    calendarStats,
    recentActivity
  ] = await Promise.all([
    // User statistics
    pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE is_verified = true) as verified_users,
        COUNT(*) FILTER (WHERE is_active = true) as active_users,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_users_30d
      FROM users
    `),
    
    // Event statistics
    pool.query(`
      SELECT 
        COUNT(*) as total_events,
        COUNT(*) FILTER (WHERE event_type = 'voting') as voting_events,
        COUNT(*) FILTER (WHERE is_public = true) as public_events,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_events_30d
      FROM events
    `),
    
    // Calendar statistics (WebDAV)
    pool.query(`
      SELECT 
        COUNT(*) as total_calendars,
        COUNT(*) FILTER (WHERE webdav_enabled = true) as webdav_enabled,
        COUNT(*) FILTER (WHERE webcal_enabled = true) as webcal_enabled,
        COUNT(DISTINCT user_id) as users_with_calendars
      FROM calendars
    `),
    
    // Recent activity
    pool.query(`
      SELECT 
        'event_created' as activity_type,
        title as description,
        created_at,
        creator_id as user_id
      FROM events 
      WHERE created_at >= NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC 
      LIMIT 10
    `)
  ]);

  const stats = {
    users: userStats.rows[0],
    events: eventStats.rows[0],
    calendars: calendarStats.rows[0],
    recentActivity: recentActivity.rows,
    systemInfo: {
      nodeVersion: process.version,
      environment: process.env.NODE_ENV,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    }
  };

  logger.info('Admin accessed system stats', { userId: req.user?.userId });
  res.json(stats);
});

// Get WebDAV/CalDAV settings
export const getWebDAVSettings = asyncHandler(async (req: AuthRequest, res: Response) => {
  const [globalSettings, userSettings] = await Promise.all([
    // Global WebDAV settings (from environment/config)
    Promise.resolve({
      webdavEnabled: process.env.ENABLE_WEBDAV === 'true',
      webcalEnabled: true, // Always enabled for now
      defaultSyncInterval: 300, // 5 minutes
      maxCalendarsPerUser: 10,
      maxEventsPerCalendar: 1000
    }),
    
    // User-specific settings
    pool.query(`
      SELECT 
        u.id as user_id,
        u.username,
        u.email,
        COUNT(c.id) as calendar_count,
        COUNT(c.id) FILTER (WHERE c.webdav_enabled = true) as webdav_calendars,
        COUNT(c.id) FILTER (WHERE c.webcal_enabled = true) as webcal_calendars,
        MAX(c.updated_at) as last_sync
      FROM users u
      LEFT JOIN calendars c ON u.id = c.user_id
      GROUP BY u.id, u.username, u.email
      HAVING COUNT(c.id) > 0
      ORDER BY calendar_count DESC
      LIMIT 20
    `)
  ]);

  res.json({
    global: globalSettings,
    users: userSettings.rows
  });
});

// Update WebDAV settings for a user
export const updateUserWebDAVSettings = asyncHandler(async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 400, true, 'VALIDATION_ERROR');
  }

  const { userId } = req.params;
  const { webdavEnabled, webcalEnabled } = req.body;

  logger.info('Admin updating WebDAV settings', { 
    adminUserId: req.user?.userId, 
    targetUserId: userId,
    settings: { webdavEnabled, webcalEnabled }
  });

  await pool.query(`
    UPDATE calendars 
    SET 
      webdav_enabled = COALESCE($1, webdav_enabled),
      webcal_enabled = COALESCE($2, webcal_enabled),
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $3
  `, [webdavEnabled, webcalEnabled, userId]);

  res.json({ 
    message: 'WebDAV settings updated successfully',
    userId: parseInt(userId),
    settings: { webdavEnabled, webcalEnabled }
  });
});

// Get calendar objects and sync status
export const getCalendarSyncStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await pool.query(`
    SELECT 
      c.id as calendar_id,
      c.name as calendar_name,
      c.display_name,
      c.user_id,
      u.username,
      c.sync_token,
      c.webdav_enabled,
      c.webcal_enabled,
      c.updated_at as last_updated,
      COUNT(co.id) as object_count,
      COUNT(co.id) FILTER (WHERE co.component_type = 'VEVENT') as event_count,
      MAX(co.updated_at) as last_object_update
    FROM calendars c
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN calendar_objects co ON c.id = co.calendar_id
    GROUP BY c.id, c.name, c.display_name, c.user_id, u.username, c.sync_token, c.webdav_enabled, c.webcal_enabled, c.updated_at
    ORDER BY c.updated_at DESC
    LIMIT 50
  `);

  res.json({
    calendars: result.rows,
    summary: {
      totalCalendars: result.rows.length,
      webdavEnabled: result.rows.filter(c => c.webdav_enabled).length,
      webcalEnabled: result.rows.filter(c => c.webcal_enabled).length,
      totalObjects: result.rows.reduce((sum, c) => sum + parseInt(c.object_count), 0)
    }
  });
});

// Get sync changes log
export const getSyncChangesLog = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { limit = 100, calendarId } = req.query;

  let query = `
    SELECT 
      sc.*,
      c.name as calendar_name,
      u.username
    FROM sync_changes sc
    LEFT JOIN calendars c ON sc.calendar_id = c.id
    LEFT JOIN users u ON c.user_id = u.id
  `;
  
  const params: any[] = [];
  
  if (calendarId) {
    query += ' WHERE sc.calendar_id = $1';
    params.push(calendarId);
  }
  
  query += ' ORDER BY sc.created_at DESC LIMIT $' + (params.length + 1);
  params.push(parseInt(limit as string));

  const result = await pool.query(query, params);

  res.json({
    changes: result.rows,
    pagination: {
      limit: parseInt(limit as string),
      count: result.rows.length
    }
  });
});

// Force sync for a calendar
export const forceSyncCalendar = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { calendarId } = req.params;

  logger.info('Admin forcing calendar sync', { 
    adminUserId: req.user?.userId, 
    calendarId 
  });

  // Update sync token to trigger clients to re-sync
  const result = await pool.query(`
    UPDATE calendars 
    SET 
      sync_token = gen_random_uuid()::text,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id, name, sync_token
  `, [calendarId]);

  if (result.rows.length === 0) {
    throw new AppError('Calendar not found', 404, true, 'CALENDAR_NOT_FOUND');
  }

  // Log the sync event
  await pool.query(`
    INSERT INTO sync_changes (calendar_id, change_type, sync_token, resource_path)
    VALUES ($1, 'sync', $2, $3)
  `, [calendarId, result.rows[0].sync_token, `/calendars/${calendarId}/`]);

  res.json({
    message: 'Calendar sync forced successfully',
    calendar: result.rows[0]
  });
});

// Clean up old sync changes and locks
export const cleanupSyncData = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { days = 30 } = req.query;

  logger.info('Admin cleaning up sync data', { 
    adminUserId: req.user?.userId, 
    olderThanDays: days 
  });

  const [syncChanges, expiredLocks] = await Promise.all([
    // Clean up old sync changes
    pool.query(`
      DELETE FROM sync_changes 
      WHERE created_at < NOW() - INTERVAL '${parseInt(days as string)} days'
    `),
    
    // Clean up expired locks
    pool.query(`
      DELETE FROM webdav_locks 
      WHERE expires_at < CURRENT_TIMESTAMP
    `)
  ]);

  res.json({
    message: 'Sync data cleanup completed',
    deletedSyncChanges: syncChanges.rowCount,
    deletedExpiredLocks: expiredLocks.rowCount
  });
});

// Get detailed WebDAV metrics
export const getWebDAVMetrics = asyncHandler(async (req: AuthRequest, res: Response) => {
  const [lockStats, propertyStats, subscriptionStats] = await Promise.all([
    // WebDAV locks statistics
    pool.query(`
      SELECT 
        COUNT(*) as total_locks,
        COUNT(*) FILTER (WHERE expires_at > CURRENT_TIMESTAMP) as active_locks,
        COUNT(*) FILTER (WHERE lock_type = 'write') as write_locks,
        COUNT(*) FILTER (WHERE lock_scope = 'exclusive') as exclusive_locks,
        AVG(timeout_seconds) as avg_timeout
      FROM webdav_locks
    `),
    
    // WebDAV properties statistics
    pool.query(`
      SELECT 
        COUNT(*) as total_properties,
        COUNT(DISTINCT resource_path) as unique_resources,
        COUNT(DISTINCT namespace) as unique_namespaces
      FROM webdav_properties
    `),
    
    // Calendar subscriptions
    pool.query(`
      SELECT 
        COUNT(*) as total_subscriptions,
        COUNT(*) FILTER (WHERE is_active = true) as active_subscriptions,
        COUNT(*) FILTER (WHERE sync_status = 'success') as successful_syncs,
        COUNT(*) FILTER (WHERE sync_status = 'error') as failed_syncs,
        AVG(refresh_interval) as avg_refresh_interval
      FROM calendar_subscriptions
    `)
  ]);

  res.json({
    locks: lockStats.rows[0],
    properties: propertyStats.rows[0],
    subscriptions: subscriptionStats.rows[0],
    generatedAt: new Date().toISOString()
  });
});

// Validation rules
export const updateWebDAVSettingsValidation = [
  body('webdavEnabled').optional().isBoolean(),
  body('webcalEnabled').optional().isBoolean()
];