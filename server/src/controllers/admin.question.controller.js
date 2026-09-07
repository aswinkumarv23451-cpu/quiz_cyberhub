import {
  getQuestionsForAdmin,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  validateQuestionBank,
} from '../services/admin.question.service.js';

/**
 * GET /api/admin/questions
 * Returns all questions for the active event sorted by question_order ASC.
 * Includes correct_option (authorized for Admin).
 */
export const listQuestionsController = async (req, res, next) => {
  try {
    const result = await getQuestionsForAdmin();
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/questions
 * Creates a new question in the active event.
 * Allowed ONLY when event.status = READY.
 */
export const createQuestionController = async (req, res, next) => {
  try {
    const result = await createQuestion(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/questions/:questionId
 * Updates text, options, correct option, timer, or order of an existing question.
 * Allowed ONLY when event.status = READY.
 */
export const updateQuestionController = async (req, res, next) => {
  try {
    const result = await updateQuestion(req.params.questionId, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/questions/:questionId
 * Deletes a question and compacts sequential order.
 * Allowed ONLY when event.status = READY.
 */
export const deleteQuestionController = async (req, res, next) => {
  try {
    const result = await deleteQuestion(req.params.questionId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/questions/reorder
 * Reorders the complete question set atomically.
 * Allowed ONLY when event.status = READY.
 */
export const reorderQuestionsController = async (req, res, next) => {
  try {
    const { questionIds } = req.body || {};
    const result = await reorderQuestions(questionIds);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/questions/validate
 * Validates the question bank for competition readiness.
 * Does NOT start the competition.
 */
export const validateQuestionBankController = async (req, res, next) => {
  try {
    const result = await validateQuestionBank();
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
