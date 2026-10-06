/**
 * contactService.ts — Contact form and conversation management service
 *
 * Handles:
 * - Saving contact form submissions
 * - Managing conversations
 * - Admin responses
 * - Email notifications
 */
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
export declare function createContactMessage(input: CreateContactMessageInput): Promise<{
    contactMessage: {
        message: string;
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        email: string;
        company: string | null;
        inquiryType: string;
        ipAddress: string | null;
        userAgent: string | null;
        updatedAt: Date;
    };
    conversation: {
        originalMessage: {
            message: string;
            id: string;
            name: string;
            status: string;
            createdAt: Date;
            email: string;
            company: string | null;
            inquiryType: string;
            ipAddress: string | null;
            userAgent: string | null;
            updatedAt: Date;
        };
    } & {
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        contactEmail: string;
        contactName: string;
        contactCompany: string | null;
        lastMessageAt: Date;
        originalMessageId: string;
        assignedAdminId: string | null;
    };
    emailSent: boolean;
    emailError: string | undefined;
}>;
/**
 * Get all conversations grouped by contact email (unique contacts)
 */
export declare function getConversations(params?: {
    status?: string;
    assignedTo?: string;
    search?: string;
    page?: number;
    limit?: number;
}): Promise<{
    conversations: ({
        _count: {
            messages: number;
        };
        originalMessage: {
            message: string;
            id: string;
            status: string;
            inquiryType: string;
        };
        assignedAdmin: {
            id: string;
            fullName: string;
            email: string;
        } | null;
    } & {
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        contactEmail: string;
        contactName: string;
        contactCompany: string | null;
        lastMessageAt: Date;
        originalMessageId: string;
        assignedAdminId: string | null;
    })[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}>;
/**
 * Get a single conversation with all messages
 */
export declare function getConversationById(id: string): Promise<ConversationWithMessages | null>;
/**
 * Get conversation by contact email
 */
export declare function getConversationByEmail(email: string): Promise<({
    originalMessage: {
        message: string;
        id: string;
        inquiryType: string;
    };
    messages: ({
        sender: {
            id: string;
            fullName: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        senderType: string;
        content: string;
        isEmailSent: boolean;
        emailSentAt: Date | null;
        emailError: string | null;
        conversationId: string;
        senderId: string | null;
    })[];
    assignedAdmin: {
        id: string;
        fullName: string;
        email: string;
    } | null;
} & {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    contactEmail: string;
    contactName: string;
    contactCompany: string | null;
    lastMessageAt: Date;
    originalMessageId: string;
    assignedAdminId: string | null;
}) | null>;
/**
 * Create an admin response to a conversation
 */
export declare function createAdminResponse(input: CreateResponseInput): Promise<{
    message: {
        isEmailSent: boolean;
        emailSentAt: Date | null;
        id: string;
        createdAt: Date;
        senderType: string;
        content: string;
        emailError: string | null;
        conversationId: string;
        senderId: string | null;
    };
    emailSent: boolean;
    emailError: string | undefined;
}>;
/**
 * Assign a conversation to an admin
 */
export declare function assignConversation(conversationId: string, adminId: string): Promise<{
    assignedAdmin: {
        id: string;
        fullName: string;
        email: string;
    } | null;
} & {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    contactEmail: string;
    contactName: string;
    contactCompany: string | null;
    lastMessageAt: Date;
    originalMessageId: string;
    assignedAdminId: string | null;
}>;
/**
 * Update conversation status
 */
export declare function updateConversationStatus(conversationId: string, status: 'ACTIVE' | 'CLOSED' | 'ARCHIVED'): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    contactEmail: string;
    contactName: string;
    contactCompany: string | null;
    lastMessageAt: Date;
    originalMessageId: string;
    assignedAdminId: string | null;
}>;
/**
 * Mark contact message as read
 */
export declare function markMessageAsRead(contactMessageId: string): Promise<{
    message: string;
    id: string;
    name: string;
    status: string;
    createdAt: Date;
    email: string;
    company: string | null;
    inquiryType: string;
    ipAddress: string | null;
    userAgent: string | null;
    updatedAt: Date;
}>;
/**
 * Get dashboard statistics
 */
export declare function getContactStats(): Promise<{
    totalMessages: number;
    newMessages: number;
    repliedMessages: number;
    totalConversations: number;
    activeConversations: number;
    closedConversations: number;
    recentMessages: number;
}>;
/**
 * Get all contact messages (for admin view)
 */
export declare function getContactMessages(params?: {
    status?: string;
    inquiryType?: string;
    page?: number;
    limit?: number;
}): Promise<{
    messages: ({
        conversation: {
            id: string;
            status: string;
            assignedAdmin: {
                id: string;
                fullName: string;
            } | null;
        } | null;
    } & {
        message: string;
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        email: string;
        company: string | null;
        inquiryType: string;
        ipAddress: string | null;
        userAgent: string | null;
        updatedAt: Date;
    })[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}>;
//# sourceMappingURL=contactService.d.ts.map