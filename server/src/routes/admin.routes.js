import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';
import {
  listRegistrationsController,
  getRegistrationStatsController,
  getRegistrationDetailController,
  downloadPaymentProofController,
  approveRegistrationController,
  rejectRegistrationController,
} from '../controllers/admin.registration.controller.js';
import {
  listQuestionsController,
  createQuestionController,
  updateQuestionController,
  deleteQuestionController,
  reorderQuestionsController,
  validateQuestionBankController,
} from '../controllers/admin.question.controller.js';
import {
  handleStartEventAdmin,
  handleEndEventAdmin,
} from '../controllers/quiz.controller.js';
import { getLeaderboardController } from '../controllers/admin.leaderboard.controller.js';
import {
  getMonitoringOverviewController,
  getTeamMonitoringDetailController,
} from '../controllers/admin.monitoring.controller.js';

const router = express.Router();

/**
 * Admin Routes (Registration & Question Management)
 *
 * ALL routes require: requireAuth + requireAdmin
 * - Unauthenticated → 401
 * - Non-admin (Team Lead, Member) → 403
 */
router.use(requireAuth, requireAdmin);

// Event Lifecycle Routes (Module 7)
router.post('/event/start', handleStartEventAdmin);
router.post('/event/end', handleEndEventAdmin);

// Leaderboard Routes (Module 8)
router.get('/leaderboard', getLeaderboardController);

// Operational Monitoring Routes (Module 9)
router.get('/monitoring', getMonitoringOverviewController);
router.get('/monitoring/team/:teamId', getTeamMonitoringDetailController);

// Registration Management Routes
router.get('/registrations', listRegistrationsController);
router.get('/registrations/stats', getRegistrationStatsController);
router.get('/registrations/:teamId', getRegistrationDetailController);
router.get('/registrations/:teamId/proof', downloadPaymentProofController);
router.post('/registrations/:teamId/approve', approveRegistrationController);
router.post('/registrations/:teamId/reject', rejectRegistrationController);

// Question Management Routes (Module 6)
router.get('/questions', listQuestionsController);
router.post('/questions', createQuestionController);
router.patch('/questions/reorder', reorderQuestionsController);
router.post('/questions/validate', validateQuestionBankController);
router.patch('/questions/:questionId', updateQuestionController);
router.delete('/questions/:questionId', deleteQuestionController);

export default router;
