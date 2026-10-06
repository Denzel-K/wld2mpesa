"use strict";
/**
 * jwt.ts — JWT utilities for admin authentication
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.comparePassword = comparePassword;
exports.generateAdminToken = generateAdminToken;
exports.verifyAdminToken = verifyAdminToken;
exports.decodeAdminToken = decodeAdminToken;
exports.generateSecureToken = generateSecureToken;
exports.calculateExpiryDate = calculateExpiryDate;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const config_1 = require("../config");
/**
 * Hash a password using bcrypt
 */
async function hashPassword(password) {
    const saltRounds = 12;
    return bcryptjs_1.default.hash(password, saltRounds);
}
/**
 * Compare a plain password with a hash
 */
async function comparePassword(password, hash) {
    return bcryptjs_1.default.compare(password, hash);
}
/**
 * Generate a JWT token for an admin
 */
function generateAdminToken(adminId, email, role) {
    if (!config_1.config.JWT_SECRET) {
        throw new Error('JWT_SECRET not configured');
    }
    const payload = {
        adminId,
        email,
        role,
    };
    return jsonwebtoken_1.default.sign(payload, config_1.config.JWT_SECRET, {
        expiresIn: config_1.config.JWT_EXPIRES_IN,
    });
}
/**
 * Verify and decode a JWT token
 */
function verifyAdminToken(token) {
    if (!config_1.config.JWT_SECRET) {
        throw new Error('JWT_SECRET not configured');
    }
    try {
        return jsonwebtoken_1.default.verify(token, config_1.config.JWT_SECRET);
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            throw new Error('Token expired');
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            throw new Error('Invalid token');
        }
        throw error;
    }
}
/**
 * Decode a JWT token without verification (for debugging)
 */
function decodeAdminToken(token) {
    try {
        return jsonwebtoken_1.default.decode(token);
    }
    catch {
        return null;
    }
}
/**
 * Generate a secure random token (for invitations)
 */
function generateSecureToken(length = 32) {
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
function calculateExpiryDate(hours) {
    const date = new Date();
    date.setHours(date.getHours() + hours);
    return date;
}
//# sourceMappingURL=jwt.js.map