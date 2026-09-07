import { apiClient } from './apiClient.js';

/**
 * Retrieves all questions for the active competition event.
 * Sorted by question_order ASC. Includes correct_option.
 *
 * @returns {Promise<{ success: boolean, event: Object, questions: Array }>}
 */
export const getQuestions = async () => {
  return await apiClient('/api/admin/questions');
};

/**
 * Creates a new question in the active event.
 * Allowed ONLY when event.status = READY.
 *
 * @param {Object} data
 * @param {string} data.questionText
 * @param {string} data.optionA
 * @param {string} data.optionB
 * @param {string} data.optionC
 * @param {string} data.optionD
 * @param {string} data.correctOption - 'A' | 'B' | 'C' | 'D'
 * @param {number} [data.timeLimitSeconds=30]
 * @param {number} [data.questionOrder]
 * @returns {Promise<{ success: boolean, message: string, question: Object }>}
 */
export const createQuestion = async (data) => {
  return await apiClient('/api/admin/questions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/**
 * Updates an existing question.
 * Allowed ONLY when event.status = READY.
 *
 * @param {string} questionId
 * @param {Object} data
 * @returns {Promise<{ success: boolean, message: string, question: Object }>}
 */
export const updateQuestion = async (questionId, data) => {
  return await apiClient(`/api/admin/questions/${questionId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

/**
 * Deletes a question and auto-compacts sequential orders.
 * Allowed ONLY when event.status = READY.
 *
 * @param {string} questionId
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const deleteQuestion = async (questionId) => {
  return await apiClient(`/api/admin/questions/${questionId}`, {
    method: 'DELETE',
  });
};

/**
 * Reorders the complete question set atomically.
 * Allowed ONLY when event.status = READY.
 *
 * @param {Array<string>} questionIds - Array of question UUIDs in new sequential order
 * @returns {Promise<{ success: boolean, message: string, totalReordered: number }>}
 */
export const reorderQuestions = async (questionIds) => {
  return await apiClient('/api/admin/questions/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ questionIds }),
  });
};

/**
 * Validates the question bank for competition readiness.
 * Does NOT start the competition.
 *
 * @returns {Promise<{ success: boolean, valid: boolean, questionCount: number, errors: Array<string> }>}
 */
export const validateQuestions = async () => {
  return await apiClient('/api/admin/questions/validate', {
    method: 'POST',
  });
};
