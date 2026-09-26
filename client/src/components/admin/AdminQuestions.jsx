import { useState, useEffect, useCallback } from 'react';
import {
  getQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  validateQuestions,
} from '../../services/questionService';
import AdminConfirmDialog from './AdminConfirmDialog';

/**
 * AdminQuestions — Question management component.
 * Allows viewing, creating, editing, deleting, and reordering questions.
 * Enforces READY-only mutations and locks when LIVE/ENDED.
 * Strictly adheres to schema: Question text, Options A-D, Correct option, Timer seconds (NO category field).
 */
export default function AdminQuestions() {
  const [questions, setQuestions] = useState([]);
  const [eventInfo, setEventInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Modal State (Add / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [formData, setFormData] = useState({
    questionText: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctOption: 'A',
    timeLimitSeconds: 30,
  });

  // Delete Confirmation Dialog
  const [deleteDialog, setDeleteDialog] = useState({
    isOpen: false,
    questionId: null,
    questionOrder: null,
  });

  // Validation Result Modal State
  const [validationResult, setValidationResult] = useState(null);

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getQuestions();
      if (res?.success) {
        setQuestions(res.questions || []);
        setEventInfo(res.event || null);
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message || 'Failed to fetch question bank.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const isLocked =
    eventInfo?.isLocked || eventInfo?.status === 'LIVE' || eventInfo?.status === 'ENDED';

  // Open Modal for Add
  const handleOpenAdd = () => {
    if (isLocked) return;
    setEditingQuestion(null);
    setFormData({
      questionText: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctOption: 'A',
      timeLimitSeconds: 30,
    });
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (q) => {
    if (isLocked) return;
    setEditingQuestion(q);
    setFormData({
      questionText: q.questionText || '',
      optionA: q.optionA || '',
      optionB: q.optionB || '',
      optionC: q.optionC || '',
      optionD: q.optionD || '',
      correctOption: q.correctOption || 'A',
      timeLimitSeconds: q.timeLimitSeconds || 30,
    });
    setIsModalOpen(true);
  };

  // Submit Add / Edit Form
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (isLocked) return;

    setActionLoading(true);
    setMessage(null);

    try {
      if (editingQuestion) {
        await updateQuestion(editingQuestion.id, formData);
        setMessage({ type: 'success', text: 'Question updated successfully.' });
      } else {
        await createQuestion(formData);
        setMessage({ type: 'success', text: 'Question created successfully.' });
      }
      setIsModalOpen(false);
      await loadQuestions();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message || 'Failed to save question.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Question
  const handleConfirmDelete = async () => {
    if (isLocked || !deleteDialog.questionId) return;

    setActionLoading(true);
    setMessage(null);

    try {
      await deleteQuestion(deleteDialog.questionId);
      setMessage({ type: 'success', text: 'Question deleted successfully.' });
      setDeleteDialog({ isOpen: false, questionId: null, questionOrder: null });
      await loadQuestions();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message || 'Failed to delete question.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Reorder Question (Move Up / Down)
  const handleMove = async (index, direction) => {
    if (isLocked || actionLoading) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const reordered = [...questions];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    // Optimistic local update
    setQuestions(reordered);
    setActionLoading(true);

    try {
      const questionIds = reordered.map((q) => q.id);
      await reorderQuestions(questionIds);
      setMessage({ type: 'success', text: 'Question order updated.' });
      await loadQuestions();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message || 'Failed to reorder questions.',
      });
      await loadQuestions();
    } finally {
      setActionLoading(false);
    }
  };

  // Validate Questions
  const handleValidateBank = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await validateQuestions();
      setValidationResult(res);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message || 'Question bank validation check failed.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0F172A] border border-slate-800 p-5 rounded-2xl shadow-lg">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <span>📝</span> Question Bank Management
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Author authoritative Round 1 competition questions, configure timers, and verify sequential ordering.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleValidateBank}
            disabled={actionLoading || loading}
            className="px-3.5 py-2 text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-950/50 hover:bg-indigo-900/60 disabled:opacity-50 border border-indigo-800/60 rounded-xl transition flex items-center gap-1.5 shadow-xs"
          >
            <span>🔍</span> Validate Bank
          </button>
          <button
            type="button"
            disabled={isLocked || actionLoading || loading}
            onClick={handleOpenAdd}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition shadow-sm flex items-center gap-1.5"
          >
            <span>+</span> Add Question
          </button>
        </div>
      </div>

      {/* Lock Notice Banner (when LIVE or ENDED) */}
      {isLocked && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs sm:text-sm flex items-center gap-3 shadow-md">
          <span className="text-lg">🔒</span>
          <div>
            <strong>Questions are locked while the round is LIVE/ENDED.</strong>
            <p className="text-amber-300/80 text-xs mt-0.5">
              Question additions, modifications, deletions, and reordering are restricted to preserve competition integrity.
            </p>
          </div>
        </div>
      )}

      {/* Action Notification */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs sm:text-sm border flex items-center justify-between shadow-md ${
            message.type === 'success'
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
              : 'bg-rose-950/60 text-rose-300 border-rose-800/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{message.type === 'success' ? '✓' : '⚠️'}</span>
            <span>{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-xs font-bold underline hover:opacity-80 ml-4 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-slate-400 bg-[#0F172A] border border-slate-800 rounded-2xl flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading question bank…</span>
          </div>
        ) : questions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-[#0F172A] border border-slate-800 rounded-2xl space-y-3">
            <div className="text-3xl">📭</div>
            <h3 className="text-sm font-bold text-slate-200">No questions found in this event</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Click &quot;Add Question&quot; above to create the first question for Round 1.
            </p>
          </div>
        ) : (
          questions.map((q, idx) => (
            <div
              key={q.id}
              className="bg-[#0F172A] border border-slate-800/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm hover:border-slate-750 transition"
            >
              {/* Question Header: Order, Text & Controls */}
              <div className="flex flex-col sm:flex-row items-start justify-between gap-3 border-b border-slate-800/80 pb-3.5">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                    #{q.questionOrder || idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm sm:text-base font-semibold text-slate-100 whitespace-pre-wrap break-words leading-relaxed">
                      {q.questionText}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400">
                        ⏱️ {q.timeLimitSeconds || 30}s timer
                      </span>
                    </div>
                  </div>
                </div>

                {/* Question Actions */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-start">
                  {/* Reorder Up */}
                  <button
                    type="button"
                    disabled={isLocked || idx === 0 || actionLoading}
                    onClick={() => handleMove(idx, -1)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 text-xs transition"
                    title="Move Question Up"
                  >
                    ▲
                  </button>
                  {/* Reorder Down */}
                  <button
                    type="button"
                    disabled={isLocked || idx === questions.length - 1 || actionLoading}
                    onClick={() => handleMove(idx, 1)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 text-xs transition"
                    title="Move Question Down"
                  >
                    ▼
                  </button>
                  {/* Edit */}
                  <button
                    type="button"
                    disabled={isLocked || actionLoading}
                    onClick={() => handleOpenEdit(q)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold transition"
                  >
                    Edit
                  </button>
                  {/* Delete */}
                  <button
                    type="button"
                    disabled={isLocked || actionLoading}
                    onClick={() =>
                      setDeleteDialog({
                        isOpen: true,
                        questionId: q.id,
                        questionOrder: q.questionOrder || idx + 1,
                      })
                    }
                    className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 disabled:opacity-40 text-rose-300 border border-rose-800/50 text-xs font-semibold transition"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* 2x2 Options Grid with Highlighted Correct Answer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {['A', 'B', 'C', 'D'].map((optKey) => {
                  const optText = q[`option${optKey}`];
                  const isCorrect = q.correctOption === optKey;
                  return (
                    <div
                      key={optKey}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                        isCorrect
                          ? 'bg-emerald-950/30 border-emerald-700/60 text-emerald-200'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-6 h-6 rounded flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                            isCorrect
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {optKey}
                        </span>
                        <span className="truncate">{optText}</span>
                      </div>
                      {isCorrect && (
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800/60 shrink-0">
                          CORRECT
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Question Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base sm:text-lg font-bold text-slate-100">
                {editingQuestion ? 'Edit Question' : 'Add New Question'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs sm:text-sm">
              {/* Question Text */}
              <div className="space-y-1">
                <label className="block font-semibold text-slate-300">
                  Question Text <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.questionText}
                  onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
                  placeholder="Enter the question text…"
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 text-xs sm:text-sm leading-relaxed"
                />
              </div>

              {/* Options A - D */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {['A', 'B', 'C', 'D'].map((key) => (
                  <div key={key} className="space-y-1">
                    <label className="block font-semibold text-slate-300">
                      Option {key} <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData[`option${key}`]}
                      onChange={(e) =>
                        setFormData({ ...formData, [`option${key}`]: e.target.value })
                      }
                      placeholder={`Option ${key} text`}
                      className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 text-xs"
                    />
                  </div>
                ))}
              </div>

              {/* Correct Option & Timer Seconds */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-300">
                    Correct Option <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.correctOption}
                    onChange={(e) => setFormData({ ...formData, correctOption: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 text-xs font-semibold font-mono"
                  >
                    <option value="A">Option A</option>
                    <option value="B">Option B</option>
                    <option value="C">Option C</option>
                    <option value="D">Option D</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-300">
                    Timer Limit (Seconds) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={300}
                    required
                    value={formData.timeLimitSeconds}
                    onChange={(e) =>
                      setFormData({ ...formData, timeLimitSeconds: parseInt(e.target.value) || 30 })
                    }
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs"
                >
                  {actionLoading ? 'Saving…' : editingQuestion ? 'Update Question' : 'Create Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AdminConfirmDialog
        isOpen={deleteDialog.isOpen}
        title={`Delete Question #${deleteDialog.questionOrder}?`}
        message="Are you sure you want to permanently delete this question? Subsequent questions will automatically be re-sequenced."
        confirmText="Yes, Delete Question"
        isDanger={true}
        loading={actionLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialog({ isOpen: false, questionId: null, questionOrder: null })}
      />

      {/* Validation Result Modal */}
      {validationResult && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>{validationResult.valid ? '✅' : '⚠️'}</span> Question Bank Validation
              </h3>
              <button
                type="button"
                onClick={() => setValidationResult(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-400">
                <span>Total Questions:</span>
                <span className="font-bold text-slate-200">{validationResult.questionCount}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-400">
                <span>Bank Status:</span>
                <span
                  className={`font-bold ${
                    validationResult.valid ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {validationResult.valid ? 'READY FOR COMPETITION' : 'INVALID / INCOMPLETE'}
                </span>
              </div>
              {validationResult.errors?.length > 0 && (
                <div className="space-y-1 pt-2">
                  <span className="font-bold text-rose-400 block">Issues Detected:</span>
                  <ul className="list-disc list-inside text-rose-300 space-y-1">
                    {validationResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setValidationResult(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
