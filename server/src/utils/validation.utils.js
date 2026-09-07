import { normalizeEmail } from './crypto.utils.js';

export { normalizeEmail };

/**
 * Normalizes Indian phone numbers into consistent standard format: "+91XXXXXXXXXX"
 * Accepts:
 *   - +91XXXXXXXXXX
 *   - 91XXXXXXXXXX
 *   - 0XXXXXXXXXX
 *   - XXXXXXXXXX
 * Validates that the 10-digit number starts with 6, 7, 8, or 9.
 *
 * @param {string} phone
 * @returns {string|null} Normalized phone or null if invalid
 */
export const normalizeIndianPhone = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return null;
  }

  // Remove spaces, dashes, parentheses, dots
  const cleaned = phone.trim().replace(/[\s\-.()]/g, '');

  let digits = '';
  if (cleaned.startsWith('+91')) {
    digits = cleaned.slice(3);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    digits = cleaned.slice(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    digits = cleaned.slice(1);
  } else {
    digits = cleaned;
  }

  // Must be exactly 10 digits starting with 6-9
  if (/^[6-9]\d{9}$/.test(digits)) {
    return `+91${digits}`;
  }

  return null;
};

/**
 * Validates a college roll/register number.
 * Ensures non-empty, reasonable length (2-50 chars), no invalid control characters.
 *
 * @param {string} regNo
 * @returns {string|null} Trimmed register number or null
 */
export const validateRegisterNumber = (regNo) => {
  if (!regNo || typeof regNo !== 'string') {
    return null;
  }
  const trimmed = regNo.trim().toUpperCase();
  if (trimmed.length < 2 || trimmed.length > 50) {
    return null;
  }
  // Allow alphanumeric and common separators (/ - _)
  if (!/^[A-Z0-9/\-_]+$/.test(trimmed)) {
    return null;
  }
  return trimmed;
};
