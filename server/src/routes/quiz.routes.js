import { Router } from 'express';
import { requireAuth, requireTeamLead } from '../middleware/auth.middleware.js';
import { rateLimitQuiz } from '../middleware/rateLimit.middleware.js';
import {
  handleStartQuiz,
  handleGetCurrentQuiz,
  handleSubmitAnswer,
  handleSkipQuestion,
} from '../controllers/quiz.controller.js';

const router = Router();

// All participant quiz routes require an authenticated session and verified TEAM_LEAD role
router.use(requireAuth, requireTeamLead);

// POST /api/quiz/start
router.post('/start', handleStartQuiz);

// GET /api/quiz/current
router.get('/current', handleGetCurrentQuiz);

// POST /api/quiz/answer
// Hardened with quiz submission rate limiting (300 req/min/IP) to support concurrent teams on shared IP
router.post('/answer', rateLimitQuiz, handleSubmitAnswer);

// POST /api/quiz/skip
router.post('/skip', rateLimitQuiz, handleSkipQuestion);

export default router;
