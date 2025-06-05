import { Router } from 'express';
import { 
  requireAdmin,
  getSystemStats,
  getWebDAVSettings,
  updateUserWebDAVSettings,
  getCalendarSyncStatus,
  getSyncChangesLog,
  forceSyncCalendar,
  cleanupSyncData,
  getWebDAVMetrics,
  updateWebDAVSettingsValidation
} from '../controllers/adminController';
import { authenticateToken } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validation';
import { param } from 'express-validator';

const router = Router();

// All admin routes require authentication and admin privileges
router.use(authenticateToken);
router.use(requireAdmin);

// System overview
router.get('/stats', getSystemStats);

// WebDAV/CalDAV management
router.get('/webdav/settings', getWebDAVSettings);
router.get('/webdav/metrics', getWebDAVMetrics);
router.get('/webdav/sync-status', getCalendarSyncStatus);
router.get('/webdav/sync-changes', getSyncChangesLog);

// User WebDAV settings management
router.put(
  '/webdav/users/:userId/settings',
  [param('userId').isInt({ min: 1 })],
  updateWebDAVSettingsValidation,
  handleValidationErrors,
  updateUserWebDAVSettings
);

// Calendar sync operations
router.post(
  '/webdav/calendars/:calendarId/force-sync',
  [param('calendarId').isUUID()],
  handleValidationErrors,
  forceSyncCalendar
);

// Maintenance operations
router.post('/webdav/cleanup', cleanupSyncData);

export default router;