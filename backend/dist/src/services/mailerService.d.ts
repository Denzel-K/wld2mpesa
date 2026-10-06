/**
 * mailerService.ts — Standalone SMTP email service for the miniapp backend
 *
 * Provides a configured nodemailer transporter and a generic send helper.
 * Email templates for specific events (payments, alerts, etc.) should be
 * added here as the platform grows.
 *
 * Config (set in .env):
 *   EMAIL_HOST         — SMTP host       (default: smtp.gmail.com)
 *   EMAIL_PORT         — SMTP port       (default: 587)
 *   EMAIL_SECURE       — TLS flag        (default: false)
 *   EMAIL_USER         — SMTP username
 *   EMAIL_PASSWORD     — SMTP password / app password
 *   EMAIL_FROM_NAME    — Sender display name  (default: WLD2Mpesa)
 *   EMAIL_FROM_ADDRESS — Sender address       (default: noreply@wld2mpesa.com)
 */
export interface SendMailOptions {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    from?: string;
}
/**
 * Send an email via SMTP.
 * Returns { success: true, messageId } on success or { success: false, error } on failure.
 * Never throws — errors are caught and returned.
 */
export declare function sendMail(options: SendMailOptions): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
}>;
/**
 * Verify SMTP connectivity. Useful for health checks / startup diagnostics.
 */
export declare function verifyMailer(): Promise<boolean>;
//# sourceMappingURL=mailerService.d.ts.map