import { config } from '../config/env.js';
import { verifyToken, resolveUserSession } from '../services/auth.service.js';

/**
 * Middleware: Requires valid authenticated session via HttpOnly cookie (or Bearer header).
 * Authoritatively verifies user identity against the database.
 */
export const requireAuth = async (req, res, next) => {
  try {
    // 1. Extract token from HttpOnly cookie or Authorization header
    let token = req.cookies?.[config.auth.cookieName];

    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.',
      });
    }

    // 2. Verify signature and expiry
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session. Please log in again.',
      });
    }

    // 3. Authoritative server-side identity & role verification
    const session = await resolveUserSession(decoded.userId);
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'User account not found or session revoked.',
      });
    }

    // Attach verified user and authoritative role to request
    req.user = {
      ...session.user,
      role: session.role,
      team: session.team,
      event: session.event,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware: Requires ADMIN role.
 * Must be preceded by requireAuth.
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden. Administrator access required.',
    });
  }
  next();
};

/**
 * Middleware: Requires TEAM_LEAD role.
 * Must be preceded by requireAuth.
 */
export const requireTeamLead = (req, res, next) => {
  if (!req.user || req.user.role !== 'TEAM_LEAD') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden. Team Lead authorization required.',
    });
  }
  next();
};
