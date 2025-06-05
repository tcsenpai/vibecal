import { Router } from 'express';
import { Pool } from 'pg';
import { CalDAVController } from '../controllers/caldavController';
import { authenticateToken } from '../middleware/auth';
import { body, param, query } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation';

export function createCalDAVRoutes(database: Pool): Router {
  const router = Router();
  const caldavController = new CalDAVController(database);

  // Raw WebDAV/CalDAV protocol endpoints (all methods)
  router.all('/caldav/*', (req, res) => caldavController.handleWebDAVRequest(req, res));
  router.all('/caldav', (req, res) => caldavController.handleWebDAVRequest(req, res));

  // RESTful API endpoints for calendar management (requires authentication)
  
  // Calendar collection endpoints
  router.get('/api/caldav/calendars', 
    authenticateToken,
    (req, res) => caldavController.getCalendars(req, res)
  );

  router.post('/api/caldav/calendars',
    authenticateToken,
    [
      body('name').notEmpty().trim().isLength({ min: 1, max: 255 }),
      body('displayName').optional().trim().isLength({ max: 255 }),
      body('description').optional().trim(),
      body('color').optional().isHexColor(),
      body('timezone').optional().trim()
    ],
    handleValidationErrors,
    (req, res) => caldavController.createCalendar(req, res)
  );

  router.put('/api/caldav/calendars/:calendarId',
    authenticateToken,
    [
      param('calendarId').isUUID(),
      body('name').optional().trim().isLength({ min: 1, max: 255 }),
      body('displayName').optional().trim().isLength({ max: 255 }),
      body('description').optional().trim(),
      body('color').optional().isHexColor(),
      body('timezone').optional().trim()
    ],
    handleValidationErrors,
    (req, res) => caldavController.updateCalendar(req, res)
  );

  router.delete('/api/caldav/calendars/:calendarId',
    authenticateToken,
    [param('calendarId').isUUID()],
    handleValidationErrors,
    (req, res) => caldavController.deleteCalendar(req, res)
  );

  // Calendar object endpoints
  router.get('/api/caldav/calendars/:calendarId/objects',
    authenticateToken,
    [
      param('calendarId').isUUID(),
      query('start').optional().isISO8601(),
      query('end').optional().isISO8601(),
      query('componentType').optional().isIn(['VEVENT', 'VTODO', 'VJOURNAL', 'VFREEBUSY'])
    ],
    handleValidationErrors,
    (req, res) => caldavController.queryCalendarObjects(req, res)
  );

  router.get('/api/caldav/calendars/:calendarId/objects/:objectId',
    authenticateToken,
    [
      param('calendarId').isUUID(),
      param('objectId').isUUID()
    ],
    handleValidationErrors,
    (req, res) => caldavController.getCalendarObject(req, res)
  );

  router.post('/api/caldav/calendars/:calendarId/objects',
    authenticateToken,
    [param('calendarId').isUUID()],
    handleValidationErrors,
    (req, res) => caldavController.createCalendarObject(req, res)
  );

  router.put('/api/caldav/calendars/:calendarId/objects/:objectId',
    authenticateToken,
    [
      param('calendarId').isUUID(),
      param('objectId').isUUID()
    ],
    handleValidationErrors,
    (req, res) => caldavController.updateCalendarObject(req, res)
  );

  router.delete('/api/caldav/calendars/:calendarId/objects/:objectId',
    authenticateToken,
    [
      param('calendarId').isUUID(),
      param('objectId').isUUID()
    ],
    handleValidationErrors,
    (req, res) => caldavController.deleteCalendarObject(req, res)
  );

  // Sync endpoints
  router.get('/api/caldav/calendars/:calendarId/sync-token',
    authenticateToken,
    [param('calendarId').isUUID()],
    handleValidationErrors,
    (req, res) => caldavController.getSyncToken(req, res)
  );

  router.get('/api/caldav/calendars/:calendarId/changes',
    authenticateToken,
    [
      param('calendarId').isUUID(),
      query('syncToken').notEmpty().trim()
    ],
    handleValidationErrors,
    (req, res) => caldavController.getChangesSince(req, res)
  );

  // WebCal subscription endpoints (public, but can be authenticated)
  router.get('/webcal/:calendarId/calendar.ics',
    [param('calendarId').isUUID()],
    handleValidationErrors,
    (req, res) => caldavController.getWebCalFeed(req, res)
  );

  // Utility endpoints
  router.post('/api/caldav/maintenance/cleanup-locks',
    authenticateToken,
    (req, res) => caldavController.cleanupExpiredLocks(req, res)
  );

  return router;
}

// Middleware to handle CalDAV content types
export function caldavContentTypeMiddleware(req: any, res: any, next: any) {
  // Handle text/calendar content type for CalDAV requests
  if (req.headers['content-type'] && req.headers['content-type'].includes('text/calendar')) {
    let data = '';
    req.setEncoding('utf8');
    
    req.on('data', (chunk: string) => {
      data += chunk;
    });
    
    req.on('end', () => {
      req.body = data;
      next();
    });
  } else {
    next();
  }
}

// Middleware to set appropriate CORS headers for CalDAV
export function caldavCorsMiddleware(req: any, res: any, next: any) {
  // Allow CalDAV-specific headers
  res.set({
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Depth, If-Match, If-None-Match, Lock-Token, Timeout, Destination, Overwrite, Prefer, Brief',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK, REPORT',
    'Access-Control-Expose-Headers': 'DAV, ETag, Lock-Token, Preference-Applied, Vary'
  });

  // Set DAV compliance headers
  res.set({
    'DAV': '1, 2, 3, calendar-access, calendar-schedule, calendar-proxy',
    'MS-Author-Via': 'DAV'
  });

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
}