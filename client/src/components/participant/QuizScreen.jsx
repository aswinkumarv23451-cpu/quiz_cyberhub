import { useState, useEffect, useRef } from 'react';
import QuizTimer from './QuizTimer';

/**
 * QuizScreen Component (Module 13C Live Quiz Interface)
 *
 * Requirements:
 * 1. NO FLICKERING:
 *    - Timer updates are completely isolated inside <QuizTimer>.
 *    - Timer countdowns do NOT re-render the question or option cards.
 *    - Selected option remains strictly persistent and stable.
 *
 * 2. QUESTION TRANSITIONS:
 *    - Smooth fade + upward transition (~220ms) when moving Q -> Q+1.
 *    - Seamless, no layout jumping or stale option flash.
 *    - Respects prefers-reduced-motion.
 *
 * 3. PROMINENT QUESTION COUNTER & PROGRESS:
 *    - Bold, clear "Question N / M" in pirate header.
 *    - Integrated, smooth progress bar.
 *
 * 4. 2 × 2 GRID QUESTION LAYOUT:
 *                   QUESTION
 *           ┌──────────┐  ┌──────────┐
 *           │ OPTION A │  │ OPTION B │
 *           └──────────┘  └──────────┘
 *           ┌──────────┐  ┌──────────┐
 *           │ OPTION C │  │ OPTION D │
 *           └──────────┘  └──────────┘
 *
 * 5. SUBMIT FEEDBACK:
 *    - Immediate visual feedback on submit click with animated spinner and "Locking In Answer…".
 */

const QUIZ_STYLE_ID = 'qs-quiz-styles';
function ensureQuizStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(QUIZ_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = QUIZ_STYLE_ID;
  style.textContent = `
    @keyframes q-fade-up {
      0% {
        opacity: 0.2;
        transform: translateY(8px);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .q-transition {
      animation: q-fade-up 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
      will-change: opacity, transform;
    }
    @media (prefers-reduced-motion: reduce) {
      .q-transition {
        animation: none !important;
        opacity: 1 !important;
        transform: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

export default function QuizScreen({
  teamName,
  question,
  deadline,
  submitting,
  onSubmitAnswer,
  onSkipQuestion,
  onTimeout,
  errorMessage,
}) {
  const [selectedOption, setSelectedOption] = useState(null);
  const [transitioning, setTransitioning] = useState(false);

  const currentQuestionIdRef = useRef(question?.id);
  const prevIdRef = useRef(question?.id);

  useEffect(() => {
    ensureQuizStyles();
  }, []);

  // Smooth question transition trigger on Q -> Q+1 change
  useEffect(() => {
    if (question?.id && prevIdRef.current !== question?.id) {
      prevIdRef.current = question?.id;
      setTransitioning(true);
      const timer = setTimeout(() => {
        setTransitioning(false);
      }, 240);
      return () => clearTimeout(timer);
    }
  }, [question?.id]);

  // Synchronously reset selected option ONLY when the question ID changes
  if (currentQuestionIdRef.current !== question?.id) {
    currentQuestionIdRef.current = question?.id;
    if (selectedOption !== null) {
      setSelectedOption(null);
    }
  }

  const options = question?.options || {};
  const optionKeys = ['A', 'B', 'C', 'D'].filter(
    (key) => options[key] !== undefined && options[key] !== null
  );

  const currentQNum = question?.questionNumber || 1;
  const totalQNum = question?.totalQuestions || 1;
  const progressPct = Math.min(100, Math.max(5, (currentQNum / totalQNum) * 100));

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
      {/* Expedition Quiz Card Panel */}
      <div
        className="relative overflow-hidden rounded-2xl border border-gold-800/40 text-parchment-100 shadow-2xl"
        style={{
          background: 'linear-gradient(168deg, #14100D 0%, #0D0A08 45%, #080605 100%)',
          boxShadow:
            '0 0 60px rgba(0,0,0,0.85), 0 0 25px rgba(212,175,55,0.08), inset 0 1px 0 rgba(212,175,55,0.1)',
        }}
      >
        {/* Top Gold Border Accent */}
        <div className="h-1 w-full bg-gradient-to-r from-bronze-600 via-gold-400 to-bronze-600" />

        <div className="p-4 sm:p-6 md:p-8 space-y-6">
          {/* ── HEADER BAR: Round, Question Counter, Team, Isolated Timer ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gold-900/40">
            <div className="space-y-2 flex-1">
              {/* Prominent Question Counter */}
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="px-2.5 py-0.5 rounded bg-gold-950/80 border border-gold-700/60 text-[10px] font-mono tracking-widest text-gold-300 font-bold uppercase shadow-sm">
                  ROUND 1
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs uppercase tracking-wider text-parchment-400 font-mono">
                    Question
                  </span>
                  <span className="text-xl sm:text-2xl font-bold font-pirate text-gold-300 tracking-wide">
                    {currentQNum}
                  </span>
                  <span className="text-sm text-parchment-400 font-mono font-medium">
                    / {totalQNum}
                  </span>
                </div>
              </div>

              {/* Progress Bar (smooth, non-distracting) */}
              <div
                className="w-full max-w-xs h-1.5 bg-black/40 rounded-full overflow-hidden border border-gold-900/40 shadow-inner"
                role="progressbar"
                aria-valuenow={currentQNum}
                aria-valuemin="1"
                aria-valuemax={totalQNum}
                aria-label="Quiz progress"
              >
                <div
                  className="h-full bg-gradient-to-r from-bronze-500 via-gold-400 to-amber-300 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <h2 className="text-xs text-parchment-400">
                Crew:{' '}
                <span className="text-parchment-100 font-semibold">
                  {teamName || 'Your Team'}
                </span>
              </h2>
            </div>

            {/* Isolated Timer Component (Only this re-renders every second!) */}
            <div className="flex items-center justify-end shrink-0">
              <QuizTimer deadline={deadline} onTimeout={onTimeout} />
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-crimson-950/70 border border-crimson-700/60 text-crimson-200 rounded-xl text-xs flex items-center gap-2">
              <span className="text-base shrink-0">⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ── QUESTION & OPTIONS (Smooth Transition on Q Change) ── */}
          <div className={`space-y-6 ${transitioning ? 'q-transition' : ''}`}>
            {/* 1. QUESTION BOX */}
            <div className="p-5 sm:p-7 md:p-8 rounded-2xl bg-gradient-to-b from-[#1A130E] to-[#100C09] border border-gold-800/40 shadow-inner">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="inline-block px-2.5 py-0.5 rounded bg-gold-500/10 border border-gold-600/30 text-[11px] font-mono uppercase tracking-widest text-gold-400 font-bold">
                  QUESTION {currentQNum} OF {totalQNum}
                </span>
              </div>
              <p className="text-base sm:text-lg md:text-xl font-medium text-parchment-100 leading-relaxed break-words whitespace-pre-wrap">
                {question?.questionText}
              </p>
            </div>

            {/* 2. OPTIONS: 2 × 2 GRID (Desktop/Tablet) & 1 Column (Mobile) */}
            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 md:gap-5"
              role="radiogroup"
              aria-label="Question answer options"
            >
              {optionKeys.map((key) => {
                const optionText = options[key];
                const isSelected = selectedOption === key;

                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={submitting}
                    onClick={() => setSelectedOption(key)}
                    className={`w-full min-h-[72px] sm:min-h-[80px] text-left p-4 sm:p-5 rounded-xl border-2 transition-all flex items-center justify-between gap-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 ${
                      isSelected
                        ? 'border-gold-400 bg-gradient-to-br from-[#3B2810] via-[#2A1D0C] to-[#1C140A] text-white shadow-[0_0_25px_rgba(212,175,55,0.32)] ring-2 ring-gold-400/40'
                        : 'border-bronze-700/50 bg-[#16100B] hover:bg-[#1E1610] hover:border-gold-500/70 text-parchment-200 hover:text-white shadow-sm'
                    } ${submitting ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {/* Option Letter Badge */}
                      <span
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-xs sm:text-sm font-mono font-black shrink-0 border transition-all ${
                          isSelected
                            ? 'bg-gold-400 text-charcoal-950 border-gold-300 shadow-md scale-105'
                            : 'bg-[#221810] border-bronze-600/60 text-gold-300'
                        }`}
                      >
                        {key}
                      </span>

                      {/* Option Text */}
                      <span
                        className={`text-xs sm:text-sm md:text-base leading-snug break-words ${
                          isSelected ? 'font-bold text-white' : 'font-medium text-parchment-100'
                        }`}
                      >
                        {optionText}
                      </span>
                    </div>

                    {/* Obvious Persistent Selected Checkmark Indicator */}
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-gold-400 text-charcoal-950 flex items-center justify-center text-xs font-black shrink-0 shadow-sm animate-fadeIn">
                        ✓
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 3. ACTIONS: Skip & Submit with Immediate Feedback ── */}
          <div className="pt-4 border-t border-gold-900/40 flex flex-col-reverse sm:flex-row items-center gap-3.5">
            <button
              type="button"
              onClick={onSkipQuestion}
              disabled={submitting}
              className="w-full sm:w-auto px-5 py-3.5 bg-charcoal-950 hover:bg-charcoal-900 disabled:opacity-50 text-parchment-400 hover:text-amber-400 text-xs font-bold rounded-xl border border-bronze-800 hover:border-amber-700/50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
            >
              {submitting ? 'Processing...' : 'Skip Question (-10)'}
            </button>

            <button
              type="button"
              onClick={() => {
                if (selectedOption && !submitting) {
                  onSubmitAnswer(selectedOption);
                }
              }}
              disabled={!selectedOption || submitting}
              className="w-full sm:flex-1 py-3.5 px-6 bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 hover:from-gold-200 hover:to-gold-400 disabled:opacity-40 disabled:cursor-not-allowed text-charcoal-950 text-xs sm:text-sm font-extrabold rounded-xl transition-all shadow-lg shadow-gold-900/30 uppercase font-pirate tracking-wider focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-charcoal-950 shrink-0"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  <span>Locking In Answer…</span>
                </>
              ) : (
                'Submit Answer'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
