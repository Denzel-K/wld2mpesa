"use strict";
/**
 * authMiddleware.ts — Authentication middleware for admin routes
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireSuperAdmin = requireSuperAdmin;
exports.requireAdmin = requireAdmin;
exports.optionalAuth = optionalAuth;
const jwt_1 = require("../utils/jwt");
/**
 * Extract token from Authorization header
 */
function extractToken(req) {
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
function requireAuth(req, res, next) {
    try {
        const token = extractToken(req);
        if (!token) {
            res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
            return;
        }
        const payload = (0, jwt_1.verifyAdminToken)(token);
        req.admin = payload;
        next();
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Authentication failed';
        res.status(401).json({ error: message, code: 'INVALID_TOKEN' });
    }
}
/**
 * Middleware to require SUPER_ADMIN role
 */
function requireSuperAdmin(req, res, next) {
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
function requireAdmin(req, res, next) {
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
function optionalAuth(req, _res, next) {
    try {
        const token = extractToken(req);
        if (token) {
            const payload = (0, jwt_1.verifyAdminToken)(token);
            req.admin = payload;
        }
        next();
    }
    catch {
        // Invalid token - just continue without setting req.admin
        next();
    }
}
//# sourceMappingURL=authMiddleware.js.map