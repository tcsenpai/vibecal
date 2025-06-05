import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AuthTokenPayload } from '../types';

// Validate JWT secret at startup
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters long for security');
}
if (JWT_SECRET === 'your-secret-key-change-this' || JWT_SECRET === 'change-this-super-secret-jwt-key-in-production') {
  throw new Error('JWT_SECRET cannot use default values. Generate a secure secret.');
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateToken = (payload: AuthTokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
};

export const verifyToken = (token: string): AuthTokenPayload => {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
};

export const generateGuestToken = (): string => {
  // Use cryptographically secure random bytes instead of Math.random()
  return crypto.randomBytes(32).toString('hex');
};