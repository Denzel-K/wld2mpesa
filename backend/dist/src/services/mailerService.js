"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMail = sendMail;
exports.verifyMailer = verifyMailer;
const nodemailer_1 = __importDefault(require("nodemailer"));
const config_1 = require("../config");
let transporter = null;
function getTransporter() {
    if (!transporter) {
        if (!config_1.config.EMAIL_USER || !config_1.config.EMAIL_PASSWORD) {
            throw new Error('Email not configured: EMAIL_USER and EMAIL_PASSWORD are required');
        }
        transporter = nodemailer_1.default.createTransport({
            host: config_1.config.EMAIL_HOST,
            port: config_1.config.EMAIL_PORT,
            secure: config_1.config.EMAIL_SECURE,
            auth: {
                user: config_1.config.EMAIL_USER,
                pass: config_1.config.EMAIL_PASSWORD,
            },
        });
    }
    return transporter;
}
function getFromAddress() {
    return `"${config_1.config.EMAIL_FROM_NAME}" <${config_1.config.EMAIL_FROM_ADDRESS}>`;
}
/**
 * Send an email via SMTP.
 * Returns { success: true, messageId } on success or { success: false, error } on failure.
 * Never throws — errors are caught and returned.
 */
async function sendMail(options) {
    try {
        const transport = getTransporter();
        const result = await transport.sendMail({
            from: options.from ?? getFromAddress(),
            to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
        });
        return { success: true, messageId: result.messageId };
    }
    catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.error('[mailerService] Send failed:', error);
        return { success: false, error };
    }
}
/**
 * Verify SMTP connectivity. Useful for health checks / startup diagnostics.
 */
async function verifyMailer() {
    try {
        await getTransporter().verify();
        return true;
    }
    catch (err) {
        console.error('[mailerService] SMTP verify failed:', err instanceof Error ? err.message : err);
        return false;
    }
}
//# sourceMappingURL=mailerService.js.map