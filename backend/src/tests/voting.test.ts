import request from 'supertest';
import { app } from '../server';
import { 
  setupTestDatabase, 
  cleanupTestDatabase, 
  teardownTestDatabase, 
  createTestUser, 
  createTestEvent,
  generateTestToken,
  testDb 
} from './setup';

describe('Voting Events API', () => {
  let testUser: any;
  let otherUser: any;
  let authToken: string;
  let otherToken: string;
  let votingEvent: any;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
    
    testUser = await createTestUser();
    authToken = generateTestToken(testUser);
    
    otherUser = await createTestUser({
      email: 'other@example.com',
      username: 'otheruser'
    });
    otherToken = generateTestToken(otherUser);

    // Create a voting event with time slots
    votingEvent = await createTestEvent(testUser.id, {
      title: 'Team Planning Session',
      description: 'Planning session with voting',
      event_type: 'voting',
      is_public: true
    });

    // Add voting settings
    await testDb.query(`
      INSERT INTO voting_event_settings (event_id, allow_guest_voting, allow_maybe_votes, min_votes_required)
      VALUES ($1, $2, $3, $4)
    `, [votingEvent.id, true, true, 2]);

    // Add time slots
    await testDb.query(`
      INSERT INTO voting_time_slots (event_id, proposed_start_time, proposed_end_time, description)
      VALUES 
        ($1, $2, $3, $4),
        ($1, $5, $6, $7),
        ($1, $8, $9, $10)
    `, [
      votingEvent.id,
      '2024-06-01T10:00:00Z', '2024-06-01T11:00:00Z', 'Morning slot',
      '2024-06-01T14:00:00Z', '2024-06-01T15:00:00Z', 'Afternoon slot', 
      '2024-06-02T10:00:00Z', '2024-06-02T11:00:00Z', 'Next day slot'
    ]);
  });

  describe('GET /api/events/:id (voting event)', () => {
    it('should return voting event with time slots and settings', async () => {
      const response = await request(app)
        .get(`/api/events/${votingEvent.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.eventType).toBe('voting');
      expect(response.body).toHaveProperty('timeSlots');
      expect(response.body).toHaveProperty('votingSettings');
      expect(Array.isArray(response.body.timeSlots)).toBe(true);
      expect(response.body.timeSlots.length).toBe(3);
      expect(response.body.votingSettings.allowGuestVoting).toBe(true);
      expect(response.body.votingSettings.allowMaybeVotes).toBe(true);
      expect(response.body.votingSettings.minVotesRequired).toBe(2);
    });

    it('should include voting responses for authenticated user', async () => {
      // First submit some votes
      const timeSlots = await testDb.query('SELECT id FROM voting_time_slots WHERE event_id = $1', [votingEvent.id]);
      
      await testDb.query(`
        INSERT INTO voting_responses (event_id, time_slot_id, user_id, response_type)
        VALUES ($1, $2, $3, $4)
      `, [votingEvent.id, timeSlots.rows[0].id, testUser.id, 'yes']);

      const response = await request(app)
        .get(`/api/events/${votingEvent.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('userVotes');
      expect(Array.isArray(response.body.userVotes)).toBe(true);
    });
  });

  describe('POST /api/voting/events/:eventId/vote', () => {
    it('should submit voting responses successfully', async () => {
      const timeSlots = await testDb.query('SELECT id FROM voting_time_slots WHERE event_id = $1 ORDER BY id', [votingEvent.id]);
      
      const voteData = {
        votes: [
          { timeSlotId: timeSlots.rows[0].id, response: 'yes' },
          { timeSlotId: timeSlots.rows[1].id, response: 'maybe' },
          { timeSlotId: timeSlots.rows[2].id, response: 'no' }
        ]
      };

      const response = await request(app)
        .post(`/api/voting/events/${votingEvent.id}/vote`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(voteData)
        .expect(200);

      expect(response.body.message).toContain('submitted');
      expect(response.body).toHaveProperty('votes');
    });

    it('should update existing votes', async () => {
      const timeSlots = await testDb.query('SELECT id FROM voting_time_slots WHERE event_id = $1 ORDER BY id', [votingEvent.id]);
      
      // Submit initial vote
      const initialVote = {
        votes: [
          { timeSlotId: timeSlots.rows[0].id, response: 'yes' }
        ]
      };

      await request(app)
        .post(`/api/voting/events/${votingEvent.id}/vote`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(initialVote)
        .expect(200);

      // Update the vote
      const updatedVote = {
        votes: [
          { timeSlotId: timeSlots.rows[0].id, response: 'no' }
        ]
      };

      const response = await request(app)
        .post(`/api/voting/events/${votingEvent.id}/vote`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedVote)
        .expect(200);

      expect(response.body.message).toContain('submitted');

      // Verify the vote was updated
      const votes = await testDb.query(`
        SELECT response_type FROM voting_responses 
        WHERE event_id = $1 AND user_id = $2 AND time_slot_id = $3
      `, [votingEvent.id, testUser.id, timeSlots.rows[0].id]);

      expect(votes.rows[0].response_type).toBe('no');
    });

    it('should reject votes for non-existent time slots', async () => {
      const voteData = {
        votes: [
          { timeSlotId: 99999, response: 'yes' }
        ]
      };

      await request(app)
        .post(`/api/voting/events/${votingEvent.id}/vote`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(voteData)
        .expect(400);
    });

    it('should reject invalid vote responses', async () => {
      const timeSlots = await testDb.query('SELECT id FROM voting_time_slots WHERE event_id = $1', [votingEvent.id]);
      
      const voteData = {
        votes: [
          { timeSlotId: timeSlots.rows[0].id, response: 'invalid' }
        ]
      };

      await request(app)
        .post(`/api/voting/events/${votingEvent.id}/vote`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(voteData)
        .expect(400);
    });

    it('should reject maybe votes when not allowed', async () => {
      // Update voting settings to disallow maybe votes
      await testDb.query(`
        UPDATE voting_event_settings 
        SET allow_maybe_votes = false 
        WHERE event_id = $1
      `, [votingEvent.id]);

      const timeSlots = await testDb.query('SELECT id FROM voting_time_slots WHERE event_id = $1', [votingEvent.id]);
      
      const voteData = {
        votes: [
          { timeSlotId: timeSlots.rows[0].id, response: 'maybe' }
        ]
      };

      await request(app)
        .post(`/api/voting/events/${votingEvent.id}/vote`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(voteData)
        .expect(400);
    });
  });

  describe('GET /api/voting/events/:eventId/results', () => {
    beforeEach(async () => {
      // Add some voting responses for testing
      const timeSlots = await testDb.query('SELECT id FROM voting_time_slots WHERE event_id = $1 ORDER BY id', [votingEvent.id]);
      
      // User 1 votes
      await testDb.query(`
        INSERT INTO voting_responses (event_id, time_slot_id, user_id, response_type)
        VALUES 
          ($1, $2, $3, 'yes'),
          ($1, $4, $3, 'maybe'),
          ($1, $5, $3, 'no')
      `, [votingEvent.id, timeSlots.rows[0].id, testUser.id, timeSlots.rows[1].id, timeSlots.rows[2].id]);

      // User 2 votes
      await testDb.query(`
        INSERT INTO voting_responses (event_id, time_slot_id, user_id, response_type)
        VALUES 
          ($1, $2, $3, 'yes'),
          ($1, $4, $3, 'yes'),
          ($1, $5, $3, 'maybe')
      `, [votingEvent.id, timeSlots.rows[0].id, otherUser.id, timeSlots.rows[1].id, timeSlots.rows[2].id]);
    });

    it('should return voting results with aggregated counts', async () => {
      const response = await request(app)
        .get(`/api/voting/events/${votingEvent.id}/results`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('timeSlots');
      expect(response.body).toHaveProperty('summary');
      expect(Array.isArray(response.body.timeSlots)).toBe(true);

      const firstSlot = response.body.timeSlots[0];
      expect(firstSlot).toHaveProperty('votes');
      expect(firstSlot.votes).toHaveProperty('yes');
      expect(firstSlot.votes).toHaveProperty('maybe');
      expect(firstSlot.votes).toHaveProperty('no');
      expect(firstSlot.votes.yes).toBe(2); // Both users voted yes for first slot
    });

    it('should include participant details for event creator', async () => {
      const response = await request(app)
        .get(`/api/voting/events/${votingEvent.id}/results`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('participants');
      expect(Array.isArray(response.body.participants)).toBe(true);
      expect(response.body.participants.length).toBeGreaterThan(0);
    });

    it('should hide participant details for non-creators', async () => {
      const response = await request(app)
        .get(`/api/voting/events/${votingEvent.id}/results`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);

      // Non-creators should not see detailed participant information
      expect(response.body).toHaveProperty('timeSlots');
      expect(response.body.participants).toBeUndefined();
    });

    it('should calculate optimal time slots', async () => {
      const response = await request(app)
        .get(`/api/voting/events/${votingEvent.id}/results`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.summary).toHaveProperty('totalParticipants');
      expect(response.body.summary).toHaveProperty('mostPopularSlot');
      expect(response.body.summary.totalParticipants).toBe(2);
    });
  });

  describe('POST /api/voting/events/:eventId/finalize', () => {
    it('should finalize voting and convert to regular event', async () => {
      const timeSlots = await testDb.query('SELECT id FROM voting_time_slots WHERE event_id = $1 ORDER BY id', [votingEvent.id]);
      
      const finalizeData = {
        selectedTimeSlotId: timeSlots.rows[0].id
      };

      const response = await request(app)
        .post(`/api/voting/events/${votingEvent.id}/finalize`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(finalizeData)
        .expect(200);

      expect(response.body.message).toContain('finalized');
      expect(response.body.event.eventType).toBe('regular');
      expect(response.body.event.startTime).toBeDefined();
      expect(response.body.event.endTime).toBeDefined();
    });

    it('should reject finalization by non-creator', async () => {
      const timeSlots = await testDb.query('SELECT id FROM voting_time_slots WHERE event_id = $1', [votingEvent.id]);
      
      const finalizeData = {
        selectedTimeSlotId: timeSlots.rows[0].id
      };

      await request(app)
        .post(`/api/voting/events/${votingEvent.id}/finalize`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send(finalizeData)
        .expect(403);
    });

    it('should reject finalization with invalid time slot', async () => {
      const finalizeData = {
        selectedTimeSlotId: 99999
      };

      await request(app)
        .post(`/api/voting/events/${votingEvent.id}/finalize`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(finalizeData)
        .expect(400);
    });

    it('should check minimum votes requirement before finalizing', async () => {
      // Update to require more votes than we have
      await testDb.query(`
        UPDATE voting_event_settings 
        SET min_votes_required = 10 
        WHERE event_id = $1
      `, [votingEvent.id]);

      const timeSlots = await testDb.query('SELECT id FROM voting_time_slots WHERE event_id = $1', [votingEvent.id]);
      
      const finalizeData = {
        selectedTimeSlotId: timeSlots.rows[0].id
      };

      await request(app)
        .post(`/api/voting/events/${votingEvent.id}/finalize`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(finalizeData)
        .expect(400);
    });
  });

  describe('Guest voting', () => {
    it('should allow guest voting when enabled', async () => {
      const timeSlots = await testDb.query('SELECT id FROM voting_time_slots WHERE event_id = $1', [votingEvent.id]);
      
      // Create guest token
      const guestTokenResult = await testDb.query(`
        INSERT INTO guest_tokens (event_id, token, guest_name, guest_email)
        VALUES ($1, $2, $3, $4)
        RETURNING token
      `, [votingEvent.id, 'guest-token-123', 'Guest User', 'guest@example.com']);

      const voteData = {
        votes: [
          { timeSlotId: timeSlots.rows[0].id, response: 'yes' }
        ],
        guestToken: guestTokenResult.rows[0].token
      };

      const response = await request(app)
        .post(`/api/voting/events/${votingEvent.id}/vote`)
        .send(voteData)
        .expect(200);

      expect(response.body.message).toContain('submitted');
    });

    it('should reject guest voting when disabled', async () => {
      // Disable guest voting
      await testDb.query(`
        UPDATE voting_event_settings 
        SET allow_guest_voting = false 
        WHERE event_id = $1
      `, [votingEvent.id]);

      const timeSlots = await testDb.query('SELECT id FROM voting_time_slots WHERE event_id = $1', [votingEvent.id]);
      
      const voteData = {
        votes: [
          { timeSlotId: timeSlots.rows[0].id, response: 'yes' }
        ],
        guestToken: 'some-guest-token'
      };

      await request(app)
        .post(`/api/voting/events/${votingEvent.id}/vote`)
        .send(voteData)
        .expect(403);
    });
  });
});