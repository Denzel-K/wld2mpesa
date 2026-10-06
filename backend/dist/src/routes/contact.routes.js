"use strict";
/**
 * contact.routes.ts — Contact form and conversation API routes
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const contactService_1 = require("../services/contactService");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
exports.contactRouter = router;
// Validation schema for contact form submission
const contactFormSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    email: zod_1.z.string().email('Invalid email address'),
    company: zod_1.z.string().optional(),
    inquiryType: zod_1.z.enum(['demo', 'support', 'partnership', 'other']),
    message: zod_1.z.string().min(10, 'Message must be at least 10 characters'),
});
// Validation schema for admin response
const adminResponseSchema = zod_1.z.object({
    content: zod_1.z.string().min(1, 'Response content is required'),
});
/**
 * POST /api/contact/submit
 * Submit a new contact form message
 */
router.post('/submit', async (req, res) => {
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
        const result = await (0, contactService_1.createContactMessage)({
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
    }
    catch (error) {
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
router.get('/conversations', authMiddleware_1.requireAuth, authMiddleware_1.requireAdmin, async (req, res) => {
    try {
        const { status, assignedTo, search, page, limit } = req.query;
        const result = await (0, contactService_1.getConversations)({
            status: status,
            assignedTo: assignedTo,
            search: search,
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 20,
        });
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
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
router.get('/conversations/:id', authMiddleware_1.requireAuth, authMiddleware_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const conversation = await (0, contactService_1.getConversationById)(id);
        if (!conversation) {
            res.status(404).json({ error: 'Conversation not found' });
            return;
        }
        // Mark original message as read
        if (conversation.originalMessage) {
            await (0, contactService_1.markMessageAsRead)(conversation.originalMessage.id);
        }
        res.json({
            success: true,
            data: conversation,
        });
    }
    catch (error) {
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
router.post('/conversations/:id/respond', authMiddleware_1.requireAuth, authMiddleware_1.requireAdmin, async (req, res) => {
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
        const adminId = req.admin.adminId;
        const result = await (0, contactService_1.createAdminResponse)({
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
    }
    catch (error) {
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
router.patch('/conversations/:id/assign', authMiddleware_1.requireAuth, authMiddleware_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { adminId } = req.body;
        if (!adminId) {
            res.status(400).json({ error: 'adminId is required' });
            return;
        }
        const conversation = await (0, contactService_1.assignConversation)(id, adminId);
        res.json({
            success: true,
            message: 'Conversation assigned successfully',
            data: conversation,
        });
    }
    catch (error) {
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
router.patch('/conversations/:id/status', authMiddleware_1.requireAuth, authMiddleware_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status || !['ACTIVE', 'CLOSED', 'ARCHIVED'].includes(status)) {
            res.status(400).json({ error: 'Valid status (ACTIVE, CLOSED, ARCHIVED) is required' });
            return;
        }
        const conversation = await (0, contactService_1.updateConversationStatus)(id, status);
        res.json({
            success: true,
            message: 'Status updated successfully',
            data: conversation,
        });
    }
    catch (error) {
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
router.get('/stats', authMiddleware_1.requireAuth, authMiddleware_1.requireAdmin, async (_req, res) => {
    try {
        const stats = await (0, contactService_1.getContactStats)();
        res.json({
            success: true,
            data: stats,
        });
    }
    catch (error) {
        console.error('[ContactRoute] Error fetching stats:', error);
        res.status(500).json({
            error: 'Failed to fetch statistics',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
//# sourceMappingURL=contact.routes.js.map