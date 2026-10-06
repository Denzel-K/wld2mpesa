"use strict";
/**
 * contactService.ts — Contact form and conversation management service
 *
 * Handles:
 * - Saving contact form submissions
 * - Managing conversations
 * - Admin responses
 * - Email notifications
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContactMessage = createContactMessage;
exports.getConversations = getConversations;
exports.getConversationById = getConversationById;
exports.getConversationByEmail = getConversationByEmail;
exports.createAdminResponse = createAdminResponse;
exports.assignConversation = assignConversation;
exports.updateConversationStatus = updateConversationStatus;
exports.markMessageAsRead = markMessageAsRead;
exports.getContactStats = getContactStats;
exports.getContactMessages = getContactMessages;
const prisma_1 = require("../db/prisma");
const emailService_1 = require("./emailService");
/**
 * Create a new contact message and start a conversation
 */
async function createContactMessage(input) {
    // Create the contact message
    const contactMessage = await prisma_1.prisma.contactMessage.create({
        data: {
            name: input.name,
            email: input.email.toLowerCase().trim(),
            company: input.company,
            inquiryType: input.inquiryType,
            message: input.message,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
            status: 'NEW',
        },
    });
    // Create a conversation for this message
    const conversation = await prisma_1.prisma.conversation.create({
        data: {
            contactEmail: input.email.toLowerCase().trim(),
            contactName: input.name,
            contactCompany: input.company,
            status: 'ACTIVE',
            originalMessageId: contactMessage.id,
            lastMessageAt: new Date(),
        },
        include: {
            originalMessage: true,
        },
    });
    // Create initial message in conversation
    await prisma_1.prisma.message.create({
        data: {
            conversationId: conversation.id,
            senderType: 'CONTACT',
            content: input.message,
            isEmailSent: true, // Original contact doesn't need email sent
            emailSentAt: new Date(),
        },
    });
    // Send confirmation email to the user
    const emailResult = await (0, emailService_1.sendContactConfirmation)({
        to: input.email,
        name: input.name,
        inquiryType: input.inquiryType,
        message: input.message,
    });
    // Notify all active super admins about the new message
    const superAdmins = await prisma_1.prisma.admin.findMany({
        where: {
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
        },
    });
    for (const admin of superAdmins) {
        await (0, emailService_1.sendNewMessageNotification)({
            to: admin.email,
            adminName: admin.fullName,
            contactName: input.name,
            contactEmail: input.email,
            inquiryType: input.inquiryType,
            messagePreview: input.message,
        });
    }
    return {
        contactMessage,
        conversation,
        emailSent: emailResult.success,
        emailError: emailResult.error,
    };
}
/**
 * Get all conversations grouped by contact email (unique contacts)
 */
async function getConversations(params = {}) {
    const { status, assignedTo, search, page = 1, limit = 20 } = params;
    const where = {};
    if (status) {
        where.status = status;
    }
    if (assignedTo) {
        where.assignedAdminId = assignedTo;
    }
    if (search) {
        where.OR = [
            { contactEmail: { contains: search, mode: 'insensitive' } },
            { contactName: { contains: search, mode: 'insensitive' } },
        ];
    }
    const [conversations, total] = await Promise.all([
        prisma_1.prisma.conversation.findMany({
            where,
            orderBy: { lastMessageAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            include: {
                assignedAdmin: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                    },
                },
                originalMessage: {
                    select: {
                        id: true,
                        inquiryType: true,
                        message: true,
                        status: true,
                    },
                },
                _count: {
                    select: {
                        messages: true,
                    },
                },
            },
        }),
        prisma_1.prisma.conversation.count({ where }),
    ]);
    return {
        conversations,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
}
/**
 * Get a single conversation with all messages
 */
async function getConversationById(id) {
    const conversation = await prisma_1.prisma.conversation.findUnique({
        where: { id },
        include: {
            assignedAdmin: {
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                },
            },
            messages: {
                orderBy: { createdAt: 'asc' },
                include: {
                    sender: {
                        select: {
                            id: true,
                            fullName: true,
                        },
                    },
                },
            },
            originalMessage: {
                select: {
                    id: true,
                    inquiryType: true,
                    message: true,
                },
            },
        },
    });
    return conversation;
}
/**
 * Get conversation by contact email
 */
async function getConversationByEmail(email) {
    const conversation = await prisma_1.prisma.conversation.findFirst({
        where: { contactEmail: email.toLowerCase().trim() },
        orderBy: { lastMessageAt: 'desc' },
        include: {
            assignedAdmin: {
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                },
            },
            messages: {
                orderBy: { createdAt: 'asc' },
                include: {
                    sender: {
                        select: {
                            id: true,
                            fullName: true,
                        },
                    },
                },
            },
            originalMessage: {
                select: {
                    id: true,
                    inquiryType: true,
                    message: true,
                },
            },
        },
    });
    return conversation;
}
/**
 * Create an admin response to a conversation
 */
async function createAdminResponse(input) {
    const { conversation, message } = await prisma_1.prisma.$transaction(async (tx) => {
        // Get the conversation
        const conversation = await tx.conversation.findUnique({
            where: { id: input.conversationId },
            include: {
                originalMessage: true,
            },
        });
        if (!conversation) {
            throw new Error('Conversation not found');
        }
        // Create the message
        const message = await tx.message.create({
            data: {
                conversationId: input.conversationId,
                senderType: 'ADMIN',
                senderId: input.adminId,
                content: input.content,
                isEmailSent: false,
            },
        });
        // Update conversation last message time
        await tx.conversation.update({
            where: { id: input.conversationId },
            data: {
                lastMessageAt: new Date(),
                assignedAdminId: input.adminId,
            },
        });
        // Update original contact message status
        await tx.contactMessage.update({
            where: { id: conversation.originalMessageId },
            data: { status: 'REPLIED' },
        });
        return { conversation, message };
    });
    // Get admin details
    const admin = await prisma_1.prisma.admin.findUnique({
        where: { id: input.adminId },
        select: { fullName: true },
    });
    // Send email notification to the contact
    const emailResult = await (0, emailService_1.sendAdminResponseNotification)({
        to: conversation.contactEmail,
        name: conversation.contactName,
        adminName: admin?.fullName || 'WLD2Cash Team',
        responseContent: input.content,
        conversationId: input.conversationId,
    });
    // Update message with email status
    await prisma_1.prisma.message.update({
        where: { id: message.id },
        data: {
            isEmailSent: emailResult.success,
            emailSentAt: emailResult.success ? new Date() : null,
            emailError: emailResult.error || null,
        },
    });
    return {
        message: {
            ...message,
            isEmailSent: emailResult.success,
            emailSentAt: emailResult.success ? new Date() : null,
        },
        emailSent: emailResult.success,
        emailError: emailResult.error,
    };
}
/**
 * Assign a conversation to an admin
 */
async function assignConversation(conversationId, adminId) {
    return prisma_1.prisma.conversation.update({
        where: { id: conversationId },
        data: { assignedAdminId: adminId },
        include: {
            assignedAdmin: {
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                },
            },
        },
    });
}
/**
 * Update conversation status
 */
async function updateConversationStatus(conversationId, status) {
    const conversation = await prisma_1.prisma.conversation.update({
        where: { id: conversationId },
        data: { status },
    });
    // Also update the original contact message status
    if (status === 'CLOSED') {
        await prisma_1.prisma.contactMessage.update({
            where: { id: conversation.originalMessageId },
            data: { status: 'RESOLVED' },
        });
    }
    return conversation;
}
/**
 * Mark contact message as read
 */
async function markMessageAsRead(contactMessageId) {
    return prisma_1.prisma.contactMessage.update({
        where: { id: contactMessageId },
        data: { status: 'READ' },
    });
}
/**
 * Get dashboard statistics
 */
async function getContactStats() {
    const [totalMessages, newMessages, repliedMessages, totalConversations, activeConversations, closedConversations,] = await Promise.all([
        prisma_1.prisma.contactMessage.count(),
        prisma_1.prisma.contactMessage.count({ where: { status: 'NEW' } }),
        prisma_1.prisma.contactMessage.count({ where: { status: 'REPLIED' } }),
        prisma_1.prisma.conversation.count(),
        prisma_1.prisma.conversation.count({ where: { status: 'ACTIVE' } }),
        prisma_1.prisma.conversation.count({ where: { status: 'CLOSED' } }),
    ]);
    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentMessages = await prisma_1.prisma.contactMessage.count({
        where: {
            createdAt: {
                gte: sevenDaysAgo,
            },
        },
    });
    return {
        totalMessages,
        newMessages,
        repliedMessages,
        totalConversations,
        activeConversations,
        closedConversations,
        recentMessages,
    };
}
/**
 * Get all contact messages (for admin view)
 */
async function getContactMessages(params = {}) {
    const { status, inquiryType, page = 1, limit = 20 } = params;
    const where = {};
    if (status) {
        where.status = status;
    }
    if (inquiryType) {
        where.inquiryType = inquiryType;
    }
    const [messages, total] = await Promise.all([
        prisma_1.prisma.contactMessage.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            include: {
                conversation: {
                    select: {
                        id: true,
                        status: true,
                        assignedAdmin: {
                            select: {
                                id: true,
                                fullName: true,
                            },
                        },
                    },
                },
            },
        }),
        prisma_1.prisma.contactMessage.count({ where }),
    ]);
    return {
        messages,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
}
//# sourceMappingURL=contactService.js.map