import express from 'express';
import multer from 'multer';
import {
  getActiveEventController,
  submitRegistrationController,
} from '../controllers/registration.controller.js';
import { rateLimitRegistration } from '../middleware/rateLimit.middleware.js';

const router = express.Router();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

/**
 * Public Registration Routes
 */
router.get('/event', getActiveEventController);

router.post(
  '/',
  rateLimitRegistration,
  (req, res, next) => {
    if (req.is('multipart/form-data')) {
      return upload.any()(req, res, next);
    }
    next();
  },
  submitRegistrationController
);

export default router;
