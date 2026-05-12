/**
 * jwt.ts — JWT utilities for admin authentication
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config';

// Types
export interface AdminTokenPayload {
  adminId: string;
  email: string;
  role: 'SUPER_ADMIN' | 'MANAGER';
  iat?: number;
  exp?: number;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Compare a plain password with a hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for an admin
 */
export function generateAdminToken(adminId: string, email: string, role: 'SUPER_ADMIN' | 'MANAGER'): string {
  if (!config.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }

  const payload: AdminTokenPayload = {
    adminId,
    email,
    role,
  };

  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyAdminToken(token: string): AdminTokenPayload {
  if (!config.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }

  try {
    return jwt.verify(token, config.JWT_SECRET) as AdminTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Decode a JWT token without verification (for debugging)
 */
export function decodeAdminToken(token: string): AdminTokenPayload | null {
  try {
    return jwt.decode(token) as AdminTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Generate a secure random token (for invitations)
 */
export function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Calculate token expiration date
 */
export function calculateExpiryDate(hours: number): Date {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
}
