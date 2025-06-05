import { Pool } from 'pg';
import { app } from '../server';
import fs from 'fs';
import path from 'path';

// Test database configuration
const testDb = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.TEST_DB_NAME || 'vibecal_test',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

export { testDb };

// Setup and teardown functions
export const setupTestDatabase = async () => {
  try {
    // Create test database if it doesn't exist
    const adminDb = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });

    await adminDb.query(`DROP DATABASE IF EXISTS ${process.env.TEST_DB_NAME || 'vibecal_test'}`);
    await adminDb.query(`CREATE DATABASE ${process.env.TEST_DB_NAME || 'vibecal_test'}`);
    await adminDb.end();

    // Run schema setup
    const schemaPath = path.join(__dirname, '../models/database.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await testDb.query(schema);

    // Run performance indexes
    const indexesPath = path.join(__dirname, '../migrations/001_performance_indexes.sql');
    const indexes = fs.readFileSync(indexesPath, 'utf8');
    await testDb.query(indexes);

    console.log('Test database setup completed');
  } catch (error) {
    console.error('Test database setup failed:', error);
    throw error;
  }
};

export const cleanupTestDatabase = async () => {
  try {
    // Clean all tables
    await testDb.query(`
      TRUNCATE TABLE 
        sync_changes,
        webdav_locks,
        webdav_properties,
        calendar_subscriptions,
        calendar_objects,
        calendars,
        guest_tokens,
        voting_event_settings,
        voting_responses,
        voting_time_slots,
        event_participants,
        events,
        calendar_permissions,
        users
      RESTART IDENTITY CASCADE
    `);
  } catch (error) {
    console.error('Test database cleanup failed:', error);
    throw error;
  }
};

export const teardownTestDatabase = async () => {
  try {
    await testDb.end();
  } catch (error) {
    console.error('Test database teardown failed:', error);
  }
};

// Test data factories
export const createTestUser = async (overrides: any = {}) => {
  const userData = {
    email: 'test@example.com',
    username: 'testuser',
    password_hash: '$2b$10$testhashedpassword',
    first_name: 'Test',
    last_name: 'User',
    is_verified: true,
    is_active: true,
    ...overrides
  };

  const result = await testDb.query(`
    INSERT INTO users (email, username, password_hash, first_name, last_name, is_verified, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [
    userData.email,
    userData.username,
    userData.password_hash,
    userData.first_name,
    userData.last_name,
    userData.is_verified,
    userData.is_active
  ]);

  return result.rows[0];
};

export const createTestEvent = async (userId: number, overrides: any = {}) => {
  const eventData = {
    title: 'Test Event',
    description: 'A test event',
    creator_id: userId,
    start_time: new Date('2024-06-01T10:00:00Z'),
    end_time: new Date('2024-06-01T11:00:00Z'),
    location: 'Test Location',
    is_all_day: false,
    is_recurring: false,
    event_type: 'regular',
    is_public: false,
    ...overrides
  };

  const result = await testDb.query(`
    INSERT INTO events (title, description, creator_id, start_time, end_time, location, 
                       is_all_day, is_recurring, event_type, is_public)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `, [
    eventData.title,
    eventData.description,
    eventData.creator_id,
    eventData.start_time,
    eventData.end_time,
    eventData.location,
    eventData.is_all_day,
    eventData.is_recurring,
    eventData.event_type,
    eventData.is_public
  ]);

  return result.rows[0];
};

export const createTestCalendar = async (userId: number, overrides: any = {}) => {
  const calendarData = {
    user_id: userId,
    name: 'test-calendar',
    display_name: 'Test Calendar',
    description: 'A test calendar',
    color: '#3B82F6',
    timezone: 'UTC',
    is_default: false,
    is_public: false,
    webdav_enabled: true,
    webcal_enabled: true,
    ...overrides
  };

  const result = await testDb.query(`
    INSERT INTO calendars (user_id, name, display_name, description, color, timezone, 
                          is_default, is_public, webdav_enabled, webcal_enabled)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `, [
    calendarData.user_id,
    calendarData.name,
    calendarData.display_name,
    calendarData.description,
    calendarData.color,
    calendarData.timezone,
    calendarData.is_default,
    calendarData.is_public,
    calendarData.webdav_enabled,
    calendarData.webcal_enabled
  ]);

  return result.rows[0];
};

// Auth helpers
export const generateTestToken = (user: any) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      username: user.username
    },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};