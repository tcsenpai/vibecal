import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import ical from 'ical-generator';
import { authenticateToken } from '../middleware/auth';
import { param } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation';
import { logger } from '../utils/logger';

export function createWebCalRoutes(database: Pool): Router {
  const router = Router();

  // WebCal feed endpoint
  router.get('/webcal/:calendarId/calendar.ics',
    [param('calendarId').isUUID()],
    handleValidationErrors,
    async (req: Request, res: Response) => {
      try {
        const { calendarId } = req.params;
        
        // For now, we'll require authentication for WebCal feeds
        // In the future, you could add public calendar support
        const authHeader = req.headers.authorization;
        let userId = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
          const jwt = require('jsonwebtoken');
          const token = authHeader.substring(7);
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
            userId = decoded.id;
          } catch (error) {
            logger.warn('Invalid JWT token for WebCal feed');
          }
        }

        if (!userId) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }

        // Fetch calendar info
        const calendarResult = await database.query(
          'SELECT * FROM calendars WHERE id = $1 AND user_id = $2',
          [calendarId, userId]
        );

        if (calendarResult.rows.length === 0) {
          res.status(404).json({ error: 'Calendar not found' });
          return;
        }

        const calendar = calendarResult.rows[0];

        // Fetch events for this calendar
        const eventsResult = await database.query(`
          SELECT co.*, e.title as event_title, e.description as event_description, 
                 e.location as event_location, e.start_time, e.end_time
          FROM calendar_objects co
          LEFT JOIN events e ON co.event_id = e.id
          WHERE co.calendar_id = $1 AND co.component_type = 'VEVENT'
          ORDER BY co.dtstart ASC
        `, [calendarId]);

        // Generate iCalendar feed
        const cal = ical({
          name: calendar.display_name || calendar.name,
          description: calendar.description || `Calendar feed for ${calendar.name}`,
          timezone: calendar.timezone || 'UTC',
          prodId: {
            company: 'VibeCal',
            product: 'VibeCal Calendar',
            language: 'EN'
          }
        });

        // Add events to calendar
        eventsResult.rows.forEach((eventRow) => {
          try {
            const eventData = {
              uid: eventRow.uid,
              start: eventRow.dtstart || eventRow.start_time ? new Date(eventRow.dtstart || eventRow.start_time) : new Date(),
              end: eventRow.dtend || eventRow.end_time ? new Date(eventRow.dtend || eventRow.end_time) : new Date(),
              summary: eventRow.summary || eventRow.event_title || 'No Title',
              description: eventRow.event_description,
              location: eventRow.event_location,
              timestamp: eventRow.dtstamp ? new Date(eventRow.dtstamp) : new Date(),
              sequence: eventRow.sequence || 0,
              status: (eventRow.status || 'CONFIRMED').toLowerCase() as any
            };

            cal.createEvent(eventData);
          } catch (eventError) {
            logger.warn('Error adding event to calendar feed:', eventError);
          }
        });

        // Set appropriate headers
        res.set({
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': `attachment; filename="${calendar.name}.ics"`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });

        res.send(cal.toString());
      } catch (error) {
        logger.error('Error generating WebCal feed:', error);
        res.status(500).json({ error: 'Failed to generate calendar feed' });
      }
    }
  );

  // Calendar management API endpoints
  router.get('/api/calendars',
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const user = (req as any).user;
        const result = await database.query(
          'SELECT * FROM calendars WHERE user_id = $1 ORDER BY is_default DESC, name ASC',
          [user.id]
        );

        const calendars = result.rows.map(cal => ({
          id: cal.id,
          name: cal.name,
          displayName: cal.display_name,
          description: cal.description,
          color: cal.color,
          timezone: cal.timezone,
          isDefault: cal.is_default,
          isPublic: cal.is_public,
          webcalEnabled: cal.webcal_enabled,
          webcalUrl: `/webcal/${cal.id}/calendar.ics`
        }));

        res.json({ calendars });
      } catch (error) {
        logger.error('Error fetching calendars:', error);
        res.status(500).json({ error: 'Failed to fetch calendars' });
      }
    }
  );

  router.post('/api/calendars',
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const user = (req as any).user;
        const { name, displayName, description, color, timezone } = req.body;

        const result = await database.query(`
          INSERT INTO calendars (user_id, name, display_name, description, color, timezone)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `, [
          user.id,
          name || 'New Calendar',
          displayName || name || 'New Calendar',
          description,
          color || '#3B82F6',
          timezone || 'UTC'
        ]);

        const calendar = result.rows[0];
        res.status(201).json({
          id: calendar.id,
          name: calendar.name,
          displayName: calendar.display_name,
          description: calendar.description,
          color: calendar.color,
          timezone: calendar.timezone,
          webcalUrl: `/webcal/${calendar.id}/calendar.ics`
        });
      } catch (error) {
        logger.error('Error creating calendar:', error);
        res.status(500).json({ error: 'Failed to create calendar' });
      }
    }
  );

  return router;
}