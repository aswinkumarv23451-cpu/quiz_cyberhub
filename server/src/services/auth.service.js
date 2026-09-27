import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import { config } from '../config/env.js';
import { normalizeEmail } from '../utils/crypto.utils.js';
import { checkParticipantEligibility } from './otp.service.js';

/**
 * Signs a JWT access token containing only minimal safe claims.
 *
 * @param {Object} payload
 * @param {string} payload.userId - UUID of user
 * @param {string} payload.role - 'ADMIN' | 'TEAM_LEAD'
 * @returns {string} Signed JWT
 */
export const signToken = (payload) => {
  return jwt.sign(
    {
      userId: payload.userId,
      role: payload.role,
    },
    config.auth.jwtSecret,
    {
      expiresIn: config.auth.jwtExpiresIn,
    }
  );
};

/**
 * Verifies a JWT token and returns decoded claims.
 *
 * @param {string} token
 * @returns {Object} Decoded payload
 */
export const verifyToken = (token) => {
  return jwt.verify(token, config.auth.jwtSecret);
};

/**
 * Generates cookie options based on environment and configuration.
 * For cross-origin frontend-backend deployments (e.g., Netlify -> Render),
 * production requires SameSite=None and Secure=true with credentials: include.
 * In development, defaults to SameSite=Lax without Secure for local HTTP development.
 *
 * @returns {import('express').CookieOptions}
 */
export const getCookieOptions = () => {
  const isProduction = config.nodeEnv === 'production';
  const sameSite = (config.auth.cookieSameSite || (isProduction ? 'none' : 'lax')).toLowerCase();

  // SameSite=None strictly requires the Secure flag in all modern browsers
  const secure = config.auth.cookieSecure !== undefined
    ? config.auth.cookieSecure
    : (sameSite === 'none' ? true : isProduction);

  const options = {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
  };

  if (config.auth.cookieDomain) {
    options.domain = config.auth.cookieDomain;
  }

  return options;
};

/**
 * Attaches the authenticated session token to an HttpOnly cookie.
 * Does NOT expose the token to frontend JavaScript.
 *
 * @param {import('express').Response} res
 * @param {string} token
 */
export const setAuthCookie = (res, token) => {
  res.cookie(config.auth.cookieName, token, {
    ...getCookieOptions(),
    maxAge: config.auth.cookieMaxAgeMs,
  });
};

/**
 * Clears the authentication HttpOnly cookie on logout.
 * Must match sameSite, secure, path, and domain attributes of setAuthCookie.
 *
 * @param {import('express').Response} res
 */
export const clearAuthCookie = (res) => {
  res.clearCookie(config.auth.cookieName, getCookieOptions());
};

/**
 * Re-validates user existence and authoritative role from database.
 * NEVER trusts the role supplied by the client.
 *
 * @param {string} userId
 * @returns {Promise<{ user: Object, role: string, team?: Object, event?: Object } | null>}
 */
export const resolveUserSession = async (userId) => {
  if (!userId) return null;

  const userSql = 'SELECT id, name, email FROM users WHERE id = $1 LIMIT 1;';
  const { rows } = await query(userSql, [userId]);
  if (rows.length === 0) return null;

  const user = rows[0];
  const normalizedEmail = normalizeEmail(user.email);

  // 1. Check admin role
  if (config.auth.adminEmails.includes(normalizedEmail)) {
    return {
      user: { id: user.id, name: user.name, email: user.email },
      role: 'ADMIN',
    };
  }

  // 2. Check participant / team lead eligibility
  const eligibility = await checkParticipantEligibility(normalizedEmail);
  if (eligibility.eligible) {
    return {
      user: eligibility.user,
      role: 'TEAM_LEAD',
      team: eligibility.team,
      event: eligibility.event,
    };
  }

  // User is not an admin and not an approved Team Lead
  return {
    user: { id: user.id, name: user.name, email: user.email },
    role: 'MEMBER',
  };
};
