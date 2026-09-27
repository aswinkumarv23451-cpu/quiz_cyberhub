import { useState, useEffect, useCallback, useRef } from 'react';
import {
  startQuiz,
  getCurrentQuiz,
  submitAnswer,
  skipQuestion,
} from '../../services/quizService';
import WaitingScreen from './WaitingScreen';
import ScoringRulesModal from './ScoringRulesModal';
import QuizScreen from './QuizScreen';
import CompletionScreen from './CompletionScreen';
import NotApprovedScreen from './NotApprovedScreen';

/**
 * ParticipantExperience Component
 *
 * Coordinates the full authoritative Round 1 Participant Experience:
 * 1. Checks server session & role authorization.
 * 2. Unapproved / Member -> NotApprovedScreen.
 * 3. READY state -> WaitingScreen (polls backend, auto-transitions when LIVE).
 * 4. LIVE state (no attempt yet) -> ScoringRulesModal (+10 / -5 / -10).
 * 5. LIVE state (attempt active) -> QuizScreen (server timer, submit, skip).
 * 6. COMPLETED state -> CompletionScreen (NO scores, NO leaderboard, NO answers).
 * 7. Refresh & Reconnect -> Authoritatively restores active question & deadline.
 */
export default function ParticipantExperience({ session, onLogout }) {
  const [loading, setLoading] = useState(true);
  const [manualChecking, setManualChecking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Experience States
  const [isReadyWaiting, setIsReadyWaiting] = useState(false);
  const [showScoringModal, setShowScoringModal] = useState(false);
  const [quizState, setQuizState] = useState(null); // { attemptId, question, deadline }
  const [completed, setCompleted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const pollTimerRef = useRef(null);

  const teamName = session?.team?.name || 'Your Team';

  // 1. Authoritative State Synchronization
  const fetchCurrentState = useCallback(async (isBackgroundPoll = false) => {
    try {
      if (!isBackgroundPoll) {
        setManualChecking(true);
      }
      setErrorMessage(null);

      const res = await getCurrentQuiz();

      // Event is in READY state
      if (res.notStarted) {
        setIsReadyWaiting((prev) => (prev ? prev : true));
        setShowScoringModal((prev) => (prev ? false : prev));
        setQuizState((prev) => (prev !== null ? null : prev));
        setCompleted((prev) => (prev ? false : prev));
        return;
      }

      // Event is in ENDED state (and attempt wasn't completed)
      if (res.ended) {
        setEnded(true);
        setIsReadyWaiting(false);
        setShowScoringModal(false);
        setQuizState(null);
        return;
      }

      // Attempt already completed
      if (res.completed) {
        setCompleted(true);
        setIsReadyWaiting(false);
        setShowScoringModal(false);
        setQuizState(null);
        return;
      }

      // Event is LIVE and active question returned (restored from refresh or timeout)
      if (res.question) {
        setQuizState(res);
        setIsReadyWaiting(false);
        setShowScoringModal(false);
        setCompleted(false);
        return;
      }

      // Event is LIVE but attempt has not started yet
      if (!res.hasAttempt) {
        setIsReadyWaiting(false);
        setShowScoringModal(true);
        setQuizState(null);
        setCompleted(false);
        return;
      }
    } catch (err) {
      if (err.status === 401) {
        // Session expired or invalidated
        onLogout();
        return;
      }
      if (!isBackgroundPoll) {
        setErrorMessage(err.message || 'Failed to sync quiz state with server.');
      }
    } finally {
      if (!isBackgroundPoll) {
        setManualChecking(false);
        setLoading(false);
      }
    }
  }, [onLogout]);

  const handleManualCheckStatus = useCallback(() => {
    fetchCurrentState(false);
  }, [fetchCurrentState]);

  // Initial fetch on mount
  useEffect(() => {
    // Only fetch quiz state if authenticated as approved TEAM_LEAD
    if (session?.role === 'TEAM_LEAD') {
      fetchCurrentState(false);
    } else {
      setLoading(false);
    }
  }, [session?.role, fetchCurrentState]);

  // 2. Event Polling during READY Waiting State
  useEffect(() => {
    if (!isReadyWaiting || session?.role !== 'TEAM_LEAD') {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    // Poll every 4 seconds to detect when organizer starts Round 1 (READY -> LIVE)
    pollTimerRef.current = setInterval(() => {
      fetchCurrentState(true);
    }, 4000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isReadyWaiting, session?.role, fetchCurrentState]);

  // 3. Start Quiz Handler
  const handleStartQuiz = async () => {
    try {
      setStarting(true);
      setErrorMessage(null);

      const res = await startQuiz();

      if (res.notStarted) {
        setIsReadyWaiting(true);
        setShowScoringModal(false);
        return;
      }

      if (res.completed) {
        setCompleted(true);
        setShowScoringModal(false);
        return;
      }

      if (res.question) {
        setQuizState(res);
        setShowScoringModal(false);
      }
    } catch (err) {
      if (err.status === 401) {
        onLogout();
        return;
      }
      setErrorMessage(err.message || 'Failed to start Cryptic Tide.');
    } finally {
      setStarting(false);
    }
  };

  // 4. Submit Answer Handler
  const handleSubmitAnswer = async (selectedOption) => {
    if (!selectedOption || submitting) return;

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const currentQId = quizState?.question?.id;
      const res = await submitAnswer(selectedOption, currentQId);

      if (res.completed) {
        setCompleted(true);
        setQuizState(null);
      } else if (res.question) {
        setQuizState(res);
      }
    } catch (err) {
      if (err.status === 401) {
        onLogout();
        return;
      }
      setErrorMessage(err.message || 'Failed to record answer.');
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
        setQuizState(null);
      } else if (res.question) {
        setQuizState(res);
      }
    } catch (err) {
      if (err.status === 401) {
        onLogout();
        return;
      }
      setErrorMessage(err.message || 'Failed to skip question.');
    } finally {
      setSubmitting(false);
    }
  };

  // 6. Authoritative Server Timeout Synchronization
  const handleTimeoutTrigger = useCallback(async () => {
    if (submitting || completed) return;

    try {
      setSubmitting(true);
      const res = await getCurrentQuiz();

      if (res.completed) {
        setCompleted(true);
        setQuizState(null);
      } else if (res.question) {
        setQuizState(res);
      }
    } catch (err) {
      if (err.status === 401) {
        onLogout();
        return;
      }
      setErrorMessage(err.message || 'Error updating question after timeout.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, completed, onLogout]);

  // Loading Screen
  if (loading) {
    return (
      <div className="w-full max-w-md mx-auto p-8 rounded-2xl bg-charcoal-950/80 border border-gold-800/40 text-center space-y-4 shadow-2xl">
        <div className="animate-spin inline-block w-8 h-8 border-3 border-gold-400 border-t-transparent rounded-full" />
        <p className="text-xs sm:text-sm font-mono text-gold-300 tracking-wider">
          CONNECTING TO CRYPTIC TIDE ENGINE...
        </p>
      </div>
    );
  }

  // A. Registered but not approved (or non-Team Lead role)
  if (session?.role !== 'TEAM_LEAD') {
    return (
      <NotApprovedScreen
        user={session?.user}
        team={session?.team}
        onLogout={onLogout}
      />
    );
  }

  // B. Event in READY state -> Official Waiting Page
  if (isReadyWaiting) {
    return (
      <WaitingScreen
        teamName={teamName}
        onCheckStatus={handleManualCheckStatus}
        onLogout={onLogout}
        isChecking={manualChecking}
      />
    );
  }

  // C. Event ENDED without completed attempt
  if (ended && !completed) {
    return (
      <div className="w-full max-w-lg mx-auto p-8 rounded-2xl bg-charcoal-950 border border-crimson-800/50 text-center space-y-4 shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-crimson-950/80 border border-crimson-700 text-crimson-400 flex items-center justify-center text-3xl mx-auto">
          🛑
        </div>
        <h2 className="text-2xl font-bold font-pirate text-parchment-100">Cryptic Tide Ended</h2>
        <p className="text-sm text-parchment-300">
          Cryptic Tide has concluded. Quiz participation is closed.
        </p>
        <button
          type="button"
          onClick={onLogout}
          className="mt-4 px-6 py-2.5 bg-charcoal-900 hover:bg-charcoal-800 text-parchment-300 hover:text-white text-xs font-semibold rounded-xl border border-bronze-700 transition"
        >
          Sign Out
        </button>
      </div>
    );
  }

  // D. Completed Attempt -> Completion Screen
  if (completed) {
    return <CompletionScreen teamName={teamName} onLogout={onLogout} />;
  }

  // E. Before starting attempt -> Scoring Rules Modal
  if (showScoringModal) {
    return (
      <ScoringRulesModal
        teamName={teamName}
        onStartQuiz={handleStartQuiz}
        onLogout={onLogout}
        starting={starting}
        error={errorMessage}
      />
    );
  }

  // F. Active Quiz Screen
  if (quizState?.question) {
    return (
      <QuizScreen
        teamName={teamName}
        question={quizState.question}
        deadline={quizState.deadline}
        submitting={submitting}
        onSubmitAnswer={handleSubmitAnswer}
        onSkipQuestion={handleSkipQuestion}
        onTimeout={handleTimeoutTrigger}
        errorMessage={errorMessage}
      />
    );
  }

  // Fallback / re-syncing
  return (
    <div className="w-full max-w-md mx-auto p-8 rounded-2xl bg-charcoal-950/80 border border-gold-800/40 text-center space-y-4">
      <div className="animate-spin inline-block w-8 h-8 border-3 border-gold-400 border-t-transparent rounded-full" />
      <p className="text-xs font-mono text-gold-300">Synchronizing expedition state...</p>
    </div>
  );
}
