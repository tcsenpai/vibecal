import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../utils/database';
import { AuthRequest } from '../middleware/auth';
import { CreateEventRequest, VotingTimeSlot } from '../types';
import { generateGuestToken } from '../utils/auth';
import { io } from '../server';

export const createEventValidation = [
  body('title').isLength({ min: 1, max: 255 }),
  body('description').optional().isLength({ max: 1000 }),
  body('eventType').isIn(['regular', 'voting']),
  body('startTime').optional().isISO8601(),
  body('endTime').optional().isISO8601(),
  body('location').optional().isLength({ max: 255 }),
  body('isAllDay').optional().isBoolean(),
  body('isPublic').optional().isBoolean(),
  body('maxParticipants').optional().isInt({ min: 1 }),
];

export const createEvent = async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user!.userId;
    const eventData: CreateEventRequest = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create the event
      const eventResult = await client.query(
        `INSERT INTO events (title, description, creator_id, start_time, end_time, location, 
         is_all_day, is_recurring, recurrence_rule, event_type, is_public, max_participants)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          eventData.title,
          eventData.description,
          userId,
          eventData.startTime || null,
          eventData.endTime || null,
          eventData.location,
          eventData.isAllDay || false,
          eventData.isRecurring || false,
          eventData.recurrenceRule,
          eventData.eventType,
          eventData.isPublic || false,
          eventData.maxParticipants,
        ]
      );

      const event = eventResult.rows[0];

      // If it's a voting event, create voting settings and time slots
      if (eventData.eventType === 'voting') {
        const votingSettings = eventData.votingSettings || {};
        
        await client.query(
          `INSERT INTO voting_event_settings (event_id, voting_deadline, allow_guest_voting, 
           allow_maybe_votes, auto_finalize, min_votes_required)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            event.id,
            votingSettings.votingDeadline || null,
            votingSettings.allowGuestVoting || false,
            votingSettings.allowMaybeVotes !== false,
            votingSettings.autoFinalize || false,
            votingSettings.minVotesRequired || 1,
          ]
        );

        // Create time slots if provided
        if (eventData.timeSlots && eventData.timeSlots.length > 0) {
          for (const timeSlot of eventData.timeSlots) {
            await client.query(
              `INSERT INTO voting_time_slots (event_id, proposed_start_time, proposed_end_time, created_by)
               VALUES ($1, $2, $3, $4)`,
              [event.id, timeSlot.proposedStartTime, timeSlot.proposedEndTime, userId]
            );
          }
        }
      }

      // Add participants if provided
      if (eventData.participants && eventData.participants.length > 0) {
        for (const participantId of eventData.participants) {
          await client.query(
            'INSERT INTO event_participants (event_id, user_id) VALUES ($1, $2)',
            [event.id, participantId]
          );
        }
      }

      await client.query('COMMIT');

      res.status(201).json({
        id: event.id,
        title: event.title,
        description: event.description,
        creatorId: event.creator_id,
        startTime: event.start_time,
        endTime: event.end_time,
        location: event.location,
        isAllDay: event.is_all_day,
        eventType: event.event_type,
        isPublic: event.is_public,
        createdAt: event.created_at,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEvents = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { start, end } = req.query;

    let query = `
      SELECT e.*, u.username as creator_name,
             COUNT(ep.id) as participant_count
      FROM events e
      LEFT JOIN users u ON e.creator_id = u.id
      LEFT JOIN event_participants ep ON e.id = ep.event_id
      WHERE (e.creator_id = $1 OR e.is_public = true 
             OR EXISTS (SELECT 1 FROM event_participants ep2 WHERE ep2.event_id = e.id AND ep2.user_id = $1))
    `;
    
    const params: any[] = [userId];

    if (start && end) {
      query += ` AND e.start_time >= $${params.length + 1} AND e.start_time <= $${params.length + 2}`;
      params.push(start as string, end as string);
    }

    query += ' GROUP BY e.id, u.username ORDER BY e.start_time ASC';

    const result = await pool.query(query, params);

    const events = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      creatorId: row.creator_id,
      creatorName: row.creator_name,
      startTime: row.start_time,
      endTime: row.end_time,
      location: row.location,
      isAllDay: row.is_all_day,
      eventType: row.event_type,
      isPublic: row.is_public,
      participantCount: parseInt(row.participant_count),
      createdAt: row.created_at,
    }));

    res.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getEventDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    // Get event details
    const eventResult = await pool.query(
      `SELECT e.*, u.username as creator_name, u.email as creator_email
       FROM events e
       LEFT JOIN users u ON e.creator_id = u.id
       WHERE e.id = $1`,
      [id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];

    // Check permissions
    if (!event.is_public && event.creator_id !== userId) {
      const participantCheck = await pool.query(
        'SELECT 1 FROM event_participants WHERE event_id = $1 AND user_id = $2',
        [id, userId]
      );
      
      if (participantCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const response: any = {
      id: event.id,
      title: event.title,
      description: event.description,
      creatorId: event.creator_id,
      creatorName: event.creator_name,
      startTime: event.start_time,
      endTime: event.end_time,
      location: event.location,
      isAllDay: event.is_all_day,
      eventType: event.event_type,
      isPublic: event.is_public,
      createdAt: event.created_at,
    };

    // If it's a voting event, get voting data
    if (event.event_type === 'voting') {
      // Get voting settings
      const settingsResult = await pool.query(
        'SELECT * FROM voting_event_settings WHERE event_id = $1',
        [id]
      );
      
      if (settingsResult.rows.length > 0) {
        response.votingSettings = settingsResult.rows[0];
      }

      // Get time slots with vote counts
      const timeSlotsResult = await pool.query(
        `SELECT vts.*, 
                COUNT(CASE WHEN vr.vote_type = 'yes' THEN 1 END) as yes_votes,
                COUNT(CASE WHEN vr.vote_type = 'no' THEN 1 END) as no_votes,
                COUNT(CASE WHEN vr.vote_type = 'maybe' THEN 1 END) as maybe_votes,
                json_agg(
                  CASE WHEN vr.id IS NOT NULL THEN
                    json_build_object(
                      'id', vr.id,
                      'userId', vr.user_id,
                      'email', vr.email,
                      'name', vr.name,
                      'voteType', vr.vote_type,
                      'createdAt', vr.created_at
                    )
                  END
                ) FILTER (WHERE vr.id IS NOT NULL) as votes
         FROM voting_time_slots vts
         LEFT JOIN voting_responses vr ON vts.id = vr.time_slot_id
         WHERE vts.event_id = $1
         GROUP BY vts.id
         ORDER BY vts.proposed_start_time`,
        [id]
      );

      response.timeSlots = timeSlotsResult.rows.map(slot => ({
        id: slot.id,
        proposedStartTime: slot.proposed_start_time,
        proposedEndTime: slot.proposed_end_time,
        createdBy: slot.created_by,
        voteCount: {
          yes: parseInt(slot.yes_votes),
          no: parseInt(slot.no_votes),
          maybe: parseInt(slot.maybe_votes),
        },
        votes: slot.votes || [],
      }));
    }

    res.json(response);
  } catch (error) {
    console.error('Get event details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateEvent = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const eventData = req.body;

    // Check if event exists and user has permission to update
    const eventResult = await pool.query(
      'SELECT creator_id, event_type FROM events WHERE id = $1',
      [id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];

    if (event.creator_id !== userId) {
      return res.status(403).json({ error: 'Only event creator can update events' });
    }

    // Update event
    const updateResult = await pool.query(
      `UPDATE events 
       SET title = $1, description = $2, start_time = $3, end_time = $4, 
           location = $5, is_all_day = $6, is_public = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 
       RETURNING *`,
      [
        eventData.title,
        eventData.description,
        eventData.startTime,
        eventData.endTime,
        eventData.location,
        eventData.isAllDay || false,
        eventData.isPublic || false,
        id
      ]
    );

    const updatedEvent = updateResult.rows[0];

    res.json({
      id: updatedEvent.id,
      title: updatedEvent.title,
      description: updatedEvent.description,
      startTime: updatedEvent.start_time,
      endTime: updatedEvent.end_time,
      location: updatedEvent.location,
      isAllDay: updatedEvent.is_all_day,
      eventType: updatedEvent.event_type,
      isPublic: updatedEvent.is_public,
      createdAt: updatedEvent.created_at,
      updatedAt: updatedEvent.updated_at,
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteEvent = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Check if event exists and user has permission to delete
    const eventResult = await pool.query(
      'SELECT creator_id FROM events WHERE id = $1',
      [id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];

    if (event.creator_id !== userId) {
      return res.status(403).json({ error: 'Only event creator can delete events' });
    }

    // Delete the event (cascade will handle related records)
    await pool.query('DELETE FROM events WHERE id = $1', [id]);

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};