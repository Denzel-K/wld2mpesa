/**
 * emailService.ts — Email service with template-based emails
 *
 * Handles sending emails using Nodemailer with templates matching
 * the WLD2Mpesa website design (M-Pesa green + World blue theme).
 */
/**
 * Send a generic email
 */
export declare function sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    from?: string;
}): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
}>;
/**
 * Send contact confirmation email to user
 */
export declare function sendContactConfirmation(params: {
    to: string;
    name: string;
    inquiryType: string;
    message: string;
}): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
}>;
/**
 * Send admin response notification to user
 */
export declare function sendAdminResponseNotification(params: {
    to: string;
    name: string;
    adminName: string;
    responseContent: string;
    conversationId: string;
}): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
}>;
/**
 * Send admin invitation email
 */
export declare function sendAdminInvitation(params: {
    to: string;
    name: string;
    invitedBy: string;
    inviteLink: string;
    expiresAt: Date;
}): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
}>;
/**
 * Send new message notification to admin
 */
export declare function sendNewMessageNotification(params: {
    to: string;
    adminName: string;
    contactName: string;
    contactEmail: string;
    inquiryType: string;
    messagePreview: string;
}): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
}>;
/**
 * Verify email configuration
 */
export declare function verifyEmailConfig(): Promise<boolean>;
declare const _default: {
    sendEmail: typeof sendEmail;
    sendContactConfirmation: typeof sendContactConfirmation;
    sendAdminResponseNotification: typeof sendAdminResponseNotification;
    sendAdminInvitation: typeof sendAdminInvitation;
    sendNewMessageNotification: typeof sendNewMessageNotification;
    verifyEmailConfig: typeof verifyEmailConfig;
};
export default _default;
//# sourceMappingURL=emailService.d.ts.map