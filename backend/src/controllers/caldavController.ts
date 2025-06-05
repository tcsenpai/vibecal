import { Request, Response } from 'express';
import { Pool } from 'pg';
import { v2 as webdav } from 'webdav-server';
import { CalDAVService } from '../services/caldavService';
import { CalDAVFileSystem } from '../services/webdavFileSystem';
import logger from '../utils/logger';
import basicAuth from 'basic-auth';
import jwt from 'jsonwebtoken';

export class CalDAVController {
  private caldavService: CalDAVService;
  private webdavServer: webdav.WebDAVServer;

  constructor(database: Pool) {
    this.caldavService = new CalDAVService(database);
    
    // Initialize WebDAV server
    this.webdavServer = new webdav.WebDAVServer({
      filesystem: new CalDAVFileSystem(database),
      authentication: this.createAuthenticationManager(),
      httpAuthentication: new webdav.HTTPBasicAuthentication(this.authenticateUser.bind(this))
    });
  }

  private createAuthenticationManager(): webdav.PrivilegeManager {
    return new webdav.SimpleUserManager();
  }

  private async authenticateUser(username: string, password: string, callback: (error: Error | null, isValid?: boolean) => void): Promise<void> {
    try {
      // For now, we'll use JWT token in password field for API authentication
      // In production, you might want to support both username/password and token auth
      
      if (!password) {
        return callback(null, false);
      }

      // Try to decode JWT token
      try {
        const decoded = jwt.verify(password, process.env.JWT_SECRET!) as any;
        
        // Store user info in context (this is a simple approach)
        // In a real implementation, you'd want to fetch full user details
        callback(null, true);
      } catch (jwtError) {
        logger.warn('CalDAV authentication failed:', jwtError);
        callback(null, false);
      }
    } catch (error) {
      logger.error('CalDAV authentication error:', error);
      callback(error as Error, false);
    }
  }

  // WebDAV/CalDAV request handler
  async handleWebDAVRequest(req: Request, res: Response): Promise<void> {
    try {
      // Extract user from JWT token
      const authHeader = req.headers.authorization;
      let user = null;

      if (authHeader) {
        if (authHeader.startsWith('Bearer ')) {
          // JWT Bearer token
          const token = authHeader.substring(7);
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
            user = decoded;
          } catch (error) {
            logger.warn('Invalid JWT token in CalDAV request');
          }
        } else if (authHeader.startsWith('Basic ')) {
          // Basic auth - decode and check if password is JWT
          const credentials = basicAuth(req);
          if (credentials && credentials.pass) {
            try {
              const decoded = jwt.verify(credentials.pass, process.env.JWT_SECRET!) as any;
              user = decoded;
            } catch (error) {
              logger.warn('Invalid JWT token in Basic auth');
            }
          }
        }
      }

      if (!user) {
        res.status(401).set('WWW-Authenticate', 'Basic realm="CalDAV"').send('Authentication required');
        return;
      }

      // Attach user to context
      (req as any).user = user;

      // Execute WebDAV request
      this.webdavServer.executeRequest(req as any, res as any);
    } catch (error) {
      logger.error('Error handling WebDAV request:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Calendar collection operations

  async getCalendars(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const calendars = await this.caldavService.getCalendars(user.id);
      
      res.json({
        calendars: calendars.map(cal => ({
          id: cal.id,
          name: cal.name,
          displayName: cal.displayName,
          description: cal.description,
          color: cal.color,
          timezone: cal.timezone,
          isDefault: cal.isDefault,
          isPublic: cal.isPublic,
          webdavEnabled: cal.webdavEnabled,
          webcalEnabled: cal.webcalEnabled,
          syncToken: cal.syncToken,
          webdavUrl: `/caldav/${cal.id}/`,
          webcalUrl: `/webcal/${cal.id}/calendar.ics`
        }))
      });
    } catch (error) {
      logger.error('Error getting calendars:', error);
      res.status(500).json({ error: 'Failed to fetch calendars' });
    }
  }

  async createCalendar(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { name, displayName, description, color, timezone } = req.body;

      const calendar = await this.caldavService.createCalendar(user.id, {
        name,
        displayName,
        description,
        color,
        timezone
      });

      res.status(201).json({
        id: calendar.id,
        name: calendar.name,
        displayName: calendar.displayName,
        description: calendar.description,
        color: calendar.color,
        timezone: calendar.timezone,
        webdavUrl: `/caldav/${calendar.id}/`,
        webcalUrl: `/webcal/${calendar.id}/calendar.ics`
      });
    } catch (error) {
      logger.error('Error creating calendar:', error);
      res.status(500).json({ error: 'Failed to create calendar' });
    }
  }

  async updateCalendar(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { calendarId } = req.params;
      const updates = req.body;

      const calendar = await this.caldavService.updateCalendar(calendarId, user.id, updates);

      res.json({
        id: calendar.id,
        name: calendar.name,
        displayName: calendar.displayName,
        description: calendar.description,
        color: calendar.color,
        timezone: calendar.timezone
      });
    } catch (error) {
      logger.error('Error updating calendar:', error);
      res.status(500).json({ error: 'Failed to update calendar' });
    }
  }

  async deleteCalendar(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { calendarId } = req.params;

      await this.caldavService.deleteCalendar(calendarId, user.id);
      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting calendar:', error);
      res.status(500).json({ error: 'Failed to delete calendar' });
    }
  }

  // WebCal feed endpoint

  async getWebCalFeed(req: Request, res: Response): Promise<void> {
    try {
      const { calendarId } = req.params;
      
      // For WebCal, we need to determine the user based on calendar access
      // This is a simplified approach - in production you might want public calendar support
      const authHeader = req.headers.authorization;
      let user = null;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
          user = decoded;
        } catch (error) {
          logger.warn('Invalid JWT token for WebCal feed');
        }
      }

      if (!user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const icalendarData = await this.caldavService.generateICalendarFeed(calendarId, user.id);

      res.set({
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="calendar.ics"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      res.send(icalendarData);
    } catch (error) {
      logger.error('Error generating WebCal feed:', error);
      res.status(500).json({ error: 'Failed to generate calendar feed' });
    }
  }

  // Calendar query operations

  async queryCalendarObjects(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { calendarId } = req.params;
      const { start, end, componentType } = req.query;

      const query = {
        calendarId,
        timeRange: start && end ? {
          start: new Date(start as string),
          end: new Date(end as string)
        } : undefined,
        componentType: componentType as string
      };

      const objects = await this.caldavService.queryCalendarObjects(query, user.id);

      res.json({
        objects: objects.map(obj => ({
          id: obj.id,
          uid: obj.uid,
          etag: obj.etag,
          componentType: obj.componentType,
          summary: obj.summary,
          dtstart: obj.dtstart,
          dtend: obj.dtend,
          icalendarData: obj.icalendarData
        }))
      });
    } catch (error) {
      logger.error('Error querying calendar objects:', error);
      res.status(500).json({ error: 'Failed to query calendar objects' });
    }
  }

  // Sync operations

  async getSyncToken(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { calendarId } = req.params;

      const syncToken = await this.caldavService.getSyncToken(calendarId, user.id);

      res.json({ syncToken });
    } catch (error) {
      logger.error('Error getting sync token:', error);
      res.status(500).json({ error: 'Failed to get sync token' });
    }
  }

  async getChangesSince(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { calendarId } = req.params;
      const { syncToken } = req.query;

      if (!syncToken) {
        res.status(400).json({ error: 'syncToken parameter is required' });
        return;
      }

      const changes = await this.caldavService.getChangesSince(calendarId, syncToken as string, user.id);

      res.json({
        changes: changes.map(change => ({
          id: change.id,
          objectId: change.objectId,
          changeType: change.changeType,
          resourcePath: change.resourcePath,
          etag: change.etag,
          createdAt: change.createdAt
        })),
        newSyncToken: await this.caldavService.getSyncToken(calendarId, user.id)
      });
    } catch (error) {
      logger.error('Error getting changes since sync token:', error);
      res.status(500).json({ error: 'Failed to get changes' });
    }
  }

  // Calendar object operations

  async getCalendarObject(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { calendarId, objectId } = req.params;

      const object = await this.caldavService.getCalendarObject(calendarId, objectId, user.id);

      if (!object) {
        res.status(404).json({ error: 'Calendar object not found' });
        return;
      }

      res.set({
        'Content-Type': 'text/calendar; charset=utf-8',
        'ETag': `"${object.etag}"`
      });

      res.send(object.icalendarData);
    } catch (error) {
      logger.error('Error getting calendar object:', error);
      res.status(500).json({ error: 'Failed to get calendar object' });
    }
  }

  async createCalendarObject(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { calendarId } = req.params;
      const icalendarData = req.body;

      if (typeof icalendarData !== 'string') {
        res.status(400).json({ error: 'iCalendar data must be provided as text' });
        return;
      }

      const object = await this.caldavService.createCalendarObject(calendarId, user.id, icalendarData);

      res.status(201).set({
        'ETag': `"${object.etag}"`
      }).json({
        id: object.id,
        uid: object.uid,
        etag: object.etag
      });
    } catch (error) {
      logger.error('Error creating calendar object:', error);
      res.status(500).json({ error: 'Failed to create calendar object' });
    }
  }

  async updateCalendarObject(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { calendarId, objectId } = req.params;
      const icalendarData = req.body;

      if (typeof icalendarData !== 'string') {
        res.status(400).json({ error: 'iCalendar data must be provided as text' });
        return;
      }

      const object = await this.caldavService.updateCalendarObject(calendarId, objectId, user.id, icalendarData);

      res.set({
        'ETag': `"${object.etag}"`
      }).json({
        id: object.id,
        uid: object.uid,
        etag: object.etag
      });
    } catch (error) {
      logger.error('Error updating calendar object:', error);
      res.status(500).json({ error: 'Failed to update calendar object' });
    }
  }

  async deleteCalendarObject(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { calendarId, objectId } = req.params;

      await this.caldavService.deleteCalendarObject(calendarId, objectId, user.id);

      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting calendar object:', error);
      res.status(500).json({ error: 'Failed to delete calendar object' });
    }
  }

  // Utility methods

  async cleanupExpiredLocks(req: Request, res: Response): Promise<void> {
    try {
      const deletedCount = await this.caldavService.cleanupExpiredLocks();
      res.json({ deletedLocks: deletedCount });
    } catch (error) {
      logger.error('Error cleaning up expired locks:', error);
      res.status(500).json({ error: 'Failed to cleanup locks' });
    }
  }
}