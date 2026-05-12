/**
 * admin.routes.ts — Admin authentication and management API routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { comparePassword, generateAdminToken } from '../utils/jwt';
import { findAdminByEmail, findAdminById, updateLastLogin, getAllAdmins, updateAdminStatus, getAdminStats, createInvitation, findInvitationByToken, acceptInvitation, getAllInvitations, cancelInvitation } from '../services/adminService';
import { requireAuth, requireSuperAdmin, requireAdmin } from '../middleware/authMiddleware';

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

export { router as adminRouter };
