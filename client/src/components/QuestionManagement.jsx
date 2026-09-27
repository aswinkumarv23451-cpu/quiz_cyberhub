import { useState, useEffect, useCallback } from 'react';
import {
  getQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  validateQuestions,
} from '../services/questionService';

export default function QuestionManagement() {
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

  // Validation Result Modal State
  const [validationResult, setValidationResult] = useState(null);

  // Fetch Questions
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

  const isLocked = eventInfo?.isLocked || eventInfo?.status === 'LIVE' || eventInfo?.status === 'ENDED';

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
  const handleOpenEdit = (question) => {
    if (isLocked) return;
    setEditingQuestion(question);
    setFormData({
      questionText: question.questionText || '',
      optionA: question.optionA || '',
      optionB: question.optionB || '',
      optionC: question.optionC || '',
      optionD: question.optionD || '',
      correctOption: question.correctOption || 'A',
      timeLimitSeconds: question.timeLimitSeconds || 30,
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
        const res = await updateQuestion(editingQuestion.id, formData);
        setMessage({ type: 'success', text: res.message || 'Question updated successfully.' });
      } else {
        const res = await createQuestion(formData);
        setMessage({ type: 'success', text: res.message || 'Question added successfully.' });
      }
      setIsModalOpen(false);
      await loadQuestions();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message || 'Failed to save question. Please verify input fields.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Question
  const handleDelete = async (questionId) => {
    if (isLocked) return;
    if (!window.confirm('Are you sure you want to delete this question? Subsequent question orders will be automatically compacted.')) {
      return;
    }

    setActionLoading(true);
    setMessage(null);

    try {
      const res = await deleteQuestion(questionId);
      setMessage({ type: 'success', text: res.message || 'Question deleted.' });
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

  // Move Question Up / Down
  const handleMoveOrder = async (currentIndex, direction) => {
    if (isLocked) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    // Swap IDs in array
    const updatedIds = questions.map((q) => q.id);
    const temp = updatedIds[currentIndex];
    updatedIds[currentIndex] = updatedIds[targetIndex];
    updatedIds[targetIndex] = temp;

    setActionLoading(true);
    setMessage(null);

    try {
      await reorderQuestions(updatedIds);
      setMessage({ type: 'success', text: 'Question order updated.' });
      await loadQuestions();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message || 'Failed to reorder questions.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Validate Question Bank
  const handleValidate = async () => {
    setActionLoading(true);
    try {
      const res = await validateQuestions();
      setValidationResult(res);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message || 'Validation request failed.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Event Lifecycle & Status Banner */}
      {isLocked && (
        <div className="bg-amber-950/40 border border-amber-800/60 p-4 rounded-xl flex items-center justify-between gap-3 text-amber-300">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔒</span>
            <div>
              <div className="text-sm font-semibold">
                Questions are locked because Cryptic Tide is {eventInfo?.status}.
              </div>
              <div className="text-xs text-amber-400/80 mt-0.5">
                Question authoring, editing, deletion, and reordering are strictly disabled while the competition is active or concluded.
              </div>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded text-xs font-mono font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
            {eventInfo?.status}
          </span>
        </div>
      )}

      {/* Action Notification Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl text-sm border flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60'
              : 'bg-rose-950/50 text-rose-300 border-rose-800/60'
          }`}
        >
          <span>{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-xs underline hover:opacity-80 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Control Header */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 sm:p-5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-lg font-bold text-slate-100">Cryptic Tide Question Bank</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
              {questions.length} {questions.length === 1 ? 'Question' : 'Questions'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage question prompts, choices, correct keys, per-question timers, and presentation order.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            disabled={actionLoading || loading}
            onClick={handleValidate}
            className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition flex items-center justify-center gap-1.5"
          >
            <span>✓</span> Validate Bank
          </button>
          <button
            type="button"
            disabled={isLocked || actionLoading || loading}
            onClick={handleOpenAdd}
            className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm"
          >
            <span>+</span> Add Question
          </button>
        </div>
      </div>

      {/* Questions List */}
      {loading ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center text-slate-400 text-sm">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          Loading question bank...
        </div>
      ) : questions.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center text-slate-500 text-sm space-y-3">
          <div className="text-3xl">📝</div>
          <div className="text-slate-300 font-semibold">No questions created yet</div>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Get started by adding your first multiple-choice question for the Cryptic Tide competition.
          </p>
          {!isLocked && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition"
            >
              + Add First Question
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <div
              key={q.id}
              className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-4 sm:p-5 transition hover:border-slate-700 space-y-4 shadow-sm"
            >
              {/* Question Header & Action Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-xs font-mono">
                    #{q.questionOrder}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Timer: <span className="text-slate-200 font-semibold">{q.timeLimitSeconds}s</span>
                  </span>
                </div>

                {/* Reorder and Mutation Controls */}
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    type="button"
                    title="Move Up"
                    disabled={isLocked || idx === 0 || actionLoading}
                    onClick={() => handleMoveOrder(idx, 'up')}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-750 disabled:opacity-30 text-slate-300 text-xs transition border border-slate-700"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    title="Move Down"
                    disabled={isLocked || idx === questions.length - 1 || actionLoading}
                    onClick={() => handleMoveOrder(idx, 'down')}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-750 disabled:opacity-30 text-slate-300 text-xs transition border border-slate-700"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    disabled={isLocked || actionLoading}
                    onClick={() => handleOpenEdit(q)}
                    className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-750 disabled:opacity-30 text-slate-200 text-xs font-medium transition border border-slate-700 ml-1"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={isLocked || actionLoading}
                    onClick={() => handleDelete(q.id)}
                    className="px-3 py-1.5 rounded bg-rose-950/40 hover:bg-rose-900/50 disabled:opacity-30 text-rose-300 text-xs font-medium transition border border-rose-800/40"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <div className="text-slate-200 text-sm font-medium leading-relaxed">
                {q.questionText}
              </div>

              {/* Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  { key: 'A', text: q.optionA },
                  { key: 'B', text: q.optionB },
                  { key: 'C', text: q.optionC },
                  { key: 'D', text: q.optionD },
                ].map((opt) => {
                  const isCorrect = q.correctOption === opt.key;
                  return (
                    <div
                      key={opt.key}
                      className={`p-2.5 rounded-lg border flex items-start gap-2.5 ${
                        isCorrect
                          ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 font-medium'
                          : 'bg-slate-950/40 border-slate-800/80 text-slate-300'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[11px] shrink-0 ${
                          isCorrect
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {opt.key}
                      </span>
                      <span className="flex-1 break-words">{opt.text}</span>
                      {isCorrect && (
                        <span className="text-[10px] uppercase font-bold text-emerald-400 ml-1">
                          Correct
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Question Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-100">
                {editingQuestion ? `Edit Question #${editingQuestion.questionOrder}` : 'Add New Question'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-750 flex items-center justify-center text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
              {/* Question Text */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Question Prompt <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.questionText}
                  onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
                  placeholder="Enter the competition question..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              {/* Options A-D */}
              <div className="space-y-2.5">
                <span className="block text-slate-300 font-medium">
                  Multiple Choice Options <span className="text-rose-400">*</span>
                </span>
                {['A', 'B', 'C', 'D'].map((opt) => (
                  <div key={opt} className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-slate-800 text-slate-300 flex items-center justify-center font-bold font-mono shrink-0">
                      {opt}
                    </span>
                    <input
                      type="text"
                      required
                      value={formData[`option${opt}`]}
                      onChange={(e) =>
                        setFormData({ ...formData, [`option${opt}`]: e.target.value })
                      }
                      placeholder={`Option ${opt} text`}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs"
                    />
                  </div>
                ))}
              </div>

              {/* Correct Option & Timer Grid */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Correct Option <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.correctOption}
                    onChange={(e) => setFormData({ ...formData, correctOption: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 text-xs"
                  >
                    <option value="A">Option A</option>
                    <option value="B">Option B</option>
                    <option value="C">Option C</option>
                    <option value="D">Option D</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Timer (Seconds: 5 - 600) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={600}
                    required
                    value={formData.timeLimitSeconds}
                    onChange={(e) =>
                      setFormData({ ...formData, timeLimitSeconds: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 text-xs"
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition"
                >
                  {actionLoading ? 'Saving...' : editingQuestion ? 'Update Question' : 'Add Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Validation Result Modal */}
      {validationResult && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {validationResult.valid ? '✅' : '⚠️'}
                </span>
                <h3 className="text-base font-bold text-slate-100">
                  Question Bank Validation Report
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setValidationResult(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-750 flex items-center justify-center text-slate-400 hover:text-slate-200 text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Total Questions Verified:</span>
                <span className="font-semibold text-slate-200">
                  {validationResult.questionCount}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Readiness Status:</span>
                <span
                  className={`font-bold ${
                    validationResult.valid ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {validationResult.valid ? 'READY FOR LIVE' : 'ATTENTION REQUIRED'}
                </span>
              </div>

              {validationResult.valid ? (
                <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-emerald-300">
                  All {validationResult.questionCount} questions have valid prompts, options, answers, timers, and contiguous sequential ordering without gaps.
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="text-rose-400 font-semibold block">Issues Identified:</span>
                  <ul className="space-y-1 text-slate-300 list-disc list-inside bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                    {validationResult.errors?.map((err, i) => (
                      <li key={i} className="text-rose-300/90">{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setValidationResult(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
