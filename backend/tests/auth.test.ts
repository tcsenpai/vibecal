import request from 'supertest'
import express from 'express'
import authRoutes from '../src/routes/auth'
import { testDb, createTestUser } from './setup'

const app = express()
app.use(express.json())
app.use('/api/auth', authRoutes)

describe('Authentication Endpoints', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User'
      }

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201)

      expect(response.body).toHaveProperty('user')
      expect(response.body).toHaveProperty('token')
      expect(response.body.user.email).toBe(userData.email)
      expect(response.body.user.username).toBe(userData.username)
      expect(response.body.user).not.toHaveProperty('password')
    })

    it('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        username: 'testuser',
        password: 'Password123!'
      }

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })

    it('should reject registration with weak password', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'weak'
      }

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })

    it('should reject registration with duplicate email', async () => {
      await createTestUser({ email: 'duplicate@example.com' })

      const userData = {
        email: 'duplicate@example.com',
        username: 'differentuser',
        password: 'Password123!'
      }

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409)

      expect(response.body).toHaveProperty('error')
    })
  })

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      await createTestUser({
        email: 'login@example.com',
        username: 'loginuser',
        password_hash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewohyUKOZCy5.JZy' // 'password123'
      })
    })

    it('should login with valid credentials', async () => {
      const loginData = {
        email: 'login@example.com',
        password: 'password123'
      }

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200)

      expect(response.body).toHaveProperty('user')
      expect(response.body).toHaveProperty('token')
      expect(response.body.user.email).toBe(loginData.email)
    })

    it('should reject login with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'password123'
      }

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401)

      expect(response.body).toHaveProperty('error')
    })

    it('should reject login with invalid password', async () => {
      const loginData = {
        email: 'login@example.com',
        password: 'wrongpassword'
      }

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401)

      expect(response.body).toHaveProperty('error')
    })
  })

  describe('GET /api/auth/profile', () => {
    let authToken: string
    let testUser: any

    beforeEach(async () => {
      testUser = await createTestUser({
        email: 'profile@example.com',
        username: 'profileuser'
      })

      // Login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'profile@example.com',
          password: 'password123'
        })

      authToken = loginResponse.body.token
    })

    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('user')
      expect(response.body.user.id).toBe(testUser.id)
      expect(response.body.user.email).toBe(testUser.email)
    })

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401)

      expect(response.body).toHaveProperty('error')
    })

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)

      expect(response.body).toHaveProperty('error')
    })
  })
})