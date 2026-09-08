import express from 'express';
import {
  requestOtpHandler,
  verifyOtpHandler,
  logoutHandler,
  getMeHandler,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  rateLimitOtpRequest,
  rateLimitOtpVerify,
} from '../middleware/rateLimit.middleware.js';

const router = express.Router();

/**
 * Public Authentication Routes
 * Hardened with IP-based rate limiting while preserving per-account cooldowns.
 */
router.post('/request-otp', rateLimitOtpRequest, requestOtpHandler);
router.post('/verify-otp', rateLimitOtpVerify, verifyOtpHandler);
router.post('/logout', logoutHandler);

/**
 * Protected Identity Route
 */
router.get('/me', requireAuth, getMeHandler);

export default router;
