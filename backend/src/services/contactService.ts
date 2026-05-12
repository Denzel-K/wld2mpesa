/**
 * contactService.ts — Contact form and conversation management service
 *
 * Handles:
 * - Saving contact form submissions
 * - Managing conversations
 * - Admin responses
 * - Email notifications
 */

import { prisma } from '../db/prisma';
import { sendContactConfirmation, sendAdminResponseNotification, sendNewMessageNotification } from './emailService';

// Types
export interface CreateContactMessageInput {
  name: string;
  email: string;
  company?: string;
  inquiryType: 'demo' | 'support' | 'partnership' | 'other';
  message: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateResponseInput {
  conversationId: string;
  adminId: string;
  content: string;
}

export interface ConversationWithMessages {
  id: string;
  contactEmail: string;
  contactName: string;
  contactCompany: string | null;
  status: string;
  lastMessageAt: Date;
  createdAt: Date;
  assignedAdmin: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  messages: Array<{
    id: string;
    senderType: string;
    senderId: string | null;
    sender: {
      id: string;
      fullName: string;
    } | null;
    content: string;
    isEmailSent: boolean;
    emailSentAt: Date | null;
    createdAt: Date;
  }>;
  originalMessage: {
    id: string;
    inquiryType: string;
    message: string;
  };
}

/**
 * Create a new contact message and start a conversation
 */
export async function createContactMessage(input: CreateContactMessageInput) {
  // Create the contact message
  const contactMessage = await prisma.contactMessage.create({
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
  const conversation = await prisma.conversation.create({
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
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderType: 'CONTACT',
      content: input.message,
      isEmailSent: true, // Original contact doesn't need email sent
      emailSentAt: new Date(),
    },
  });

  // Send confirmation email to the user
  const emailResult = await sendContactConfirmation({
    to: input.email,
    name: input.name,
    inquiryType: input.inquiryType,
    message: input.message,
  });

  // Notify all active super admins about the new message
  const superAdmins = await prisma.admin.findMany({
    where: {
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });

  for (const admin of superAdmins) {
    await sendNewMessageNotification({
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
export async function getConversations(params: {
  status?: string;
  assignedTo?: string;
  search?: string;
  page?: number;
  limit?: number;
} = {}) {
  const { status, assignedTo, search, page = 1, limit = 20 } = params;

  const where: any = {};

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
    prisma.conversation.findMany({
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
    prisma.conversation.count({ where }),
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
export async function getConversationById(id: string): Promise<ConversationWithMessages | null> {
  const conversation = await prisma.conversation.findUnique({
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

  return conversation as ConversationWithMessages | null;
}

/**
 * Get conversation by contact email
 */
export async function getConversationByEmail(email: string) {
  const conversation = await prisma.conversation.findFirst({
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
export async function createAdminResponse(input: CreateResponseInput) {
  const { conversationId, adminId, content } = await prisma.$transaction(async (tx) => {
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
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { fullName: true },
  });

  // Send email notification to the contact
  const emailResult = await sendAdminResponseNotification({
    to: conversation.contactEmail,
    name: conversation.contactName,
    adminName: admin?.fullName || 'WLD2Mpesa Team',
    responseContent: content,
    conversationId,
  });

  // Update message with email status
  await prisma.message.update({
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
export async function assignConversation(conversationId: string, adminId: string) {
  return prisma.conversation.update({
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
export async function updateConversationStatus(
  conversationId: string,
  status: 'ACTIVE' | 'CLOSED' | 'ARCHIVED'
) {
  const conversation = await prisma.conversation.update({
    where: { id: conversationId },
    data: { status },
  });

  // Also update the original contact message status
  if (status === 'CLOSED') {
    await prisma.contactMessage.update({
      where: { id: conversation.originalMessageId },
      data: { status: 'RESOLVED' },
    });
  }

  return conversation;
}

/**
 * Mark contact message as read
 */
export async function markMessageAsRead(contactMessageId: string) {
  return prisma.contactMessage.update({
    where: { id: contactMessageId },
    data: { status: 'READ' },
  });
}

/**
 * Get dashboard statistics
 */
export async function getContactStats() {
  const [
    totalMessages,
    newMessages,
    repliedMessages,
    totalConversations,
    activeConversations,
    closedConversations,
  ] = await Promise.all([
    prisma.contactMessage.count(),
    prisma.contactMessage.count({ where: { status: 'NEW' } }),
    prisma.contactMessage.count({ where: { status: 'REPLIED' } }),
    prisma.conversation.count(),
    prisma.conversation.count({ where: { status: 'ACTIVE' } }),
    prisma.conversation.count({ where: { status: 'CLOSED' } }),
  ]);

  // Get recent activity (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentMessages = await prisma.contactMessage.count({
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
export async function getContactMessages(params: {
  status?: string;
  inquiryType?: string;
  page?: number;
  limit?: number;
} = {}) {
  const { status, inquiryType, page = 1, limit = 20 } = params;

  const where: any = {};

  if (status) {
    where.status = status;
  }

  if (inquiryType) {
    where.inquiryType = inquiryType;
  }

  const [messages, total] = await Promise.all([
    prisma.contactMessage.findMany({
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
    prisma.contactMessage.count({ where }),
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
