/**
 * ScoringRulesModal Component
 *
 * Appears immediately before starting Round 1.
 * Authoritatively explains the scoring breakdown (+10 / -5 / -10)
 * and requirements before the participant clicks "Start Round 1".
 * Does NOT reveal correct answers.
 */
export default function ScoringRulesModal({
  teamName,
  onStartQuiz,
  onLogout,
  starting = false,
  error = null,
}) {
  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 animate-fadeIn">
      <div
        className="relative overflow-hidden rounded-2xl border border-gold-800/40 text-parchment-100 shadow-2xl"
        style={{
          background: 'linear-gradient(168deg, #16120F 0%, #100D0A 40%, #0A0806 100%)',
          boxShadow: '0 0 60px rgba(0,0,0,0.85), 0 0 30px rgba(168,132,84,0.1), inset 0 1px 0 rgba(212,175,55,0.12)',
        }}
      >
        {/* Top Gold Gradient Bar */}
        <div className="h-1 w-full bg-gradient-to-r from-bronze-600 via-gold-400 to-bronze-600" />

        <div className="p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="border-b border-gold-900/40 pb-4 text-center sm:text-left space-y-1">
            <span className="text-[11px] font-mono uppercase tracking-widest text-gold-400">
              EXPEDITION BRIEFING
            </span>
            <h2 className="text-2xl font-black tracking-tight text-parchment-100 font-pirate">
              Cryptic Tide Rules & Scoring
            </h2>
            <p className="text-xs text-parchment-300">
              Team: <span className="text-gold-300 font-bold">{teamName || 'Your Crew'}</span>
            </p>
          </div>

          {error && (
            <div className="p-3.5 bg-crimson-950/70 border border-crimson-700/60 text-crimson-200 rounded-xl text-xs flex items-center gap-2">
              <span className="text-base shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Scoring Information Card */}
          <div className="space-y-3 bg-charcoal-950/80 p-4 sm:p-5 rounded-xl border border-gold-800/40 shadow-inner">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gold-400 font-mono">
              Scoring Structure
            </h3>

            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 text-center">
              {/* Correct */}
              <div className="p-3 sm:p-4 rounded-xl bg-emerald-950/40 border border-emerald-700/50 shadow-sm flex flex-col justify-center items-center">
                <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                  +10
                </span>
                <span className="text-[11px] sm:text-xs font-bold text-parchment-100 uppercase tracking-wider mt-1">
                  Correct
                </span>
                <span className="text-[10px] text-parchment-400 hidden sm:block">Per right answer</span>
              </div>

              {/* Wrong */}
              <div className="p-3 sm:p-4 rounded-xl bg-crimson-950/40 border border-crimson-700/50 shadow-sm flex flex-col justify-center items-center">
                <span className="text-xl sm:text-2xl font-black text-crimson-400 font-mono">
                  -5
                </span>
                <span className="text-[11px] sm:text-xs font-bold text-parchment-100 uppercase tracking-wider mt-1">
                  Wrong
                </span>
                <span className="text-[10px] text-parchment-400 hidden sm:block">Penalty for error</span>
              </div>

              {/* Skip / Timeout */}
              <div className="p-3 sm:p-4 rounded-xl bg-amber-950/40 border border-amber-700/50 shadow-sm flex flex-col justify-center items-center">
                <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
                  -10
                </span>
                <span className="text-[11px] sm:text-xs font-bold text-parchment-100 uppercase tracking-wider mt-1">
                  Skip
                </span>
                <span className="text-[10px] text-parchment-400 hidden sm:block">Or time expiry</span>
              </div>
            </div>
          </div>

          {/* Expedition Guidelines */}
          <div className="space-y-2 text-xs text-parchment-300">
            <h4 className="text-[11px] font-mono uppercase tracking-wider text-parchment-400">
              Crucial Expedition Guidelines:
            </h4>
            <ul className="space-y-1.5 list-disc list-inside text-parchment-300/90 leading-relaxed">
              <li>Each question has an authoritative countdown managed directly by the server.</li>
              <li>Questions are answered strictly in sequence; you cannot return to a past question.</li>
              <li>If the timer expires before you submit, the question is recorded as skipped (-10 marks).</li>
              <li>Exactly one attempt is allowed per team. Once completed, your scores are finalized.</li>
              <li>In case of network hiccups or page refresh, your progress and countdown are safely restored.</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onStartQuiz}
              disabled={starting}
              className="flex-1 py-3.5 px-6 bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 hover:from-gold-200 hover:to-gold-400 disabled:opacity-50 text-charcoal-950 font-extrabold text-sm rounded-xl transition shadow-lg shadow-gold-900/40 hover:shadow-gold-800/60 uppercase font-pirate tracking-wider focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
            >
              {starting ? 'Embarking on Cryptic Tide...' : 'Start Cryptic Tide'}
            </button>
            <button
              type="button"
              onClick={onLogout}
              disabled={starting}
              className="py-3.5 px-5 bg-charcoal-900 hover:bg-charcoal-800 text-parchment-300 hover:text-white text-xs font-semibold rounded-xl border border-bronze-700/40 hover:border-bronze-500/60 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
