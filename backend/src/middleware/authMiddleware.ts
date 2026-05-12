/**
 * authMiddleware.ts — Authentication middleware for admin routes
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAdminToken, AdminTokenPayload } from '../utils/jwt';

// Extend Express Request type to include admin
declare global {
  namespace Express {
    interface Request {
      admin?: AdminTokenPayload;
    }
  }
}

/**
 * Extract token from Authorization header
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Also check cookie
  if (req.cookies?.adminToken) {
    return req.cookies.adminToken;
  }
  
  return null;
}

/**
 * Middleware to require authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = extractToken(req);
    
    if (!token) {
      res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
      return;
    }
    
    const payload = verifyAdminToken(token);
    req.admin = payload;
    
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    res.status(401).json({ error: message, code: 'INVALID_TOKEN' });
  }
}

/**
 * Middleware to require SUPER_ADMIN role
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.admin) {
    res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
    return;
  }
  
  if (req.admin.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Super admin access required', code: 'INSUFFICIENT_PERMISSIONS' });
    return;
  }
  
  next();
}

/**
 * Middleware to require either SUPER_ADMIN or MANAGER role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.admin) {
    res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
    return;
  }
  
  if (req.admin.role !== 'SUPER_ADMIN' && req.admin.role !== 'MANAGER') {
    res.status(403).json({ error: 'Admin access required', code: 'INSUFFICIENT_PERMISSIONS' });
    return;
  }
  
  next();
}

/**
 * Optional authentication - sets req.admin if token valid, but doesn't reject
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = extractToken(req);
    
    if (token) {
      const payload = verifyAdminToken(token);
      req.admin = payload;
    }
    
    next();
  } catch {
    // Invalid token - just continue without setting req.admin
    next();
  }
}
