import { query } from '../config/database.js';
import { config } from '../config/env.js';
import {
  generateSecureOtp,
  hashOtp,
  timingSafeEqual,
  normalizeEmail,
} from '../utils/crypto.utils.js';
import { sendOtpEmail } from './email.service.js';

// In-memory tracker for failed verification attempts per OTP ID
// Synced to database on reaching maximum allowed attempts (5)
const failedAttemptsMap = new Map();

/**
 * Resets tracking map (useful for test isolation).
 */
export const resetOtpTracking = () => {
  failedAttemptsMap.clear();
};

/**
 * Validates whether a participant email corresponds to an approved Team Lead
 * for an active competition event.
 *
 * @param {string} normalizedEmail
 * @returns {Promise<{ eligible: boolean, user?: Object, team?: Object, event?: Object }>}
 */
export const checkParticipantEligibility = async (normalizedEmail) => {
  const sql = `
    SELECT 
      u.id AS user_id,
      u.name AS user_name,
      u.email AS user_email,
      tm.role AS member_role,
      t.id AS team_id,
      t.name AS team_name,
      t.registration_status,
      e.id AS event_id,
      e.name AS event_name,
      e.status AS event_status
    FROM users u
    JOIN team_members tm ON tm.user_id = u.id
    JOIN teams t ON t.id = tm.team_id AND t.event_id = tm.event_id
    JOIN event e ON e.id = t.event_id
    WHERE LOWER(u.email) = $1
      AND e.status IN ('READY', 'LIVE', 'ENDED')
    ORDER BY e.created_at DESC
    LIMIT 1;
  `;

  const { rows } = await query(sql, [normalizedEmail]);
  if (rows.length === 0) {
    return { eligible: false };
  }

  const record = rows[0];
  const isApprovedTeamLead =
    record.member_role === 'TEAM_LEAD' &&
    record.registration_status === 'APPROVED';

  if (!isApprovedTeamLead) {
    return { eligible: false };
  }

  return {
    eligible: true,
    user: {
      id: record.user_id,
      name: record.user_name,
      email: record.user_email,
    },
    team: {
      id: record.team_id,
      name: record.team_name,
      registrationStatus: record.registration_status,
    },
    event: {
      id: record.event_id,
      name: record.event_name,
      status: record.event_status,
    },
  };
};

/**
 * Retrieves or creates an admin user record for an authorized admin email.
 * Satisfies the foreign key constraint `otp_codes.user_id REFERENCES users(id)`.
 *
 * @param {string} normalizedEmail
 * @returns {Promise<Object>} user record
 */
export const getOrCreateAdminUser = async (normalizedEmail) => {
  const findSql = 'SELECT id, name, email FROM users WHERE LOWER(email) = $1 LIMIT 1;';
  const { rows } = await query(findSql, [normalizedEmail]);

  if (rows.length > 0) {
    return rows[0];
  }

  const insertSql = `
    INSERT INTO users (name, email)
    VALUES ('System Administrator', $1)
    RETURNING id, name, email;
  `;
  const insertRes = await query(insertSql, [normalizedEmail]);
  return insertRes.rows[0];
};

/**
 * Handles requesting a one-time login verification code.
 * Strict anti-enumeration: always returns generic message to client.
 *
 * @param {Object} params
 * @param {string} params.email - Raw input email
 * @param {string} [params.ip] - Request IP address for rate-limiting
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const requestLoginOtp = async ({ email }) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    // Return anti-enumeration message even for invalid format
    return {
      success: true,
      message: 'If the account is eligible, an OTP has been sent.',
    };
  }

  // 1. Check if email belongs to authorized admin allowlist
  const isAdmin = config.auth.adminEmails.includes(normalizedEmail);

  let targetUser = null;

  if (isAdmin) {
    targetUser = await getOrCreateAdminUser(normalizedEmail);
  } else {
    // 2. Check participant eligibility (approved Team Lead for active event)
    const eligibility = await checkParticipantEligibility(normalizedEmail);
    if (eligibility.eligible) {
      targetUser = eligibility.user;
    }
  }

  // 3. Anti-Enumeration: If user is neither admin nor eligible participant, exit silently
  if (!targetUser) {
    return {
      success: true,
      message: 'If the account is eligible, an OTP has been sent.',
    };
  }

  // 4. Enforce resend cooldown (60 seconds)
  const cooldownSql = `
    SELECT id, created_at
    FROM otp_codes
    WHERE user_id = $1
      AND purpose = 'login'
      AND created_at > NOW() - INTERVAL '60 seconds'
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  const cooldownRes = await query(cooldownSql, [targetUser.id]);
  if (cooldownRes.rows.length > 0) {
    const error = new Error('Please wait 60 seconds before requesting another code.');
    error.statusCode = 429;
    throw error;
  }

  // 5. Invalidate previous unused login OTPs for this user
  await query(
    `UPDATE otp_codes
     SET is_used = TRUE
     WHERE user_id = $1 AND purpose = 'login' AND is_used = FALSE;`,
    [targetUser.id]
  );

  // 6. Generate cryptographically secure 6-digit OTP and HMAC-SHA256 hash
  const otp = generateSecureOtp();
  const otpHash = hashOtp(otp);

  // 7. Store hashed OTP in database with 5-minute expiry
  const insertOtpSql = `
    INSERT INTO otp_codes (user_id, otp_hash, purpose, expires_at, is_used)
    VALUES ($1, $2, 'login', NOW() + INTERVAL '5 minutes', FALSE)
    RETURNING id, expires_at;
  `;
  const insertOtpRes = await query(insertOtpSql, [targetUser.id, otpHash]);
  const otpRecord = insertOtpRes.rows[0];

  // 8. Dispatch OTP via transactional email
  try {
    await sendOtpEmail({ to: normalizedEmail, otp });
  } catch (emailError) {
    // On email delivery failure:
    // - Invalidate the newly created OTP in the database
    // - Never log or leak the OTP
    // - Return safe generic error
    await query('UPDATE otp_codes SET is_used = TRUE WHERE id = $1;', [
      otpRecord.id,
    ]);

    const dispatchError = new Error(
      'Failed to dispatch verification code. Please try again later.'
    );
    dispatchError.statusCode = 500;
    throw dispatchError;
  }

  return {
    success: true,
    message: 'If the account is eligible, an OTP has been sent.',
  };
};

/**
 * Verifies an OTP and resolves authenticated user status.
 *
 * @param {Object} params
 * @param {string} params.email - Raw input email
 * @param {string} params.otp - User-entered 6-digit OTP string
 * @returns {Promise<{ user: Object, role: string }>}
 */
export const verifyLoginOtp = async ({ email, otp }) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !otp || typeof otp !== 'string') {
    const error = new Error('Email and 6-digit verification code are required.');
    error.statusCode = 400;
    throw error;
  }

  const cleanOtp = otp.trim();
  if (!/^\d{6}$/.test(cleanOtp)) {
    const error = new Error('Verification code must be exactly 6 digits.');
    error.statusCode = 400;
    throw error;
  }

  // 1. Locate user
  const userSql = 'SELECT id, name, email FROM users WHERE LOWER(email) = $1 LIMIT 1;';
  const userRes = await query(userSql, [normalizedEmail]);
  if (userRes.rows.length === 0) {
    const error = new Error('Invalid or expired verification code.');
    error.statusCode = 400;
    throw error;
  }
  const user = userRes.rows[0];

  // 2. Locate active, unexpired, unused login OTP
  const otpSql = `
    SELECT id, otp_hash, expires_at, is_used, created_at
    FROM otp_codes
    WHERE user_id = $1
      AND purpose = 'login'
      AND is_used = FALSE
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  const otpRes = await query(otpSql, [user.id]);
  if (otpRes.rows.length === 0) {
    const error = new Error('Invalid or expired verification code.');
    error.statusCode = 400;
    throw error;
  }
  const otpRecord = otpRes.rows[0];

  // 3. Check failed attempts for this specific OTP
  const currentAttempts = failedAttemptsMap.get(otpRecord.id) || 0;
  if (currentAttempts >= config.otp.maxAttempts) {
    // Invalidate OTP in database
    await query('UPDATE otp_codes SET is_used = TRUE WHERE id = $1;', [
      otpRecord.id,
    ]);
    failedAttemptsMap.delete(otpRecord.id);

    const error = new Error(
      'Maximum verification attempts exceeded. Please request a new code.'
    );
    error.statusCode = 400;
    throw error;
  }

  // 4. Compute candidate HMAC-SHA256 hash and compare in constant time
  const candidateHash = hashOtp(cleanOtp);
  const isValid = timingSafeEqual(otpRecord.otp_hash, candidateHash);

  if (!isValid) {
    const newAttempts = currentAttempts + 1;
    failedAttemptsMap.set(otpRecord.id, newAttempts);

    if (newAttempts >= config.otp.maxAttempts) {
      // Invalidate OTP on 5th failure
      await query('UPDATE otp_codes SET is_used = TRUE WHERE id = $1;', [
        otpRecord.id,
      ]);
      failedAttemptsMap.delete(otpRecord.id);

      const error = new Error(
        'Maximum verification attempts exceeded. Please request a new code.'
      );
      error.statusCode = 400;
      throw error;
    }

    const error = new Error('Invalid or expired verification code.');
    error.statusCode = 400;
    throw error;
  }

  // 5. Successful verification: mark OTP as used immediately
  await query('UPDATE otp_codes SET is_used = TRUE WHERE id = $1;', [
    otpRecord.id,
  ]);
  failedAttemptsMap.delete(otpRecord.id);

  // 6. Determine authoritative role
  const isAdmin = config.auth.adminEmails.includes(normalizedEmail);
  if (isAdmin) {
    return {
      user: { id: user.id, name: user.name, email: user.email },
      role: 'ADMIN',
    };
  }

  const eligibility = await checkParticipantEligibility(normalizedEmail);
  if (!eligibility.eligible) {
    const error = new Error('Account is not authorized for competition access.');
    error.statusCode = 403;
    throw error;
  }

  return {
    user: eligibility.user,
    role: 'TEAM_LEAD',
    team: eligibility.team,
    event: eligibility.event,
  };
};
