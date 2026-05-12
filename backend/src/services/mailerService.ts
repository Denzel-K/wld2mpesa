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

import nodemailer from 'nodemailer';
import { config } from '../config';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    if (!config.EMAIL_USER || !config.EMAIL_PASSWORD) {
      throw new Error('Email not configured: EMAIL_USER and EMAIL_PASSWORD are required');
    }
    transporter = nodemailer.createTransport({
      host: config.EMAIL_HOST,
      port: config.EMAIL_PORT,
      secure: config.EMAIL_SECURE,
      auth: {
        user: config.EMAIL_USER,
        pass: config.EMAIL_PASSWORD,
      },
    });
  }
  return transporter;
}

function getFromAddress(): string {
  return `"${config.EMAIL_FROM_NAME}" <${config.EMAIL_FROM_ADDRESS}>`;
}

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
export async function sendMail(
  options: SendMailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
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
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[mailerService] Send failed:', error);
    return { success: false, error };
  }
}

/**
 * Verify SMTP connectivity. Useful for health checks / startup diagnostics.
 */
export async function verifyMailer(): Promise<boolean> {
  try {
    await getTransporter().verify();
    return true;
  } catch (err) {
    console.error('[mailerService] SMTP verify failed:', err instanceof Error ? err.message : err);
    return false;
  }
}
