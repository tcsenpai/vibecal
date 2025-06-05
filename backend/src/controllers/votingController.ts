import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../utils/database';
import { AuthRequest } from '../middleware/auth';
import { generateGuestToken } from '../utils/auth';
import { io } from '../server';

export const voteValidation = [
  body('timeSlotId').isInt(),
  body('voteType').isIn(['yes', 'no', 'maybe']),
  body('email').optional().isEmail(),
  body('name').optional().isLength({ min: 1, max: 255 }),
];

export const submitVote = async (req: AuthRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { timeSlotId, voteType, email, name } = req.body;
    const userId = req.user?.userId;

    // Get the time slot and event details
    const timeSlotResult = await pool.query(
      `SELECT vts.*, e.id as event_id, e.title, ves.allow_guest_voting, ves.allow_maybe_votes, ves.voting_deadline
       FROM voting_time_slots vts
       JOIN events e ON vts.event_id = e.id
       JOIN voting_event_settings ves ON e.id = ves.event_id
       WHERE vts.id = $1`,
      [timeSlotId]
    );

    if (timeSlotResult.rows.length === 0) {
      return res.status(404).json({ error: 'Time slot not found' });
    }

    const timeSlot = timeSlotResult.rows[0];

    // Check if voting is still allowed
    if (timeSlot.voting_deadline && new Date() > new Date(timeSlot.voting_deadline)) {
      return res.status(400).json({ error: 'Voting deadline has passed' });
    }

    // Check if maybe votes are allowed
    if (voteType === 'maybe' && !timeSlot.allow_maybe_votes) {
      return res.status(400).json({ error: 'Maybe votes are not allowed for this event' });
    }

    // Check guest voting permissions
    if (!userId && !timeSlot.allow_guest_voting) {
      return res.status(403).json({ error: 'Guest voting is not allowed for this event' });
    }

    if (!userId && (!email || !name)) {
      return res.status(400).json({ error: 'Email and name are required for guest voting' });
    }

    // Check for existing vote
    let existingVoteQuery;
    let existingVoteParams;

    if (userId) {
      existingVoteQuery = 'SELECT id FROM voting_responses WHERE time_slot_id = $1 AND user_id = $2';
      existingVoteParams = [timeSlotId, userId];
    } else {
      existingVoteQuery = 'SELECT id FROM voting_responses WHERE time_slot_id = $1 AND email = $2';
      existingVoteParams = [timeSlotId, email];
    }

    const existingVote = await pool.query(existingVoteQuery, existingVoteParams);

    let result;
    if (existingVote.rows.length > 0) {
      // Update existing vote
      result = await pool.query(
        `UPDATE voting_responses 
         SET vote_type = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [voteType, existingVote.rows[0].id]
      );
    } else {
      // Create new vote
      result = await pool.query(
        `INSERT INTO voting_responses (time_slot_id, user_id, email, name, vote_type)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [timeSlotId, userId || null, email || null, name || null, voteType]
      );
    }

    const vote = result.rows[0];

    // Emit real-time update
    io.to(`event-${timeSlot.event_id}`).emit('vote-updated', {
      timeSlotId,
      eventId: timeSlot.event_id,
      vote: {
        id: vote.id,
        userId: vote.user_id,
        email: vote.email,
        name: vote.name,
        voteType: vote.vote_type,
        createdAt: vote.created_at,
      }
    });

    res.json({
      id: vote.id,
      timeSlotId: vote.time_slot_id,
      userId: vote.user_id,
      email: vote.email,
      name: vote.name,
      voteType: vote.vote_type,
      createdAt: vote.created_at,
    });
  } catch (error) {
    console.error('Submit vote error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addTimeSlot = async (req: AuthRequest, res: Response) => {
  try {
    const { eventId } = req.params;
    const { proposedStartTime, proposedEndTime } = req.body;
    const userId = req.user!.userId;

    // Check if user has permission to add time slots
    const eventCheck = await pool.query(
      `SELECT e.creator_id, e.event_type
       FROM events e
       WHERE e.id = $1 AND e.event_type = 'voting'`,
      [eventId]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Voting event not found' });
    }

    const event = eventCheck.rows[0];

    // Check if user is creator or participant
    if (event.creator_id !== userId) {
      const participantCheck = await pool.query(
        'SELECT 1 FROM event_participants WHERE event_id = $1 AND user_id = $2',
        [eventId, userId]
      );
      
      if (participantCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Add the time slot
    const result = await pool.query(
      `INSERT INTO voting_time_slots (event_id, proposed_start_time, proposed_end_time, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [eventId, proposedStartTime, proposedEndTime, userId]
    );

    const timeSlot = result.rows[0];

    // Emit real-time update
    io.to(`event-${eventId}`).emit('time-slot-added', {
      eventId,
      timeSlot: {
        id: timeSlot.id,
        proposedStartTime: timeSlot.proposed_start_time,
        proposedEndTime: timeSlot.proposed_end_time,
        createdBy: timeSlot.created_by,
        createdAt: timeSlot.created_at,
      }
    });

    res.status(201).json({
      id: timeSlot.id,
      eventId: timeSlot.event_id,
      proposedStartTime: timeSlot.proposed_start_time,
      proposedEndTime: timeSlot.proposed_end_time,
      createdBy: timeSlot.created_by,
      createdAt: timeSlot.created_at,
    });
  } catch (error) {
    console.error('Add time slot error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const generateGuestVotingLink = async (req: AuthRequest, res: Response) => {
  try {
    const { eventId } = req.params;
    const { email, name } = req.body;
    const userId = req.user!.userId;

    // Check if user is event creator
    const eventCheck = await pool.query(
      `SELECT e.creator_id, ves.allow_guest_voting
       FROM events e
       JOIN voting_event_settings ves ON e.id = ves.event_id
       WHERE e.id = $1 AND e.event_type = 'voting'`,
      [eventId]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Voting event not found' });
    }

    const event = eventCheck.rows[0];

    if (event.creator_id !== userId) {
      return res.status(403).json({ error: 'Only event creator can generate guest links' });
    }

    if (!event.allow_guest_voting) {
      return res.status(400).json({ error: 'Guest voting is not enabled for this event' });
    }

    // Generate token
    const token = generateGuestToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Token expires in 7 days

    await pool.query(
      `INSERT INTO guest_tokens (token, event_id, email, name, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [token, eventId, email, name, expiresAt]
    );

    const votingLink = `${process.env.FRONTEND_URL}/vote/${eventId}?token=${token}`;

    res.json({
      token,
      votingLink,
      email,
      name,
      expiresAt,
    });
  } catch (error) {
    console.error('Generate guest voting link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const finalizeVotingEvent = async (req: AuthRequest, res: Response) => {
  try {
    const { eventId } = req.params;
    const { timeSlotId } = req.body;
    const userId = req.user!.userId;

    // Check if user is event creator
    const eventCheck = await pool.query(
      'SELECT creator_id FROM events WHERE id = $1 AND event_type = \'voting\'',
      [eventId]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Voting event not found' });
    }

    if (eventCheck.rows[0].creator_id !== userId) {
      return res.status(403).json({ error: 'Only event creator can finalize voting' });
    }

    // Get the selected time slot
    const timeSlotResult = await pool.query(
      'SELECT * FROM voting_time_slots WHERE id = $1 AND event_id = $2',
      [timeSlotId, eventId]
    );

    if (timeSlotResult.rows.length === 0) {
      return res.status(404).json({ error: 'Time slot not found' });
    }

    const timeSlot = timeSlotResult.rows[0];

    // Update the event with the finalized time
    await pool.query(
      `UPDATE events 
       SET start_time = $1, end_time = $2, event_type = 'regular', updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [timeSlot.proposed_start_time, timeSlot.proposed_end_time, eventId]
    );

    // Emit real-time update
    io.to(`event-${eventId}`).emit('event-finalized', {
      eventId,
      startTime: timeSlot.proposed_start_time,
      endTime: timeSlot.proposed_end_time,
    });

    res.json({
      eventId,
      startTime: timeSlot.proposed_start_time,
      endTime: timeSlot.proposed_end_time,
      message: 'Event has been finalized',
    });
  } catch (error) {
    console.error('Finalize voting event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};