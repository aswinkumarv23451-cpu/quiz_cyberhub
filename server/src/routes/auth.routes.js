import express from 'express';
import {
  requestOtpHandler,
  verifyOtpHandler,
  logoutHandler,
  getMeHandler,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * Public Authentication Routes
 */
router.post('/request-otp', requestOtpHandler);
router.post('/verify-otp', verifyOtpHandler);
router.post('/logout', logoutHandler);

/**
 * Protected Identity Route
 */
router.get('/me', requireAuth, getMeHandler);

export default router;
