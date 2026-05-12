/**
 * contact.routes.ts — Contact form and conversation API routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createContactMessage, getConversations, getConversationById, createAdminResponse, assignConversation, updateConversationStatus, markMessageAsRead, getContactStats } from '../services/contactService';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware';
import { sendNewMessageNotification } from '../services/emailService';

const router = Router();

// Validation schema for contact form submission
const contactFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  company: z.string().optional(),
  inquiryType: z.enum(['demo', 'support', 'partnership', 'other']),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

// Validation schema for admin response
const adminResponseSchema = z.object({
  content: z.string().min(1, 'Response content is required'),
});

/**
 * POST /api/contact/submit
 * Submit a new contact form message
 */
router.post('/submit', async (req: Request, res: Response) => {
  try {
    // Validate input
    const validationResult = contactFormSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
      return;
    }

    const { name, email, company, inquiryType, message } = validationResult.data;

    // Get client info for tracking
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;
    const userAgent = req.headers['user-agent'];

    // Create contact message
    const result = await createContactMessage({
      name,
      email,
      company,
      inquiryType,
      message,
      ipAddress,
      userAgent,
    });

    res.status(201).json({
      success: true,
      message: 'Message received successfully',
      data: {
        contactMessageId: result.contactMessage.id,
        conversationId: result.conversation.id,
        emailSent: result.emailSent,
      },
    });
  } catch (error) {
    console.error('[ContactRoute] Error submitting contact form:', error);
    res.status(500).json({
      error: 'Failed to submit message',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/contact/conversations
 * Get all conversations (admin only)
 */
router.get('/conversations', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, assignedTo, search, page, limit } = req.query;

    const result = await getConversations({
      status: status as string | undefined,
      assignedTo: assignedTo as string | undefined,
      search: search as string | undefined,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[ContactRoute] Error fetching conversations:', error);
    res.status(500).json({
      error: 'Failed to fetch conversations',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/contact/conversations/:id
 * Get a single conversation with messages (admin only)
 */
router.get('/conversations/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const conversation = await getConversationById(id);

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Mark original message as read
    if (conversation.originalMessage) {
      await markMessageAsRead(conversation.originalMessage.id);
    }

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error('[ContactRoute] Error fetching conversation:', error);
    res.status(500).json({
      error: 'Failed to fetch conversation',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/contact/conversations/:id/respond
 * Create an admin response to a conversation (admin only)
 */
router.post('/conversations/:id/respond', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate input
    const validationResult = adminResponseSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.errors,
      });
      return;
    }

    const { content } = validationResult.data;
    const adminId = req.admin!.adminId;

    const result = await createAdminResponse({
      conversationId: id,
      adminId,
      content,
    });

    res.status(201).json({
      success: true,
      message: 'Response sent successfully',
      data: {
        message: result.message,
        emailSent: result.emailSent,
      },
    });
  } catch (error) {
    console.error('[ContactRoute] Error creating response:', error);
    res.status(500).json({
      error: 'Failed to send response',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/contact/conversations/:id/assign
 * Assign a conversation to an admin (admin only)
 */
router.patch('/conversations/:id/assign', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;

    if (!adminId) {
      res.status(400).json({ error: 'adminId is required' });
      return;
    }

    const conversation = await assignConversation(id, adminId);

    res.json({
      success: true,
      message: 'Conversation assigned successfully',
      data: conversation,
    });
  } catch (error) {
    console.error('[ContactRoute] Error assigning conversation:', error);
    res.status(500).json({
      error: 'Failed to assign conversation',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/contact/conversations/:id/status
 * Update conversation status (admin only)
 */
router.patch('/conversations/:id/status', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['ACTIVE', 'CLOSED', 'ARCHIVED'].includes(status)) {
      res.status(400).json({ error: 'Valid status (ACTIVE, CLOSED, ARCHIVED) is required' });
      return;
    }

    const conversation = await updateConversationStatus(id, status);

    res.json({
      success: true,
      message: 'Status updated successfully',
      data: conversation,
    });
  } catch (error) {
    console.error('[ContactRoute] Error updating status:', error);
    res.status(500).json({
      error: 'Failed to update status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/contact/stats
 * Get contact form statistics (admin only)
 */
router.get('/stats', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const stats = await getContactStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('[ContactRoute] Error fetching stats:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as contactRouter };
