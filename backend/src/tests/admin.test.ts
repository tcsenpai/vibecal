import request from 'supertest';
import { app } from '../server';
import { 
  setupTestDatabase, 
  cleanupTestDatabase, 
  teardownTestDatabase, 
  createTestUser, 
  createTestCalendar,
  generateTestToken 
} from './setup';

describe('Admin API', () => {
  let adminUser: any;
  let regularUser: any;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
    
    // Create admin user
    adminUser = await createTestUser({
      email: 'admin@example.com',
      username: 'admin',
      is_admin: true
    });
    adminToken = generateTestToken(adminUser);

    // Create regular user
    regularUser = await createTestUser({
      email: 'user@example.com',
      username: 'user',
      is_admin: false
    });
    userToken = generateTestToken(regularUser);
  });

  describe('GET /api/admin/stats', () => {
    it('should return system statistics for admin', async () => {
      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('events');
      expect(response.body).toHaveProperty('calendars');
      expect(response.body).toHaveProperty('recentActivity');
      expect(response.body.users).toHaveProperty('total');
      expect(response.body.users).toHaveProperty('verified');
      expect(response.body.events).toHaveProperty('total');
      expect(response.body.calendars).toHaveProperty('total');
    });

    it('should reject access for non-admin users', async () => {
      await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should reject unauthenticated requests', async () => {
      await request(app)
        .get('/api/admin/stats')
        .expect(401);
    });
  });

  describe('GET /api/admin/webdav/settings', () => {
    it('should return WebDAV settings for admin', async () => {
      const response = await request(app)
        .get('/api/admin/webdav/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('globalSettings');
      expect(response.body).toHaveProperty('userSettings');
      expect(Array.isArray(response.body.userSettings)).toBe(true);
    });

    it('should reject access for non-admin users', async () => {
      await request(app)
        .get('/api/admin/webdav/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('GET /api/admin/webdav/metrics', () => {
    beforeEach(async () => {
      // Create test calendar for metrics
      await createTestCalendar(regularUser.id, {
        webdav_enabled: true,
        webcal_enabled: true
      });
    });

    it('should return WebDAV metrics for admin', async () => {
      const response = await request(app)
        .get('/api/admin/webdav/metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('calendars');
      expect(response.body).toHaveProperty('syncActivity');
      expect(response.body).toHaveProperty('performance');
      expect(response.body.calendars).toHaveProperty('total');
      expect(response.body.calendars).toHaveProperty('webdavEnabled');
      expect(response.body.calendars).toHaveProperty('webcalEnabled');
    });

    it('should reject access for non-admin users', async () => {
      await request(app)
        .get('/api/admin/webdav/metrics')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('GET /api/admin/webdav/sync-status', () => {
    it('should return calendar sync status for admin', async () => {
      const response = await request(app)
        .get('/api/admin/webdav/sync-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should reject access for non-admin users', async () => {
      await request(app)
        .get('/api/admin/webdav/sync-status')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('PUT /api/admin/webdav/users/:userId/settings', () => {
    it('should update user WebDAV settings for admin', async () => {
      const updateData = {
        webdavEnabled: true,
        webcalEnabled: false,
        syncFrequency: 'hourly'
      };

      const response = await request(app)
        .put(`/api/admin/webdav/users/${regularUser.id}/settings`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toContain('updated');
    });

    it('should reject invalid user ID', async () => {
      const updateData = {
        webdavEnabled: true
      };

      await request(app)
        .put('/api/admin/webdav/users/invalid/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(400);
    });

    it('should reject access for non-admin users', async () => {
      const updateData = {
        webdavEnabled: true
      };

      await request(app)
        .put(`/api/admin/webdav/users/${regularUser.id}/settings`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(403);
    });
  });

  describe('POST /api/admin/webdav/cleanup', () => {
    it('should perform cleanup operation for admin', async () => {
      const response = await request(app)
        .post('/api/admin/webdav/cleanup')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('cleaned');
      expect(response.body.message).toContain('cleanup completed');
    });

    it('should reject access for non-admin users', async () => {
      await request(app)
        .post('/api/admin/webdav/cleanup')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
});