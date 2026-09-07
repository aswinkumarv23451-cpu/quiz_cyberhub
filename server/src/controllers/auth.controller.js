import { requestLoginOtp, verifyLoginOtp } from '../services/otp.service.js';
import { signToken, setAuthCookie, clearAuthCookie } from '../services/auth.service.js';

/**
 * POST /api/auth/request-otp
 * Requests a single-use login OTP.
 * Always returns a generic anti-enumeration response.
 */
export const requestOtpHandler = async (req, res, next) => {
  try {
    const { email } = req.body || {};
    const result = await requestLoginOtp({ email, ip: req.ip });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/verify-otp
 * Verifies a single-use login OTP.
 * On success, sets an HttpOnly cookie containing the JWT.
 * NEVER returns the JWT in the JSON body.
 */
export const verifyOtpHandler = async (req, res, next) => {
  try {
    const { email, otp } = req.body || {};
    const verification = await verifyLoginOtp({ email, otp });

    // Generate session JWT
    const token = signToken({
      userId: verification.user.id,
      role: verification.role,
    });

    // Set JWT strictly in HttpOnly cookie
    setAuthCookie(res, token);

    // Return safe user information only (NO token in body)
    res.status(200).json({
      success: true,
      message: 'Authentication successful',
      user: {
        id: verification.user.id,
        name: verification.user.name,
        email: verification.user.email,
      },
      role: verification.role,
      ...(verification.team && {
        team: {
          id: verification.team.id,
          name: verification.team.name,
        },
      }),
      ...(verification.event && {
        event: {
          id: verification.event.id,
          name: verification.event.name,
          status: verification.event.status,
        },
      }),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 * Clears the session HttpOnly cookie.
 */
export const logoutHandler = (req, res) => {
  clearAuthCookie(res);
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

/**
 * GET /api/auth/me
 * Returns current authenticated user and session metadata.
 * Requires valid authenticated session via requireAuth.
 */
export const getMeHandler = (req, res) => {
  res.status(200).json({
    success: true,
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
    },
    role: req.user.role,
    ...(req.user.team && { team: req.user.team }),
    ...(req.user.event && { event: req.user.event }),
  });
};
