import crypto from 'crypto';
import { config } from '../config/env.js';

/**
 * Generates a cryptographically secure 6-digit numeric OTP.
 * Range: 100000 to 999999 (inclusive).
 *
 * @returns {string} 6-digit string
 */
export const generateSecureOtp = () => {
  const otpNumber = crypto.randomInt(100000, 1000000);
  return otpNumber.toString();
};

/**
 * Computes HMAC-SHA256 hash of an OTP using the server-side OTP_HASH_SECRET.
 * Never stores or returns plaintext OTPs.
 *
 * @param {string} otp - 6-digit plaintext OTP
 * @returns {string} Hex-encoded HMAC-SHA256 hash
 */
export const hashOtp = (otp) => {
  if (!otp || typeof otp !== 'string') {
    throw new Error('OTP must be a valid string');
  }
  return crypto
    .createHmac('sha256', config.auth.otpHashSecret)
    .update(otp)
    .digest('hex');
};

/**
 * Constant-time string comparison to prevent timing attacks.
 *
 * @param {string} a - Known hash
 * @param {string} b - User-provided hash to verify
 * @returns {boolean} True if hashes match exactly
 */
export const timingSafeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Normalizes email by trimming whitespace and converting to lowercase.
 *
 * @param {string} email
 * @returns {string}
 */
export const normalizeEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return '';
  }
  return email.trim().toLowerCase();
};
