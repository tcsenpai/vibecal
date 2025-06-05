import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../utils/database';
import { hashPassword, comparePassword, generateToken } from '../utils/auth';
import { User } from '../types';
import { AuthRequest } from '../middleware/auth';
import { AppError, asyncHandler } from '../utils/errorHandler';
import { logger } from '../utils/logger';

export const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('username').isLength({ min: 3, max: 30 }).isAlphanumeric(),
  body('password').isLength({ min: 6 }),
  body('firstName').optional().isLength({ max: 100 }),
  body('lastName').optional().isLength({ max: 100 }),
];

export const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

export const register = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 400, true, 'VALIDATION_ERROR');
  }

  const { email, username, password, firstName, lastName } = req.body;

  logger.info('User registration attempt', { email, username });

  // Check if user already exists
  const existingUser = await pool.query(
    'SELECT id FROM users WHERE email = $1 OR username = $2',
    [email, username]
  );

  if (existingUser.rows.length > 0) {
    throw new AppError('User already exists', 400, true, 'USER_EXISTS');
  }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      `INSERT INTO users (email, username, password_hash, first_name, last_name) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id, email, username, first_name, last_name, is_verified, created_at`,
      [email, username, passwordHash, firstName, lastName]
    );

    const user = result.rows[0];
    const token = generateToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    });

  logger.info('User registered successfully', { userId: user.id, email: user.email });

  res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      isVerified: user.is_verified,
      createdAt: user.created_at,
    },
    token,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Validation failed', 400, true, 'VALIDATION_ERROR');
  }

  const { email, password } = req.body;

  logger.info('Login attempt', { email });

  // Find user
  const result = await pool.query(
    'SELECT id, email, username, password_hash, first_name, last_name, is_verified, is_active FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    logger.warn('Login failed - user not found', { email });
    throw new AppError('Invalid credentials', 401, true, 'INVALID_CREDENTIALS');
  }

  const user = result.rows[0];

  if (!user.is_active) {
    logger.warn('Login failed - account deactivated', { email, userId: user.id });
    throw new AppError('Account is deactivated', 401, true, 'ACCOUNT_DEACTIVATED');
  }

  // Verify password
  const isValidPassword = await comparePassword(password, user.password_hash);
  if (!isValidPassword) {
    logger.warn('Login failed - invalid password', { email, userId: user.id });
    throw new AppError('Invalid credentials', 401, true, 'INVALID_CREDENTIALS');
  }

  const token = generateToken({
    userId: user.id,
    email: user.email,
    username: user.username,
  });

  logger.info('Login successful', { userId: user.id, email });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      isVerified: user.is_verified,
    },
    token,
  });
});

export const getProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401, true, 'AUTH_REQUIRED');
  }

  const userId = req.user.userId;

  const result = await pool.query(
    'SELECT id, email, username, first_name, last_name, is_verified, created_at FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('User not found', 404, true, 'USER_NOT_FOUND');
  }

  const user = result.rows[0];
  res.json({
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    isVerified: user.is_verified,
    createdAt: user.created_at,
  });
});