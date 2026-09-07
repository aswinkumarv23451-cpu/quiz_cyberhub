import { useState, useEffect, useCallback, useRef } from 'react';
import {
  startQuiz,
  getCurrentQuiz,
  submitAnswer,
  skipQuestion,
} from '../services/quizService';

export default function QuizInterface({ session, onLogout }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notStarted, setNotStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [quizState, setQuizState] = useState(null); // { attemptId, question, deadline }
  const [selectedOption, setSelectedOption] = useState(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [completionMessage, setCompletionMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);

  const timerRef = useRef(null);

  // 1. Check current quiz state on mount (refresh / recovery)
  const initQuizState = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const res = await getCurrentQuiz();

      if (res.notStarted) {
        setNotStarted(true);
        return;
      }

      if (res.ended) {
        setEnded(true);
        return;
      }

      if (res.completed) {
        setCompleted(true);
        setCompletionMessage(res.message || 'The round 1 is successfully finished and the results will be announced in the WhatsApp group.');
        return;
      }

      if (res.question) {
        // Active attempt restored
        setQuizState(res);
        setSelectedOption(null);
      } else if (!res.hasAttempt) {
        // No attempt started yet. Event is LIVE. Show rules before start.
        setShowRulesModal(true);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to initialize quiz state.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initQuizState();
  }, [initQuizState]);

  // 2. Authoritative Deadline Visual Countdown Timer
  useEffect(() => {
    if (!quizState?.deadline || completed) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const updateTimer = () => {
      const deadlineTime = new Date(quizState.deadline).getTime();
      const now = Date.now();
      const diffSeconds = Math.max(0, Math.ceil((deadlineTime - now) / 1000));
      setSecondsRemaining(diffSeconds);

      // When visual timer hits zero, trigger timeout check with server
      if (diffSeconds <= 0 && !submitting) {
        handleTimeoutTrigger();
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [quizState?.deadline, completed, submitting]);

  // Automatically fetch next question when visual countdown expires
  const handleTimeoutTrigger = async () => {
    try {
      setSubmitting(true);
      const res = await getCurrentQuiz();
      if (res.completed) {
        setCompleted(true);
        setCompletionMessage(res.message || 'The round 1 is successfully finished and the results will be announced in the WhatsApp group.');
        setQuizState(null);
      } else if (res.question) {
        setQuizState(res);
        setSelectedOption(null);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error updating question after timeout.');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Start Quiz Handler (User confirms rules)
  const handleStartQuiz = async () => {
    try {
      setSubmitting(true);
      setErrorMessage(null);
      const res = await startQuiz();

      if (res.notStarted) {
        setNotStarted(true);
        setShowRulesModal(false);
        return;
      }

      if (res.completed) {
        setCompleted(true);
        setCompletionMessage(res.message || 'The round 1 is successfully finished and the results will be announced in the WhatsApp group.');
        setShowRulesModal(false);
        return;
      }

      if (res.question) {
        setQuizState(res);
        setSelectedOption(null);
        setShowRulesModal(false);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to start Round 1.');
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Submit Answer Handler
  const handleSubmitAnswer = async () => {
    if (!selectedOption || submitting) return;

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const res = await submitAnswer(selectedOption, quizState?.question?.id);

      if (res.completed) {
        setCompleted(true);
        setCompletionMessage(res.message || 'The round 1 is successfully finished and the results will be announced in the WhatsApp group.');
        setQuizState(null);
      } else if (res.question) {
        setQuizState(res);
        setSelectedOption(null);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to submit answer.');
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Skip Question Handler
  const handleSkipQuestion = async () => {
    if (submitting) return;

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const res = await skipQuestion();

      if (res.completed) {
        setCompleted(true);
        setCompletionMessage(res.message || 'The round 1 is successfully finished and the results will be announced in the WhatsApp group.');
        setQuizState(null);
      } else if (res.question) {
        setQuizState(res);
        setSelectedOption(null);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to skip question.');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading Screen
  if (loading) {
    return (
      <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mb-3"></div>
        <p className="text-sm">Connecting to Round 1 Quiz Engine...</p>
      </div>
    );
  }

  // Event READY Screen: "Round 1 has not started yet. Please wait for the organizer."
  if (notStarted) {
    return (
      <div className="max-w-xl w-full bg-slate-900 border border-amber-900/60 rounded-xl p-8 text-center space-y-4">
        <div className="w-14 h-14 bg-amber-950/80 border border-amber-800 text-amber-400 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
          ⏳
        </div>
        <h2 className="text-xl font-bold text-slate-100">Round 1 Waiting Area</h2>
        <p className="text-sm text-amber-300 font-medium">
          Round 1 has not started yet. Please wait for the organizer.
        </p>
        <p className="text-xs text-slate-400">
          The quiz will become accessible immediately once the administrator starts the round.
        </p>
        <div className="pt-4 border-t border-slate-800 flex justify-center gap-3">
          <button
            onClick={initQuizState}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-md transition"
          >
            Check Status Again
          </button>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-md transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Event ENDED Screen (No active completed attempt)
  if (ended && !completed) {
    return (
      <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-4">
        <div className="w-14 h-14 bg-rose-950/80 border border-rose-800 text-rose-400 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
          🛑
        </div>
        <h2 className="text-xl font-bold text-slate-100">Round 1 Ended</h2>
        <p className="text-sm text-slate-300">
          Round 1 has ended. Quiz participation is closed.
        </p>
        <button
          onClick={onLogout}
          className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-md transition"
        >
          Sign Out
        </button>
      </div>
    );
  }

  // Completion Screen
  if (completed) {
    return (
      <div className="max-w-xl w-full bg-slate-900 border border-emerald-900/60 rounded-xl p-8 text-center space-y-5">
        <div className="w-16 h-16 bg-emerald-950/80 border border-emerald-800 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-3xl">
          ✓
        </div>
        <h2 className="text-2xl font-bold text-slate-100">Quiz Completed</h2>
        <p className="text-base text-emerald-300 font-medium px-4">
          {completionMessage || 'The round 1 is successfully finished and the results will be announced in the WhatsApp group.'}
        </p>
        <p className="text-xs text-slate-400">
          Thank you for participating! Further updates will be shared by event coordinators.
        </p>
        <div className="pt-4 border-t border-slate-800">
          <button
            onClick={onLogout}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-md transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Scoring Rules Modal (Before starting Round 1)
  if (showRulesModal) {
    return (
      <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-xl p-6 md:p-8 space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
            Round 1 Competition
          </span>
          <h2 className="text-xl font-bold text-slate-100 mt-1">Quiz Instructions & Rules</h2>
          <p className="text-xs text-slate-400 mt-1">
            Team: <span className="text-slate-200 font-medium">{session?.team?.name || 'Your Team'}</span>
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded text-xs">
            {errorMessage}
          </div>
        )}

        {/* Scoring Breakdown */}
        <div className="space-y-3 bg-slate-950/70 p-4 rounded-lg border border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Scoring Structure
          </h3>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded">
              <span className="block text-emerald-400 font-bold text-lg">+10</span>
              <span className="text-slate-300">Correct</span>
            </div>
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded">
              <span className="block text-rose-400 font-bold text-lg">-5</span>
              <span className="text-slate-300">Wrong</span>
            </div>
            <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded">
              <span className="block text-amber-400 font-bold text-lg">-10</span>
              <span className="text-slate-300">Skip / Timeout</span>
            </div>
          </div>
        </div>

        {/* Guidelines */}
        <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
          <li>Each question has a server-authoritative time limit.</li>
          <li>Questions must be answered sequentially; no jumping or returning to previous questions.</li>
          <li>If the timer expires before you submit, the question is automatically skipped (-10).</li>
          <li>Exactly one quiz attempt is allowed per team.</li>
        </ul>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleStartQuiz}
            disabled={submitting}
            className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm rounded-lg transition shadow-lg shadow-indigo-900/30"
          >
            {submitting ? 'Starting Quiz...' : 'Start Round 1'}
          </button>
          <button
            onClick={onLogout}
            disabled={submitting}
            className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-lg transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Active Quiz View
  const currentQuestion = quizState?.question;
  const options = currentQuestion?.options || {};

  return (
    <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-xl p-6 md:p-8 space-y-6 shadow-2xl">
      {/* Header with Question Progress & Timer */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Question {currentQuestion?.questionNumber} of {currentQuestion?.totalQuestions}
          </span>
          <h2 className="text-sm font-bold text-indigo-300">Round 1 Technology Quiz</h2>
        </div>

        {/* Authoritative Timer Badge */}
        <div
          className={`px-3 py-1.5 rounded-full border text-xs font-mono font-bold flex items-center gap-1.5 ${
            secondsRemaining <= 5
              ? 'bg-rose-950/80 border-rose-700 text-rose-300 animate-pulse'
              : secondsRemaining <= 10
              ? 'bg-amber-950/80 border-amber-700 text-amber-300'
              : 'bg-slate-950 border-slate-700 text-emerald-400'
          }`}
        >
          <span>⏱</span>
          <span>{secondsRemaining}s</span>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded text-xs">
          {errorMessage}
        </div>
      )}

      {/* Question Text */}
      <div className="py-2">
        <p className="text-base font-semibold text-slate-100 leading-relaxed whitespace-pre-wrap">
          {currentQuestion?.questionText}
        </p>
      </div>

      {/* Options A, B, C, D */}
      <div className="space-y-3">
        {['A', 'B', 'C', 'D'].map((key) => {
          const optionText = options[key];
          const isSelected = selectedOption === key;

          return (
            <button
              key={key}
              type="button"
              disabled={submitting}
              onClick={() => setSelectedOption(key)}
              className={`w-full text-left p-3.5 rounded-lg border transition flex items-center gap-3 text-sm ${
                isSelected
                  ? 'bg-indigo-600/20 border-indigo-500 text-white font-medium shadow-md shadow-indigo-950/50'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-400 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                {key}
              </span>
              <span className="flex-1">{optionText}</span>
            </button>
          );
        })}
      </div>

      {/* Action Buttons: Skip & Submit */}
      <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
        <button
          type="button"
          onClick={handleSkipQuestion}
          disabled={submitting}
          className="py-2.5 px-4 bg-slate-800 hover:bg-slate-750 disabled:opacity-50 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition"
        >
          {submitting ? 'Skipping...' : 'Skip (-10)'}
        </button>

        <button
          type="button"
          onClick={handleSubmitAnswer}
          disabled={!selectedOption || submitting}
          className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition shadow-lg shadow-indigo-950/40"
        >
          {submitting ? 'Submitting...' : 'Submit Answer'}
        </button>
      </div>
    </div>
  );
}
