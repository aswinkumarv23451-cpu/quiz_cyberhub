import express from 'express';
import {
  getActiveEventController,
  submitRegistrationController,
} from '../controllers/registration.controller.js';
import { uploadPaymentProof } from '../middleware/upload.middleware.js';
import { rateLimitRegistration } from '../middleware/rateLimit.middleware.js';

const router = express.Router();

/**
 * Public Registration Routes
 */
router.get('/event', getActiveEventController);

router.post(
  '/',
  rateLimitRegistration,
  uploadPaymentProof.single('paymentProof'),
  submitRegistrationController
);

export default router;
