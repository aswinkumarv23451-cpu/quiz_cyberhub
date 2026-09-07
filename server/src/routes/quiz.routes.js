import { Router } from 'express';
import { requireAuth, requireTeamLead } from '../middleware/auth.middleware.js';
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
router.post('/answer', handleSubmitAnswer);

// POST /api/quiz/skip
router.post('/skip', handleSkipQuestion);

export default router;
