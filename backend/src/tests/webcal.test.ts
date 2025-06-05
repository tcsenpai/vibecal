import request from 'supertest';
import { app } from '../server';
import { 
  setupTestDatabase, 
  cleanupTestDatabase, 
  teardownTestDatabase, 
  createTestUser, 
  createTestCalendar,
  createTestEvent,
  testDb 
} from './setup';

describe('WebCal API', () => {
  let testUser: any;
  let testCalendar: any;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
    testUser = await createTestUser();
    testCalendar = await createTestCalendar(testUser.id, {
      webcal_enabled: true,
      is_public: true
    });
  });

  describe('GET /webcal/:calendarId.ics', () => {
    beforeEach(async () => {
      // Create test events in the calendar
      await createTestEvent(testUser.id, {
        title: 'Test Event 1',
        description: 'First test event',
        start_time: '2024-06-01T10:00:00Z',
        end_time: '2024-06-01T11:00:00Z',
        location: 'Conference Room A'
      });

      await createTestEvent(testUser.id, {
        title: 'Test Event 2',
        description: 'Second test event',
        start_time: '2024-06-02T14:00:00Z',
        end_time: '2024-06-02T15:00:00Z',
        location: 'Conference Room B'
      });

      // Link events to calendar
      await testDb.query(`
        INSERT INTO calendar_objects (calendar_id, event_id, object_type, ical_data)
        SELECT $1, e.id, 'VEVENT', 
               'BEGIN:VEVENT' || chr(13) || chr(10) ||
               'UID:' || e.id || '@vibecal.local' || chr(13) || chr(10) ||
               'DTSTART:' || to_char(e.start_time AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS"Z"') || chr(13) || chr(10) ||
               'DTEND:' || to_char(e.end_time AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS"Z"') || chr(13) || chr(10) ||
               'SUMMARY:' || e.title || chr(13) || chr(10) ||
               'DESCRIPTION:' || COALESCE(e.description, '') || chr(13) || chr(10) ||
               'LOCATION:' || COALESCE(e.location, '') || chr(13) || chr(10) ||
               'END:VEVENT'
        FROM events e
        WHERE e.creator_id = $2
      `, [testCalendar.id, testUser.id]);
    });

    it('should return valid iCalendar feed for public calendar', async () => {
      const response = await request(app)
        .get(`/webcal/${testCalendar.id}.ics`)
        .expect(200)
        .expect('Content-Type', /text\/calendar/);

      const icalData = response.text;

      // Check iCalendar structure
      expect(icalData).toContain('BEGIN:VCALENDAR');
      expect(icalData).toContain('END:VCALENDAR');
      expect(icalData).toContain('VERSION:2.0');
      expect(icalData).toContain('PRODID:-//VibeCal//VibeCal Calendar//EN');
      expect(icalData).toContain('CALSCALE:GREGORIAN');

      // Check events are included
      expect(icalData).toContain('BEGIN:VEVENT');
      expect(icalData).toContain('END:VEVENT');
      expect(icalData).toContain('Test Event 1');
      expect(icalData).toContain('Test Event 2');
      expect(icalData).toContain('Conference Room A');
      expect(icalData).toContain('Conference Room B');

      // Check proper date formatting
      expect(icalData).toContain('DTSTART:20240601T100000Z');
      expect(icalData).toContain('DTEND:20240601T110000Z');
    });

    it('should return 404 for non-existent calendar', async () => {
      const fakeCalendarId = '550e8400-e29b-41d4-a716-446655440000';
      
      await request(app)
        .get(`/webcal/${fakeCalendarId}.ics`)
        .expect(404);
    });

    it('should return 403 for private calendar without webcal enabled', async () => {
      const privateCalendar = await createTestCalendar(testUser.id, {
        webcal_enabled: false,
        is_public: false
      });

      await request(app)
        .get(`/webcal/${privateCalendar.id}.ics`)
        .expect(403);
    });

    it('should filter events by date range when provided', async () => {
      const response = await request(app)
        .get(`/webcal/${testCalendar.id}.ics`)
        .query({
          start: '2024-06-01T00:00:00Z',
          end: '2024-06-01T23:59:59Z'
        })
        .expect(200);

      const icalData = response.text;
      
      // Should include first event but not second
      expect(icalData).toContain('Test Event 1');
      expect(icalData).not.toContain('Test Event 2');
    });

    it('should handle empty calendar gracefully', async () => {
      const emptyCalendar = await createTestCalendar(testUser.id, {
        webcal_enabled: true,
        is_public: true
      });

      const response = await request(app)
        .get(`/webcal/${emptyCalendar.id}.ics`)
        .expect(200);

      const icalData = response.text;
      
      // Should have valid iCalendar structure but no events
      expect(icalData).toContain('BEGIN:VCALENDAR');
      expect(icalData).toContain('END:VCALENDAR');
      expect(icalData).not.toContain('BEGIN:VEVENT');
    });

    it('should escape special characters in iCalendar fields', async () => {
      await createTestEvent(testUser.id, {
        title: 'Event with, commas; semicolons & special chars',
        description: 'Line 1\nLine 2\nWith\\backslashes',
        location: 'Room "A" & Room \'B\''
      });

      await testDb.query(`
        INSERT INTO calendar_objects (calendar_id, event_id, object_type, ical_data)
        SELECT $1, e.id, 'VEVENT', 
               'BEGIN:VEVENT' || chr(13) || chr(10) ||
               'UID:' || e.id || '@vibecal.local' || chr(13) || chr(10) ||
               'DTSTART:' || to_char(e.start_time AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS"Z"') || chr(13) || chr(10) ||
               'DTEND:' || to_char(e.end_time AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS"Z"') || chr(13) || chr(10) ||
               'SUMMARY:' || replace(replace(replace(e.title, '\', '\\'), ';', '\;'), ',', '\,') || chr(13) || chr(10) ||
               'DESCRIPTION:' || replace(replace(replace(COALESCE(e.description, ''), '\', '\\'), ';', '\;'), chr(10), '\n') || chr(13) || chr(10) ||
               'LOCATION:' || replace(replace(replace(COALESCE(e.location, ''), '\', '\\'), ';', '\;'), ',', '\,') || chr(13) || chr(10) ||
               'END:VEVENT'
        FROM events e
        WHERE e.creator_id = $2
        AND e.title LIKE '%special chars%'
      `, [testCalendar.id, testUser.id]);

      const response = await request(app)
        .get(`/webcal/${testCalendar.id}.ics`)
        .expect(200);

      const icalData = response.text;
      
      // Check that special characters are properly escaped
      expect(icalData).toContain('\\,');
      expect(icalData).toContain('\\;');
      expect(icalData).toContain('\\n');
    });

    it('should set proper cache headers for webcal feeds', async () => {
      const response = await request(app)
        .get(`/webcal/${testCalendar.id}.ics`)
        .expect(200);

      expect(response.headers).toHaveProperty('cache-control');
      expect(response.headers['cache-control']).toContain('public');
      expect(response.headers['cache-control']).toContain('max-age');
    });
  });

  describe('WebCal subscription handling', () => {
    it('should handle webcal:// protocol redirects', async () => {
      // This would typically be handled by the client calendar application
      // We test that our endpoint works with webcal URLs by checking
      // that the same calendar ID works for both http and webcal protocols
      
      const response = await request(app)
        .get(`/webcal/${testCalendar.id}.ics`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/calendar/);
    });

    it('should include calendar metadata in feed', async () => {
      const response = await request(app)
        .get(`/webcal/${testCalendar.id}.ics`)
        .expect(200);

      const icalData = response.text;
      
      // Check for calendar name and description if available
      expect(icalData).toContain('X-WR-CALNAME:' + testCalendar.display_name);
      if (testCalendar.description) {
        expect(icalData).toContain('X-WR-CALDESC:' + testCalendar.description);
      }
    });
  });
});