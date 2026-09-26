import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

// In-memory test mailbox for automated tests (NODE_ENV=test or provider='test')
const testMailbox = [];

/**
 * Checks whether email delivery is properly configured.
 * @returns {boolean}
 */
export const isEmailConfigured = () => {
  if (config.email.provider === 'test' || config.nodeEnv === 'test') {
    return true;
  }
  if (config.email.provider === 'agentmail') {
    return Boolean(config.email.agentmailApiKey);
  }
  if (config.email.provider === 'resend') {
    return Boolean(config.email.resendApiKey);
  }
  if (config.email.provider === 'smtp') {
    return Boolean(config.email.smtpHost && config.email.smtpUser);
  }
  if (config.email.agentmailApiKey) return true;
  if (config.email.resendApiKey) return true;
  if (config.email.smtpHost && config.email.smtpUser) return true;
  return false;
};

/**
 * Dispatches an OTP verification email to the user.
 * NEVER logs or exposes the OTP.
 *
 * @param {Object} params
 * @param {string} params.to - Recipient normalized email address
 * @param {string} params.otp - Plaintext 6-digit OTP
 * @returns {Promise<{ success: boolean, messageId?: string }>}
 */
export const sendOtpEmail = async ({ to, otp }) => {
  if (!to || !otp) {
    throw new Error('Recipient email and OTP are required');
  }

  // 1. In-memory test adapter for test runs
  if (config.email.provider === 'test' || config.nodeEnv === 'test') {
    testMailbox.push({
      to,
      otp,
      sentAt: new Date(),
    });
    return { success: true, messageId: `test-${Date.now()}` };
  }

  // 2. Unconfigured provider check
  if (!isEmailConfigured()) {
    throw new Error(
      'Email provider is unconfigured. Set AGENTMAIL_API_KEY, RESEND_API_KEY, or SMTP credentials in environment.'
    );
  }

  const from = config.email.fromName
    ? `"${config.email.fromName}" <${config.email.fromAddress}>`
    : config.email.fromAddress;

  const subject = 'Your Round 1 Login Verification Code';
  const text = `Your one-time login verification code for the Round 1 Technology Competition is: ${otp}\n\nThis code will expire in 5 minutes.\nDo not share this code with anyone.\nIf you did not request this code, please ignore this email.`;
  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0f172a; color: #f8fafc; border-radius: 8px;">
        <h2 style="color: #818cf8; margin-top: 0;">Round 1 Technology Competition</h2>
        <p style="font-size: 16px; color: #cbd5e1;">Your single-use verification code is:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 16px; background-color: #1e293b; border-radius: 6px; text-align: center; color: #38bdf8; margin: 24px 0;">
          ${otp}
        </div>
        <p style="font-size: 14px; color: #94a3b8;">
          This code expires in <strong>5 minutes</strong>. If you did not request this login code, no action is needed.
        </p>
        <hr style="border: none; border-top: 1px solid #334155; margin: 20px 0;" />
        <p style="font-size: 12px; color: #64748b;">Round 1 Competition Platform • Secure Automated Delivery</p>
      </div>
    `;

  // 3. AgentMail HTTPS API delivery
  if (
    config.email.provider === 'agentmail' ||
    (!['resend', 'smtp'].includes(config.email.provider) && config.email.agentmailApiKey)
  ) {
    const inboxId = config.email.agentmailInboxId || config.email.fromAddress || 'default';
    const agentMailEndpoint = `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/messages/send`;

    const response = await fetch(agentMailEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.email.agentmailApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: [to],
        subject,
        text,
        html,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg =
        data.message ||
        data.error ||
        `AgentMail API error status ${response.status}`;
      throw new Error(`AgentMail delivery failed: ${errorMsg}`);
    }

    const messageId = data.message_id || data.id || data.messageId || `am-${Date.now()}`;
    return { success: true, messageId };
  }

  // 4. Resend HTTPS API delivery
  if (
    config.email.provider === 'resend' ||
    (!['agentmail', 'smtp'].includes(config.email.provider) && config.email.resendApiKey)
  ) {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.email.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        html,
      }),
    });

    const resendData = await resendResponse.json().catch(() => ({}));

    if (!resendResponse.ok) {
      const errorMsg =
        resendData.message ||
        `Resend API error status ${resendResponse.status}`;
      throw new Error(`Resend delivery failed: ${errorMsg}`);
    }

    return { success: true, messageId: resendData.id };
  }

  // 4. Fallback SMTP provider via nodemailer
  const transporter = nodemailer.createTransport({
    host: config.email.smtpHost,
    port: config.email.smtpPort,
    secure: config.email.smtpPort === 465,
    auth: {
      user: config.email.smtpUser,
      pass: config.email.smtpPass,
    },
  });

  const mailOptions = {
    from,
    to,
    subject,
    text,
    html,
  };

  const info = await transporter.sendMail(mailOptions);
  return { success: true, messageId: info.messageId };
};

/**
 * Test helpers for inspecting and resetting the in-memory test mailbox.
 */
export const getTestMailbox = () => [...testMailbox];
export const getLastTestEmail = () => testMailbox[testMailbox.length - 1] || null;
export const clearTestMailbox = () => {
  testMailbox.length = 0;
};
