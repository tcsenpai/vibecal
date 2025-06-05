import { Pool } from 'pg'
import dotenv from 'dotenv'

// Load test environment variables
dotenv.config({ path: '.env.test' })

// Set test environment
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long-for-security'

// Mock logger to reduce noise in tests
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  },
  requestLogger: jest.fn((req: any, res: any, next: any) => next()),
  logDatabaseQuery: jest.fn(),
  logSecurityEvent: jest.fn(),
  logPerformance: jest.fn()
}))

// Global test database connection
let testDb: Pool

beforeAll(async () => {
  // Create test database connection
  testDb = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'vibecal_test',
    password: process.env.DB_PASSWORD || 'password',
    port: parseInt(process.env.DB_PORT || '5432'),
  })

  // Clean database before tests
  await cleanDatabase()
})

afterAll(async () => {
  // Clean up after all tests
  await cleanDatabase()
  await testDb.end()
})

// Clean database function
async function cleanDatabase() {
  try {
    // Delete in correct order to avoid foreign key constraints
    await testDb.query('DELETE FROM voting_responses')
    await testDb.query('DELETE FROM voting_time_slots')
    await testDb.query('DELETE FROM voting_event_settings')
    await testDb.query('DELETE FROM event_participants')
    await testDb.query('DELETE FROM guest_tokens')
    await testDb.query('DELETE FROM events')
    await testDb.query('DELETE FROM calendar_permissions')
    await testDb.query('DELETE FROM users')
    
    // Reset sequences
    await testDb.query('ALTER SEQUENCE users_id_seq RESTART WITH 1')
    await testDb.query('ALTER SEQUENCE events_id_seq RESTART WITH 1')
    await testDb.query('ALTER SEQUENCE voting_time_slots_id_seq RESTART WITH 1')
    await testDb.query('ALTER SEQUENCE voting_responses_id_seq RESTART WITH 1')
  } catch (error) {
    console.error('Error cleaning database:', error)
  }
}

// Make test database available globally
declare global {
  var testDb: Pool
}

global.testDb = testDb

// Test utilities
export const createTestUser = async (overrides: any = {}) => {
  const userData = {
    email: 'test@example.com',
    username: 'testuser',
    password_hash: '$2b$12$hash', // Mock hash
    first_name: 'Test',
    last_name: 'User',
    is_verified: true,
    ...overrides
  }

  const result = await testDb.query(
    `INSERT INTO users (email, username, password_hash, first_name, last_name, is_verified)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [userData.email, userData.username, userData.password_hash, 
     userData.first_name, userData.last_name, userData.is_verified]
  )

  return result.rows[0]
}

export const createTestEvent = async (userId: number, overrides: any = {}) => {
  const eventData = {
    title: 'Test Event',
    description: 'Test Description',
    creator_id: userId,
    start_time: new Date(),
    end_time: new Date(Date.now() + 60 * 60 * 1000), // 1 hour later
    location: 'Test Location',
    event_type: 'regular',
    is_public: false,
    ...overrides
  }

  const result = await testDb.query(
    `INSERT INTO events (title, description, creator_id, start_time, end_time, location, event_type, is_public)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [eventData.title, eventData.description, eventData.creator_id,
     eventData.start_time, eventData.end_time, eventData.location,
     eventData.event_type, eventData.is_public]
  )

  return result.rows[0]
}

export { testDb }