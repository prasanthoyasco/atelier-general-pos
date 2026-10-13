// utils/token.js
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is missing in production');
    }
    console.warn('WARNING: JWT_SECRET is not set in environment.');
  }
  return secret || 'dev-fallback-local-only-secret-key-change-in-prod';
};

const getRefreshSecret = () => {
  const secret = process.env.REFRESH_SECRET || process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: REFRESH_SECRET environment variable is missing in production');
    }
    console.warn('WARNING: REFRESH_SECRET is not set in environment.');
  }
  return secret || 'dev-fallback-local-refresh-secret-change-in-prod';
};

const EXPIRES_IN = '2h';
const REFRESH_EXPIRES_IN = '7d';

/**
 * Generate a JWT token with user payload
 * @param {object} payload - user data to encode in token
 * @returns {string} token
 */
export const generateToken = (payload) => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: EXPIRES_IN, algorithm: 'HS256' });
};

export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, getRefreshSecret(), { expiresIn: REFRESH_EXPIRES_IN, algorithm: 'HS256' });
};

export const decodeToken = (token) => {
  try {
    return jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
  } catch (err) {
    throw new Error("Invalid or expired token");
  }
};

export const decodeRefreshToken = (token) => {
  try {
    return jwt.verify(token, getRefreshSecret(), { algorithms: ['HS256'] });
  } catch (err) {
    throw new Error("Invalid or expired refresh token");
  }
};