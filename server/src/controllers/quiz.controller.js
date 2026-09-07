import {
  startQuizAttempt,
  getCurrentQuizState,
  submitQuizAnswer,
  skipQuizQuestion,
  startEventAdmin,
  endEventAdmin,
} from '../services/quiz.service.js';

/**
 * Controller: Starts or resumes Round 1 quiz attempt for authenticated Team Lead.
 * POST /api/quiz/start
 */
export const handleStartQuiz = async (req, res, next) => {
  try {
    const result = await startQuizAttempt(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Retrieves current question and server-authoritative deadline.
 * GET /api/quiz/current
 */
export const handleGetCurrentQuiz = async (req, res, next) => {
  try {
    const result = await getCurrentQuizState(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Submits answer for the active question.
 * POST /api/quiz/answer
 */
export const handleSubmitAnswer = async (req, res, next) => {
  try {
    const { selectedOption, questionId } = req.body || {};
    const result = await submitQuizAnswer(req.user.id, { selectedOption, questionId });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Skips the active question.
 * POST /api/quiz/skip
 */
export const handleSkipQuestion = async (req, res, next) => {
  try {
    const result = await skipQuizQuestion(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Admin starts Round 1.
 * POST /api/admin/event/start
 */
export const handleStartEventAdmin = async (req, res, next) => {
  try {
    const result = await startEventAdmin();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Admin ends Round 1.
 * POST /api/admin/event/end
 */
export const handleEndEventAdmin = async (req, res, next) => {
  try {
    const result = await endEventAdmin();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
