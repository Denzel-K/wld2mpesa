/**
 * admin.routes.ts — Admin authentication and management API routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { comparePassword, generateAdminToken } from '../utils/jwt';
import { findAdminByEmail, findAdminById, updateLastLogin, getAllAdmins, updateAdminStatus, getAdminStats, createInvitation, findInvitationByToken, acceptInvitation, getAllInvitations, cancelInvitation } from '../services/adminService';
import { transactionStore } from '../services/transactionStore';
import { userStore } from '../services/userStore';
import { prisma } from '../db/prisma';
import { requireAuth, requireSuperAdmin, requireAdmin } from '../middleware/authMiddleware';
import { logger, maskWalletAddress } from '../utils/logger';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const createInvitationSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  role: z.literal('MANAGER'), // Only MANAGER can be invited
});

const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * POST /api/admin/login
 * Admin login endpoint
 */
router.post('/login', async (req: Request, res: Response) => {
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
    const admin = await findAdminByEmail(email);
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
    const isValid = await comparePassword(password, admin.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
      return;
    }

    // Update last login
    const ipAddress = req.ip || req.socket.remoteAddress || '';
    await updateLastLogin(admin.id, ipAddress);

    // Generate token
    const token = generateAdminToken(admin.id, admin.email, admin.role as 'SUPER_ADMIN' | 'MANAGER');

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
  } catch (error) {
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
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const admin = await findAdminById(req.admin!.adminId);

    if (!admin) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }

    const { passwordHash, ...adminWithoutPassword } = admin;

    res.json({
      success: true,
      data: adminWithoutPassword,
    });
  } catch (error) {
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
router.get('/list', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const admins = await getAllAdmins();

    res.json({
      success: true,
      data: admins,
    });
  } catch (error) {
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
router.patch('/:id/status', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['ACTIVE', 'SUSPENDED', 'INACTIVE'].includes(status)) {
      res.status(400).json({ error: 'Valid status is required' });
      return;
    }

    // Prevent self-suspension
    if (id === req.admin!.adminId && status !== 'ACTIVE') {
      res.status(403).json({ error: 'Cannot change your own status' });
      return;
    }

    const admin = await updateAdminStatus(id, status);

    res.json({
      success: true,
      message: 'Status updated successfully',
      data: admin,
    });
  } catch (error) {
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
router.get('/stats', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const stats = await getAdminStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
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
router.post('/invitations', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
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
    const invitedById = req.admin!.adminId;

    const invitation = await createInvitation({
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
  } catch (error) {
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
router.get('/invitations', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const invitations = await getAllInvitations();

    res.json({
      success: true,
      data: invitations,
    });
  } catch (error) {
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
router.delete('/invitations/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await cancelInvitation(id);

    res.json({
      success: true,
      message: 'Invitation cancelled',
    });
  } catch (error) {
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
router.get('/invitations/verify/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const invitation = await findInvitationByToken(token);

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
  } catch (error) {
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
router.post('/invitations/accept', async (req: Request, res: Response) => {
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
    const admin = await acceptInvitation({ token, password });

    // Generate token for immediate login
    const authToken = generateAdminToken(admin.id, admin.email, admin.role as 'SUPER_ADMIN' | 'MANAGER');

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        admin,
        token: authToken,
      },
    });
  } catch (error) {
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
router.get('/transactions', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { 
      status, 
      search, 
      page = '1', 
      limit = '20',
      startDate,
      endDate 
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};
    
    if (status && status !== 'all') {
      where.status = status;
    }
    
    if (search) {
      where.OR = [
        { id: { contains: search as string } },
        { walletAddress: { contains: search as string } },
        { phoneNumber: { contains: search as string } },
        { tillNumber: { contains: search as string } },
        { mpesaReceiptNumber: { contains: search as string } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
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
      prisma.transaction.count({ where })
    ]);

    // Calculate stats
    const stats = await prisma.transaction.aggregate({
      where: status && status !== 'all' ? { status: status as string } : {},
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
  } catch (error) {
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
router.get('/transactions/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const transaction = await prisma.transaction.findUnique({
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
  } catch (error) {
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
router.post('/transactions/:id/retry', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const transaction = await prisma.transaction.findUnique({
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

    logger.info('ADMIN', 'Transaction retry requested by admin', id, {
      admin: req.admin?.adminId,
      currentStatus: transaction.status,
    });

    // Import payment service dynamically to avoid circular deps
    const { paymentService } = await import('../services/paymentService');
    void paymentService.processPaymentPipeline(id);

    res.json({
      success: true,
      message: 'Transaction retry initiated',
      transactionId: id,
    });
  } catch (error) {
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
router.post('/transactions/:id/refund', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const transaction = await prisma.transaction.findUnique({
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

    logger.info('ADMIN', 'Refund initiated by admin', id, {
      admin: req.admin?.adminId,
      reason,
    });

    const { paymentService } = await import('../services/paymentService');
    await paymentService.initiateRefund(id, transaction.walletAddress);

    res.json({
      success: true,
      message: 'Refund initiated. WLD will be returned to the user wallet within 1–5 minutes.',
      transactionId: id,
      refundStatus: 'REFUND_INITIATED',
    });
  } catch (error) {
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
router.get('/users', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { 
      search, 
      page = '1', 
      limit = '20',
      isVerified,
      profileComplete,
      onboarded 
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { walletAddress: { contains: search as string } },
        { wldUsername: { contains: search as string } },
        { fullName: { contains: search as string } },
        { email: { contains: search as string } },
        { phone: { contains: search as string } },
        { nullifierHash: { contains: search as string } },
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
      prisma.user.findMany({
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
      prisma.user.count({ where })
    ]);

    // Calculate stats
    const stats = await prisma.user.aggregate({
      _count: { id: true },
      where: { isVerified: true }
    });

    const totalUsers = await prisma.user.count();

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
  } catch (error) {
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
router.get('/users/:walletAddress', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;

    const user = await prisma.user.findUnique({
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
    const txStats = await prisma.transaction.aggregate({
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
  } catch (error) {
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
router.patch('/users/:walletAddress/status', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;
    const { isVerified, verificationLevel } = req.body;

    const user = await prisma.user.findUnique({
      where: { walletAddress }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updateData: any = {};
    if (isVerified !== undefined) updateData.isVerified = isVerified;
    if (verificationLevel) updateData.verificationLevel = verificationLevel;

    const updated = await prisma.user.update({
      where: { walletAddress },
      data: updateData,
    });

    logger.info('ADMIN', 'User status updated by admin', undefined, {
      admin: req.admin?.adminId,
      wallet: maskWalletAddress(walletAddress),
      changes: updateData,
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
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
router.get('/dashboard/stats', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      verifiedUsers,
      totalTransactions,
      completedTransactions,
      failedTransactions,
      pendingTransactions,
      totalVolume,
      todayTransactions,
      todayVolume,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isVerified: true } }),
      prisma.transaction.count(),
      prisma.transaction.count({ where: { status: 'COMPLETED' } }),
      prisma.transaction.count({ where: { status: 'FAILED' } }),
      prisma.transaction.count({ where: { status: { in: ['INITIATED', 'PENDING_CONFIRMATION', 'CONFIRMED', 'SWAP_COMPLETED', 'OFFRAMP_INITIATED', 'MPESA_SENT'] } } }),
      prisma.transaction.aggregate({ _sum: { kesAmount: true }, where: { status: 'COMPLETED' } }),
      prisma.transaction.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
      prisma.transaction.aggregate({ 
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
  } catch (error) {
    console.error('[AdminRoute] Error fetching dashboard stats:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as adminRouter };
