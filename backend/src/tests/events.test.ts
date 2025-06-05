import request from 'supertest';
import { app } from '../server';
import { 
  setupTestDatabase, 
  cleanupTestDatabase, 
  teardownTestDatabase, 
  createTestUser, 
  createTestEvent,
  generateTestToken 
} from './setup';

describe('Events API', () => {
  let testUser: any;
  let authToken: string;

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
  });

  describe('POST /api/events', () => {
    it('should create a regular event successfully', async () => {
      const eventData = {
        title: 'Test Meeting',
        description: 'A test meeting',
        startTime: '2024-06-01T10:00:00Z',
        endTime: '2024-06-01T11:00:00Z',
        location: 'Conference Room A',
        eventType: 'regular',
        isPublic: false
      };

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send(eventData)
        .expect(201);

      expect(response.body.title).toBe(eventData.title);
      expect(response.body.description).toBe(eventData.description);
      expect(response.body.creatorId).toBe(testUser.id);
      expect(response.body.eventType).toBe('regular');
    });

    it('should create a voting event with time slots', async () => {
      const eventData = {
        title: 'Team Planning',
        description: 'Planning session with voting',
        eventType: 'voting',
        timeSlots: [
          {
            proposedStartTime: '2024-06-01T10:00:00Z',
            proposedEndTime: '2024-06-01T11:00:00Z'
          },
          {
            proposedStartTime: '2024-06-01T14:00:00Z',
            proposedEndTime: '2024-06-01T15:00:00Z'
          }
        ],
        votingSettings: {
          allowGuestVoting: true,
          allowMaybeVotes: true,
          minVotesRequired: 2
        }
      };

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send(eventData)
        .expect(201);

      expect(response.body.eventType).toBe('voting');
      expect(response.body.title).toBe(eventData.title);
    });

    it('should reject event creation without authentication', async () => {
      const eventData = {
        title: 'Unauthorized Event',
        eventType: 'regular'
      };

      await request(app)
        .post('/api/events')
        .send(eventData)
        .expect(401);
    });

    it('should reject event with missing required fields', async () => {
      const eventData = {
        description: 'Missing title',
        eventType: 'regular'
      };

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send(eventData)
        .expect(400);

      expect(response.body.error).toContain('Validation failed');
    });

    it('should reject event with invalid date range', async () => {
      const eventData = {
        title: 'Invalid Date Event',
        startTime: '2024-06-01T11:00:00Z',
        endTime: '2024-06-01T10:00:00Z', // End before start
        eventType: 'regular'
      };

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send(eventData)
        .expect(400);

      expect(response.body.error).toContain('End time must be after start time');
    });
  });

  describe('GET /api/events', () => {
    beforeEach(async () => {
      // Create test events
      await createTestEvent(testUser.id, {
        title: 'Past Event',
        start_time: '2024-05-01T10:00:00Z',
        end_time: '2024-05-01T11:00:00Z'
      });
      
      await createTestEvent(testUser.id, {
        title: 'Future Event',
        start_time: '2024-07-01T10:00:00Z',
        end_time: '2024-07-01T11:00:00Z'
      });

      // Create a public event by another user
      const otherUser = await createTestUser({ 
        email: 'other@example.com', 
        username: 'otheruser' 
      });
      
      await createTestEvent(otherUser.id, {
        title: 'Public Event',
        is_public: true,
        start_time: '2024-06-15T10:00:00Z',
        end_time: '2024-06-15T11:00:00Z'
      });
    });

    it('should return user events', async () => {
      const response = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Should include user's own events and public events
      const titles = response.body.map((e: any) => e.title);
      expect(titles).toContain('Past Event');
      expect(titles).toContain('Future Event');
      expect(titles).toContain('Public Event');
    });

    it('should filter events by date range', async () => {
      const response = await request(app)
        .get('/api/events')
        .query({
          start: '2024-06-01T00:00:00Z',
          end: '2024-06-30T23:59:59Z'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const events = response.body;
      expect(events.length).toBeGreaterThan(0);
      
      // Should only include events in June 2024
      events.forEach((event: any) => {
        const startTime = new Date(event.startTime);
        expect(startTime.getMonth()).toBe(5); // June (0-indexed)
      });
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/events')
        .expect(401);
    });
  });

  describe('GET /api/events/:id', () => {
    let testEvent: any;

    beforeEach(async () => {
      testEvent = await createTestEvent(testUser.id);
    });

    it('should return event details for creator', async () => {
      const response = await request(app)
        .get(`/api/events/${testEvent.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(testEvent.id);
      expect(response.body.title).toBe(testEvent.title);
      expect(response.body.creatorId).toBe(testUser.id);
    });

    it('should return public event details to any user', async () => {
      // Create another user
      const otherUser = await createTestUser({
        email: 'other@example.com',
        username: 'otheruser'
      });
      const otherToken = generateTestToken(otherUser);

      // Create public event
      const publicEvent = await createTestEvent(testUser.id, { is_public: true });

      const response = await request(app)
        .get(`/api/events/${publicEvent.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);

      expect(response.body.id).toBe(publicEvent.id);
      expect(response.body.isPublic).toBe(true);
    });

    it('should reject access to private event by non-creator', async () => {
      const otherUser = await createTestUser({
        email: 'other@example.com',
        username: 'otheruser'
      });
      const otherToken = generateTestToken(otherUser);

      await request(app)
        .get(`/api/events/${testEvent.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent event', async () => {
      await request(app)
        .get('/api/events/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PUT /api/events/:id', () => {
    let testEvent: any;

    beforeEach(async () => {
      testEvent = await createTestEvent(testUser.id);
    });

    it('should update event by creator', async () => {
      const updateData = {
        title: 'Updated Event Title',
        description: 'Updated description',
        location: 'New Location'
      };

      const response = await request(app)
        .put(`/api/events/${testEvent.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.title).toBe(updateData.title);
      expect(response.body.description).toBe(updateData.description);
      expect(response.body.location).toBe(updateData.location);
    });

    it('should reject update by non-creator', async () => {
      const otherUser = await createTestUser({
        email: 'other@example.com',
        username: 'otheruser'
      });
      const otherToken = generateTestToken(otherUser);

      const updateData = { title: 'Hacked Title' };

      await request(app)
        .put(`/api/events/${testEvent.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send(updateData)
        .expect(403);
    });
  });

  describe('DELETE /api/events/:id', () => {
    let testEvent: any;

    beforeEach(async () => {
      testEvent = await createTestEvent(testUser.id);
    });

    it('should delete event by creator', async () => {
      await request(app)
        .delete(`/api/events/${testEvent.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify event is deleted
      await request(app)
        .get(`/api/events/${testEvent.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should reject deletion by non-creator', async () => {
      const otherUser = await createTestUser({
        email: 'other@example.com',
        username: 'otheruser'
      });
      const otherToken = generateTestToken(otherUser);

      await request(app)
        .delete(`/api/events/${testEvent.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });
  });
});