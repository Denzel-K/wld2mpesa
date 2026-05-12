/**
 * emailService.ts — Email service with template-based emails
 *
 * Handles sending emails using Nodemailer with templates matching
 * the WLD2Mpesa website design (M-Pesa green + World blue theme).
 */

import nodemailer from 'nodemailer';
import { config } from '../config';

// Email transporter instance
let transporter: nodemailer.Transporter | null = null;

/**
 * Initialize the email transporter
 */
function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    if (!config.EMAIL_USER || !config.EMAIL_PASSWORD) {
      throw new Error('Email configuration missing: EMAIL_USER and EMAIL_PASSWORD required');
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

/**
 * Base email template with WLD2Mpesa branding
 */
function getBaseTemplate(content: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <style>
    /* Reset styles */
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      outline: none;
      text-decoration: none;
    }
    
    /* Base styles */
    body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #FAFAFA;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    /* Container */
    .email-wrapper {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      background-color: #FFFFFF;
    }
    
    /* Header */
    .email-header {
      background: linear-gradient(135deg, #00A651 0%, #007A3D 50%, #0052FF 100%);
      padding: 32px 24px;
      text-align: center;
    }
    
    .email-header h1 {
      color: #FFFFFF;
      font-family: 'Sora', -apple-system, sans-serif;
      font-size: 24px;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.5px;
    }
    
    .email-header .tagline {
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      margin-top: 8px;
    }
    
    /* Content */
    .email-content {
      padding: 32px 24px;
      color: #171717;
      font-size: 16px;
      line-height: 1.6;
    }
    
    .email-content h2 {
      color: #171717;
      font-family: 'Sora', sans-serif;
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 16px 0;
    }
    
    .email-content p {
      margin: 0 0 16px 0;
      color: #525252;
    }
    
    /* Button */
    .btn {
      display: inline-block;
      padding: 14px 28px;
      background: linear-gradient(135deg, #00A651 0%, #007A3D 100%);
      color: #FFFFFF !important;
      text-decoration: none;
      border-radius: 12px;
      font-weight: 600;
      font-size: 15px;
      text-align: center;
      box-shadow: 0 4px 16px rgba(0, 166, 81, 0.25);
    }
    
    .btn:hover {
      box-shadow: 0 6px 20px rgba(0, 166, 81, 0.35);
    }
    
    /* Card */
    .card {
      background: #F5F5F5;
      border-radius: 16px;
      padding: 20px;
      margin: 20px 0;
    }
    
    .card-title {
      color: #737373;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 8px 0;
    }
    
    .card-content {
      color: #171717;
      font-size: 15px;
      font-weight: 500;
    }
    
    /* Divider */
    .divider {
      height: 1px;
      background: #E5E5E5;
      margin: 24px 0;
    }
    
    /* Footer */
    .email-footer {
      background: #F5F5F5;
      padding: 24px;
      text-align: center;
      font-size: 13px;
      color: #737373;
    }
    
    .email-footer a {
      color: #00A651;
      text-decoration: none;
    }
    
    .social-links {
      margin: 16px 0;
    }
    
    .social-links a {
      display: inline-block;
      margin: 0 8px;
      color: #737373;
    }
    
    /* Mobile responsiveness */
    @media screen and (max-width: 480px) {
      .email-header {
        padding: 24px 16px;
      }
      
      .email-header h1 {
        font-size: 20px;
      }
      
      .email-content {
        padding: 24px 16px;
      }
      
      .btn {
        display: block;
        text-align: center;
        padding: 14px 20px;
      }
    }
  </style>
</head>
<body>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <div class="email-wrapper">
          <!-- Header -->
          <div class="email-header">
            <h1>WLD2Mpesa</h1>
            <div class="tagline">Instant Worldcoin to M-Pesa Transfers</div>
          </div>
          
          <!-- Content -->
          <div class="email-content">
            ${content}
          </div>
          
          <!-- Footer -->
          <div class="email-footer">
            <p>&copy; ${new Date().getFullYear()} WLD2Mpesa. All rights reserved.</p>
            <p>Nairobi, Kenya | <a href="mailto:hello@wld2mpesa.com">hello@wld2mpesa.com</a></p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Send a generic email
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transport = getTransporter();
    
    const result = await transport.sendMail({
      from: options.from || `"${config.EMAIL_FROM_NAME}" <${config.EMAIL_FROM_ADDRESS}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[EmailService] Failed to send email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send contact confirmation email to user
 */
export async function sendContactConfirmation(params: {
  to: string;
  name: string;
  inquiryType: string;
  message: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const inquiryTypeLabels: Record<string, string> = {
    demo: 'Demo Request',
    support: 'Technical Support',
    partnership: 'Partnership Inquiry',
    other: 'General Inquiry',
  };

  const content = `
    <h2>Thank you for reaching out, ${params.name}!</h2>
    <p>We've received your message and will get back to you within 24 hours.</p>
    
    <div class="card">
      <div class="card-title">Inquiry Type</div>
      <div class="card-content">${inquiryTypeLabels[params.inquiryType] || params.inquiryType}</div>
    </div>
    
    <div class="card">
      <div class="card-title">Your Message</div>
      <div class="card-content">${params.message.replace(/\n/g, '<br>')}</div>
    </div>
    
    <div class="divider"></div>
    
    <p>While you wait, you might want to:</p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="https://wld2mpesa.com" class="btn">Visit Our Website</a>
    </p>
    
    <p style="font-size: 14px; color: #737373;">
      If you have any urgent questions, please reply to this email or contact us directly at 
      <a href="mailto:hello@wld2mpesa.com">hello@wld2mpesa.com</a>.
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: 'We received your message — WLD2Mpesa',
    html: getBaseTemplate(content, 'Message Received'),
    text: `Thank you for reaching out, ${params.name}!\n\nWe've received your message and will get back to you within 24 hours.\n\nInquiry Type: ${inquiryTypeLabels[params.inquiryType] || params.inquiryType}\n\nYour Message: ${params.message}\n\nVisit us at https://wld2mpesa.com`,
  });
}

/**
 * Send admin response notification to user
 */
export async function sendAdminResponseNotification(params: {
  to: string;
  name: string;
  adminName: string;
  responseContent: string;
  conversationId: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const content = `
    <h2>New response from ${params.adminName}</h2>
    <p>Hi ${params.name},</p>
    <p>Our team has responded to your inquiry. Here's what they said:</p>
    
    <div class="card">
      <div class="card-title">Response</div>
      <div class="card-content">${params.responseContent.replace(/\n/g, '<br>')}</div>
    </div>
    
    <p style="text-align: center; margin: 24px 0;">
      <a href="mailto:hello@wld2mpesa.com?subject=Re: Conversation ${params.conversationId}" class="btn">Reply to this message</a>
    </p>
    
    <p style="font-size: 14px; color: #737373;">
      You can reply directly to this email to continue the conversation.
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `Response from WLD2Mpesa — ${params.adminName}`,
    html: getBaseTemplate(content, 'New Response'),
    text: `Hi ${params.name},\n\nOur team has responded to your inquiry.\n\n${params.adminName} said:\n${params.responseContent}\n\nReply to this email to continue the conversation.`,
  });
}

/**
 * Send admin invitation email
 */
export async function sendAdminInvitation(params: {
  to: string;
  name: string;
  invitedBy: string;
  inviteLink: string;
  expiresAt: Date;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const content = `
    <h2>You're invited to join the WLD2Mpesa team!</h2>
    <p>Hi ${params.name},</p>
    <p><strong>${params.invitedBy}</strong> has invited you to join the WLD2Mpesa admin team as a Manager.</p>
    
    <div class="divider"></div>
    
    <p style="text-align: center; margin: 24px 0;">
      <a href="${params.inviteLink}" class="btn">Accept Invitation</a>
    </p>
    
    <div class="card">
      <div class="card-title">Invitation Details</div>
      <div class="card-content">
        <strong>Invited by:</strong> ${params.invitedBy}<br>
        <strong>Role:</strong> Manager<br>
        <strong>Expires:</strong> ${params.expiresAt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
    </div>
    
    <p style="font-size: 14px; color: #737373;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${params.inviteLink}" style="word-break: break-all;">${params.inviteLink}</a>
    </p>
    
    <p style="font-size: 14px; color: #737373;">
      This invitation will expire in 48 hours. If you didn't expect this invitation, you can safely ignore this email.
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: 'Invitation to join WLD2Mpesa Admin Team',
    html: getBaseTemplate(content, 'Admin Invitation'),
    text: `Hi ${params.name},\n\n${params.invitedBy} has invited you to join the WLD2Mpesa admin team as a Manager.\n\nAccept your invitation: ${params.inviteLink}\n\nThis invitation expires on ${params.expiresAt.toLocaleDateString()}.`,
  });
}

/**
 * Send new message notification to admin
 */
export async function sendNewMessageNotification(params: {
  to: string;
  adminName: string;
  contactName: string;
  contactEmail: string;
  inquiryType: string;
  messagePreview: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const inquiryTypeLabels: Record<string, string> = {
    demo: 'Demo Request',
    support: 'Technical Support',
    partnership: 'Partnership Inquiry',
    other: 'General Inquiry',
  };

  const content = `
    <h2>New message received</h2>
    <p>Hi ${params.adminName},</p>
    <p>A new contact form submission requires your attention.</p>
    
    <div class="card">
      <div class="card-title">From</div>
      <div class="card-content">${params.contactName} (${params.contactEmail})</div>
    </div>
    
    <div class="card">
      <div class="card-title">Inquiry Type</div>
      <div class="card-content">${inquiryTypeLabels[params.inquiryType] || params.inquiryType}</div>
    </div>
    
    <div class="card">
      <div class="card-title">Message Preview</div>
      <div class="card-content">${params.messagePreview.substring(0, 200)}${params.messagePreview.length > 200 ? '...' : ''}</div>
    </div>
    
    <p style="text-align: center; margin: 24px 0;">
      <a href="https://wld2mpesa.com/admin-panel" class="btn">View in Admin Panel</a>
    </p>
  `;

  return sendEmail({
    to: params.to,
    subject: `New inquiry: ${params.contactName} — ${inquiryTypeLabels[params.inquiryType] || params.inquiryType}`,
    html: getBaseTemplate(content, 'New Message'),
    text: `Hi ${params.adminName},\n\nNew message from ${params.contactName} (${params.contactEmail})\n\nType: ${inquiryTypeLabels[params.inquiryType] || params.inquiryType}\n\nMessage: ${params.messagePreview}\n\nView in admin panel: https://wld2mpesa.com/admin-panel`,
  });
}

/**
 * Verify email configuration
 */
export async function verifyEmailConfig(): Promise<boolean> {
  try {
    const transport = getTransporter();
    await transport.verify();
    return true;
  } catch (error) {
    console.error('[EmailService] Configuration verification failed:', error);
    return false;
  }
}

export default {
  sendEmail,
  sendContactConfirmation,
  sendAdminResponseNotification,
  sendAdminInvitation,
  sendNewMessageNotification,
  verifyEmailConfig,
};
