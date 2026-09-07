import { apiClient } from './apiClient';

/**
 * Requests a one-time login verification code.
 * @param {string} email
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const requestOtp = async (email) => {
  return await apiClient('/api/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
};

/**
 * Verifies the single-use OTP code.
 * @param {string} email
 * @param {string} otp
 * @returns {Promise<{ success: boolean, user: Object, role: string, team?: Object, event?: Object }>}
 */
export const verifyOtp = async (email, otp) => {
  return await apiClient('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  });
};

/**
 * Logs out and clears the session cookie.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const logout = async () => {
  return await apiClient('/api/auth/logout', {
    method: 'POST',
  });
};

/**
 * Fetches the currently authenticated user's session.
 * @returns {Promise<{ success: boolean, user: Object, role: string, team?: Object, event?: Object }>}
 */
export const getMe = async () => {
  return await apiClient('/api/auth/me', {
    method: 'GET',
  });
};
