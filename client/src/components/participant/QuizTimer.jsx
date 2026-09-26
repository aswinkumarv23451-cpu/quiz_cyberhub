import { useState, useEffect, useRef, memo } from 'react';

/**
 * QuizTimer Component
 *
 * Isolated server-authoritative visual timer.
 * Keeps `secondsRemaining` state completely local so that timer ticks
 * do NOT cause the question or option cards to re-render or flicker.
 *
 * @param {Object} props
 * @param {string} props.deadline - ISO string of authoritative question deadline
 * @param {Function} props.onTimeout - Callback invoked once when deadline expires
 */
const QuizTimer = memo(function QuizTimer({ deadline, onTimeout }) {
  const [secondsRemaining, setSecondsRemaining] = useState(() => {
    if (!deadline) return 0;
    const diff = Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000));
    return diff;
  });

  const hasTimedOutRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  // Reset timeout guard when deadline changes (new question)
  useEffect(() => {
    hasTimedOutRef.current = false;
  }, [deadline]);

  useEffect(() => {
    if (!deadline) return;

    const calculateDiff = () => {
      const deadlineTime = new Date(deadline).getTime();
      return Math.max(0, Math.ceil((deadlineTime - Date.now()) / 1000));
    };

    // Immediate sync on deadline change
    const initialDiff = calculateDiff();
    setSecondsRemaining(initialDiff);

    if (initialDiff <= 0 && !hasTimedOutRef.current) {
      hasTimedOutRef.current = true;
      if (onTimeoutRef.current) onTimeoutRef.current();
      return;
    }

    const interval = setInterval(() => {
      const remaining = calculateDiff();
      setSecondsRemaining(remaining);

      if (remaining <= 0 && !hasTimedOutRef.current) {
        hasTimedOutRef.current = true;
        clearInterval(interval);
        if (onTimeoutRef.current) onTimeoutRef.current();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  const isUrgent = secondsRemaining <= 5;
  const isWarning = secondsRemaining > 5 && secondsRemaining <= 10;

  return (
    <div
      className={`px-3.5 py-1.5 rounded-xl border text-xs sm:text-sm font-mono font-bold flex items-center gap-2 transition-colors select-none ${
        isUrgent
          ? 'bg-crimson-950/90 border-crimson-600 text-crimson-300 shadow-lg shadow-crimson-950/50'
          : isWarning
          ? 'bg-amber-950/90 border-amber-600 text-amber-300'
          : 'bg-charcoal-950/90 border-gold-700/50 text-gold-300'
      }`}
      role="timer"
      aria-live="polite"
      aria-label={`Time remaining: ${secondsRemaining} seconds`}
    >
      <span className="text-sm">⏱</span>
      <span>{secondsRemaining}s</span>
    </div>
  );
});

export default QuizTimer;
