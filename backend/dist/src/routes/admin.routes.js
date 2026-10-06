"use strict";
/**
 * admin.routes.ts — Admin authentication and management API routes
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const jwt_1 = require("../utils/jwt");
const adminService_1 = require("../services/adminService");
const prisma_1 = require("../db/prisma");
const authMiddleware_1 = require("../middleware/authMiddleware");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
exports.adminRouter = router;
// Validation schemas
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
const createInvitationSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2, 'Full name is required'),
    email: zod_1.z.string().email('Invalid email address'),
    phone: zod_1.z.string().optional(),
    role: zod_1.z.literal('MANAGER'), // Only MANAGER can be invited
});
const acceptInvitationSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Invitation token is required'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
});
/**
 * POST /api/admin/login
 * Admin login endpoint
 */
router.post('/login', async (req, res) => {
    try {
        // Validate input
        const validationResult = loginSchema.safeParse(req.body);
        if (!validationResult.success) {
            res.status(400).json({
                error: 'Validation failed',
                details: validationResult.error.errors,
            });
            return;
        }
        const { email, password } = validationResult.data;
        // Find admin
        const admin = await (0, adminService_1.findAdminByEmail)(email);
        if (!admin) {
            res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
            return;
        }
        // Check status
        if (admin.status !== 'ACTIVE') {
            res.status(403).json({
                error: 'Account is not active',
                code: 'ACCOUNT_INACTIVE',
                status: admin.status,
            });
            return;
        }
        // Verify password
        const isValid = await (0, jwt_1.comparePassword)(password, admin.passwordHash);
        if (!isValid) {
            res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
            return;
        }
        // Update last login
        const ipAddress = req.ip || req.socket.remoteAddress || '';
        await (0, adminService_1.updateLastLogin)(admin.id, ipAddress);
        // Generate token
        const token = (0, jwt_1.generateAdminToken)(admin.id, admin.email, admin.role);
        // Return success (without password hash)
        const { passwordHash, ...adminWithoutPassword } = admin;
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                admin: adminWithoutPassword,
                token,
            },
        });
    }
    catch (error) {
        console.error('[AdminRoute] Login error:', error);
        res.status(500).json({
            error: 'Login failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * GET /api/admin/me
 * Get current admin profile
 */
router.get('/me', authMiddleware_1.requireAuth, async (req, res) => {
    try {
        const admin = await (0, adminService_1.findAdminById)(req.admin.adminId);
        if (!admin) {
            res.status(404).json({ error: 'Admin not found' });
            return;
        }
        const { passwordHash, ...adminWithoutPassword } = admin;
        res.json({
            success: true,
            data: adminWithoutPassword,
        });
    }
    catch (error) {
        console.error('[AdminRoute] Error fetching profile:', error);
        res.status(500).json({
            error: 'Failed to fetch profile',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * GET /api/admin/list
 * Get all admins (super admin only)
 */
router.get('/list', authMiddleware_1.requireAuth, authMiddleware_1.requireSuperAdmin, async (_req, res) => {
    try {
        const admins = await (0, adminService_1.getAllAdmins)();
        res.json({
            success: true,
            data: admins,
        });
    }
    catch (error) {
        console.error('[AdminRoute] Error fetching admins:', error);
        res.status(500).json({
            error: 'Failed to fetch admins',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * PATCH /api/admin/:id/status
 * Update admin status (super admin only)
 */
router.patch('/:id/status', authMiddleware_1.requireAuth, authMiddleware_1.requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status || !['ACTIVE', 'SUSPENDED', 'INACTIVE'].includes(status)) {
            res.status(400).json({ error: 'Valid status is required' });
            return;
        }
        // Prevent self-suspension
        if (id === req.admin.adminId && status !== 'ACTIVE') {
            res.status(403).json({ error: 'Cannot change your own status' });
            return;
        }
        const admin = await (0, adminService_1.updateAdminStatus)(id, status);
        res.json({
            success: true,
            message: 'Status updated successfully',
            data: admin,
        });
    }
    catch (error) {
        console.error('[AdminRoute] Error updating status:', error);
        res.status(500).json({
            error: 'Failed to update status',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * GET /api/admin/stats
 * Get admin dashboard statistics
 */
router.get('/stats', authMiddleware_1.requireAuth, authMiddleware_1.requireAdmin, async (_req, res) => {
    try {
        const stats = await (0, adminService_1.getAdminStats)();
        res.json({
            success: true,
            data: stats,
        });
    }
    catch (error) {
        console.error('[AdminRoute] Error fetching stats:', error);
        res.status(500).json({
            error: 'Failed to fetch statistics',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// ─── Invitation Routes ────────────────────────────────────────────────────────
/**
 * POST /api/admin/invitations
 * Create a new invitation (super admin only)
 */
router.post('/invitations', authMiddleware_1.requireAuth, authMiddleware_1.requireSuperAdmin, async (req, res) => {
    try {
        // Validate input
        const validationResult = createInvitationSchema.safeParse(req.body);
        if (!validationResult.success) {
            res.status(400).json({
                error: 'Validation failed',
                details: validationResult.error.errors,
            });
            return;
        }
        const { fullName, email, phone, role } = validationResult.data;
        const invitedById = req.admin.adminId;
        const invitation = await (0, adminService_1.createInvitation)({
            fullName,
            email,
            phone,
            role,
            invitedById,
        });
        res.status(201).json({
            success: true,
            message: 'Invitation created and email sent',
            data: invitation,
        });
    }
    catch (error) {
        console.error('[AdminRoute] Error creating invitation:', error);
        res.status(500).json({
            error: 'Failed to create invitation',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * GET /api/admin/invitations
 * Get all invitations (super admin only)
 */
router.get('/invitations', authMiddleware_1.requireAuth, authMiddleware_1.requireSuperAdmin, async (_req, res) => {
    try {
        const invitations = await (0, adminService_1.getAllInvitations)();
        res.json({
            success: true,
            data: invitations,
        });
    }
    catch (error) {
        console.error('[AdminRoute] Error fetching invitations:', error);
        res.status(500).json({
            error: 'Failed to fetch invitations',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * DELETE /api/admin/invitations/:id
 * Cancel an invitation (super admin only)
 */
router.delete('/invitations/:id', authMiddleware_1.requireAuth, authMiddleware_1.requireSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await (0, adminService_1.cancelInvitation)(id);
        res.json({
            success: true,
            message: 'Invitation cancelled',
        });
    }
    catch (error) {
        console.error('[AdminRoute] Error cancelling invitation:', error);
        res.status(500).json({
            error: 'Failed to cancel invitation',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * GET /api/admin/invitations/verify/:token
 * Verify an invitation token (public endpoint)
 */
router.get('/invitations/verify/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const invitation = await (0, adminService_1.findInvitationByToken)(token);
        if (!invitation) {
            res.status(404).json({ error: 'Invalid invitation token', valid: false });
            return;
        }
        if (invitation.acceptedAt) {
            res.status(400).json({ error: 'Invitation already accepted', valid: false, accepted: true });
            return;
        }
        if (invitation.expiresAt < new Date()) {
            res.status(400).json({ error: 'Invitation expired', valid: false, expired: true });
            return;
        }
        res.json({
            success: true,
            valid: true,
            data: {
                email: invitation.email,
                fullName: invitation.fullName,
                invitedBy: invitation.invitedBy,
                expiresAt: invitation.expiresAt,
            },
        });
    }
    catch (error) {
        console.error('[AdminRoute] Error verifying invitation:', error);
        res.status(500).json({
            error: 'Failed to verify invitation',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * POST /api/admin/invitations/accept
 * Accept an invitation and create admin account (public endpoint)
 */
router.post('/invitations/accept', async (req, res) => {
    try {
        // Validate input
        const validationResult = acceptInvitationSchema.safeParse(req.body);
        if (!validationResult.success) {
            res.status(400).json({
                error: 'Validation failed',
                details: validationResult.error.errors,
            });
            return;
        }
        const { token, password } = req.body;
        // Accept invitation
        const admin = await (0, adminService_1.acceptInvitation)({ token, password });
        // Generate token for immediate login
        const authToken = (0, jwt_1.generateAdminToken)(admin.id, admin.email, admin.role);
        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            data: {
                admin,
                token: authToken,
            },
        });
    }
    catch (error) {
        console.error('[AdminRoute] Error accepting invitation:', error);
        res.status(400).json({
            error: 'Failed to accept invitation',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// ─── Transaction Routes ───────────────────────────────────────────────────────
/**
 * GET /api/admin/transactions
 * Get all transactions with filtering and pagination
 */
router.get('/transactions', authMiddleware_1.requireAuth, authMiddleware_1.requireAdmin, async (req, res) => {
    try {
        const { status, search, page = '1', limit = '20', startDate, endDate } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;
        // Build where clause
        const where = {};
        if (status && status !== 'all') {
            where.status = status;
        }
        if (search) {
            where.OR = [
                { id: { contains: search } },
                { walletAddress: { contains: search } },
                { phoneNumber: { contains: search } },
                { tillNumber: { contains: search } },
                { mpesaReceiptNumber: { contains: search } },
            ];
        }
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const [transactions, total] = await Promise.all([
            prisma_1.prisma.transaction.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
                include: {
                    user: {
                        select: {
                            id: true,
                            walletAddress: true,
                            wldUsername: true,
                            fullName: true,
                            email: true,
                            phone: true,
                        }
                    }
                }
            }),
            prisma_1.prisma.transaction.count({ where })
        ]);
        // Calculate stats
        const stats = await prisma_1.prisma.transaction.aggregate({
            where: status && status !== 'all' ? { status: status } : {},
            _sum: { kesAmount: true },
            _count: { id: true },
        });
        res.json({
            success: true,
            data: {
                transactions,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum),
                },
                stats: {
                    totalVolume: stats._sum.kesAmount || 0,
                    totalCount: stats._count.id,
                }
            }
        });
    }
    catch (error) {
        console.error('[AdminRoute] Error fetching transactions:', error);
        res.status(500).json({
            error: 'Failed to fetch transactions',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * GET /api/admin/transactions/:id
 * Get single transaction details
 */
router.get('/transactions/:id', authMiddleware_1.requireAuth, authMiddleware_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const transaction = await prisma_1.prisma.transaction.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        walletAddress: true,
                        wldUsername: true,
                        fullName: true,
                        email: true,
                        phone: true,
                    }
                },
                webhookEvents: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        if (!transaction) {
            res.status(404).json({ error: 'Transaction not found' });
            return;
        }
        res.json({
            success: true,
            data: transaction,
        });
    }
    catch (error) {
        console.error('[AdminRoute] Error fetching transaction:', error);
        res.status(500).json({
            error: 'Failed to fetch transaction',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * POST /api/admin/transactions/:id/retry
 * Retry a failed/stuck transaction
 */
router.post('/transactions/:id/retry', authMiddleware_1.requireAuth, authMiddleware_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const transaction = await prisma_1.prisma.transaction.findUnique({
            where: { id }
        });
        if (!transaction) {
            res.status(404).json({ error: 'Transaction not found' });
            return;
        }
        const retryEligible = ['PENDING_CONFIRMATION', 'CONFIRMED', 'SWAP_COMPLETED', 'OFFRAMP_INITIATED', 'MPESA_SENT', 'FAILED'];
        if (!retryEligible.includes(transaction.status)) {
            res.status(400).json({
                error: `Transaction in status ${transaction.status} is not eligible for retry.`
            });
            return;
        }
        logger_1.logger.info('ADMIN', 'Transaction retry requested by admin', id, {
            admin: req.admin?.adminId,
            currentStatus: transaction.status,
        });
        // Import payment service dynamically to avoid circular deps
        const { paymentService } = await Promise.resolve().then(() => __importStar(require('../services/paymentService')));
        void paymentService.processPaymentPipeline(id);
        res.json({
            success: true,
            message: 'Transaction retry initiated',
            transactionId: id,
        });
    }
    catch (error) {
        console.error('[AdminRoute] Error retrying transaction:', error);
        res.status(500).json({
            error: 'Failed to retry transaction',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * POST /api/admin/transactions/:id/refund
 * Initiate refund for a transaction
 */
router.post('/transactions/:id/refund', authMiddleware_1.requireAuth, authMiddleware_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const transaction = await prisma_1.prisma.transaction.findUnique({
            where: { id }
        });
        if (!transaction) {
            res.status(404).json({ error: 'Transaction not found' });
            return;
        }
        const refundEligibleStatuses = ['FAILED', 'PENDING_CONFIRMATION', 'CONFIRMED', 'SWAP_COMPLETED', 'OFFRAMP_INITIATED'];
        if (!refundEligibleStatuses.includes(transaction.status)) {
            res.status(400).json({
                error: `Transaction in status ${transaction.status} is not eligible for refund`
            });
            return;
        }
        if (transaction.refundStatus === 'REFUNDED') {
            res.status(400).json({ error: 'Refund already processed for this transaction' });
            return;
        }
        logger_1.logger.info('ADMIN', 'Refund initiated by admin', id, {
            admin: req.admin?.adminId,
            reason,
        });
        const { paymentService } = await Promise.resolve().then(() => __importStar(require('../services/paymentService')));
        await paymentService.initiateRefund(id, transaction.walletAddress);
        res.json({
            success: true,
            message: 'Refund initiated. WLD will be returned to the user wallet within 1–5 minutes.',
            transactionId: id,
            refundStatus: 'REFUND_INITIATED',
        });
    }
    catch (error) {
        console.error('[AdminRoute] Error initiating refund:', error);
        res.status(500).json({
            error: 'Failed to initiate refund',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// ─── User Routes ──────────────────────────────────────────────────────────────
/**
 * GET /api/admin/users
 * Get all users with filtering and pagination
 */
router.get('/users', authMiddleware_1.requireAuth, authMiddleware_1.requireAdmin, async (req, res) => {
    try {
        const { search, page = '1', limit = '20', isVerified, profileComplete, onboarded } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;
        // Build where clause
        const where = {};
        if (search) {
            where.OR = [
                { walletAddress: { contains: search } },
                { wldUsername: { contains: search } },
                { fullName: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } },
                { nullifierHash: { contains: search } },
            ];
        }
        if (isVerified !== undefined) {
            where.isVerified = isVerified === 'true';
        }
        if (profileComplete !== undefined) {
            where.profileComplete = profileComplete === 'true';
        }
        if (onboarded !== undefined) {
            where.onboarded = onboarded === 'true';
        }
        const [users, total] = await Promise.all([
            prisma_1.prisma.user.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
                select: {
                    id: true,
                    walletAddress: true,
                    wldUsername: true,
                    fullName: true,
                    email: true,
                    phone: true,
                    isVerified: true,
                    verificationLevel: true,
                    profileComplete: true,
                    onboarded: true,
                    createdAt: true,
                    lastSeenAt: true,
                    nullifierHash: true,
                    _count: {
                        select: {
                            transactions: true,
                        }
                    }
                }
            }),
            prisma_1.prisma.user.count({ where })
        ]);
        // Calculate stats
        const stats = await prisma_1.prisma.user.aggregate({
            _count: { id: true },
            where: { isVerified: true }
        });
        const totalUsers = await prisma_1.prisma.user.count();
        res.json({
            success: true,
            data: {
                users,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum),
                },
                stats: {
                    totalUsers,
                    verifiedUsers: stats._count.id,
                }
            }
        });
    }
    catch (error) {
        console.error('[AdminRoute] Error fetching users:', error);
        res.status(500).json({
            error: 'Failed to fetch users',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * GET /api/admin/users/:walletAddress
 * Get single user details with transaction history
 */
router.get('/users/:walletAddress', authMiddleware_1.requireAuth, authMiddleware_1.requireAdmin, async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const user = await prisma_1.prisma.user.findUnique({
            where: { walletAddress },
            include: {
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 50,
                }
            }
        });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        // Get transaction stats
        const txStats = await prisma_1.prisma.transaction.aggregate({
            where: { walletAddress },
            _sum: { kesAmount: true },
            _count: { id: true },
        });
        res.json({
            success: true,
            data: {
                ...user,
                stats: {
                    totalTransactions: txStats._count.id,
                    totalVolume: txStats._sum.kesAmount || 0,
                }
            }
        });
    }
    catch (error) {
        console.error('[AdminRoute] Error fetching user:', error);
        res.status(500).json({
            error: 'Failed to fetch user',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * PATCH /api/admin/users/:walletAddress/status
 * Update user verification status (super admin only)
 */
router.patch('/users/:walletAddress/status', authMiddleware_1.requireAuth, authMiddleware_1.requireSuperAdmin, async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const { isVerified, verificationLevel } = req.body;
        const user = await prisma_1.prisma.user.findUnique({
            where: { walletAddress }
        });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const updateData = {};
        if (isVerified !== undefined)
            updateData.isVerified = isVerified;
        if (verificationLevel)
            updateData.verificationLevel = verificationLevel;
        const updated = await prisma_1.prisma.user.update({
            where: { walletAddress },
            data: updateData,
        });
        logger_1.logger.info('ADMIN', 'User status updated by admin', undefined, {
            admin: req.admin?.adminId,
            wallet: (0, logger_1.maskWalletAddress)(walletAddress),
            changes: updateData,
        });
        res.json({
            success: true,
            data: updated,
        });
    }
    catch (error) {
        console.error('[AdminRoute] Error updating user status:', error);
        res.status(500).json({
            error: 'Failed to update user status',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * GET /api/admin/dashboard/stats
 * Get comprehensive dashboard statistics
 */
router.get('/dashboard/stats', authMiddleware_1.requireAuth, authMiddleware_1.requireAdmin, async (_req, res) => {
    try {
        const [totalUsers, verifiedUsers, totalTransactions, completedTransactions, failedTransactions, pendingTransactions, totalVolume, todayTransactions, todayVolume,] = await Promise.all([
            prisma_1.prisma.user.count(),
            prisma_1.prisma.user.count({ where: { isVerified: true } }),
            prisma_1.prisma.transaction.count(),
            prisma_1.prisma.transaction.count({ where: { status: 'COMPLETED' } }),
            prisma_1.prisma.transaction.count({ where: { status: 'FAILED' } }),
            prisma_1.prisma.transaction.count({ where: { status: { in: ['INITIATED', 'PENDING_CONFIRMATION', 'CONFIRMED', 'SWAP_COMPLETED', 'OFFRAMP_INITIATED', 'MPESA_SENT'] } } }),
            prisma_1.prisma.transaction.aggregate({ _sum: { kesAmount: true }, where: { status: 'COMPLETED' } }),
            prisma_1.prisma.transaction.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
            prisma_1.prisma.transaction.aggregate({
                _sum: { kesAmount: true },
                where: {
                    createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                    status: 'COMPLETED'
                }
            }),
        ]);
        res.json({
            success: true,
            data: {
                users: {
                    total: totalUsers,
                    verified: verifiedUsers,
                    unverified: totalUsers - verifiedUsers,
                },
                transactions: {
                    total: totalTransactions,
                    completed: completedTransactions,
                    failed: failedTransactions,
                    pending: pendingTransactions,
                },
                volume: {
                    total: totalVolume._sum.kesAmount || 0,
                    today: todayVolume._sum.kesAmount || 0,
                },
                today: {
                    transactions: todayTransactions,
                }
            }
        });
    }
    catch (error) {
        console.error('[AdminRoute] Error fetching dashboard stats:', error);
        res.status(500).json({
            error: 'Failed to fetch dashboard statistics',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
//# sourceMappingURL=admin.routes.js.map