/**
 * NotApprovedScreen Component
 *
 * Rendered when a user authenticates, but their team registration is
 * still pending approval or not authorized for active quiz participation.
 *
 * Provides:
 * - Clear waiting / not-approved explanation
 * - Team name or member details if available
 * - Clean sign out option
 */
export default function NotApprovedScreen({ user, team, onLogout }) {
  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 animate-fadeIn">
      <div
        className="relative overflow-hidden rounded-2xl border border-amber-800/40 text-parchment-100 shadow-2xl"
        style={{
          background: 'linear-gradient(168deg, #14100D 0%, #0E0B09 45%, #080605 100%)',
          boxShadow: '0 0 60px rgba(0,0,0,0.85), 0 0 25px rgba(245,158,11,0.08), inset 0 1px 0 rgba(212,175,55,0.1)',
        }}
      >
        {/* Top Amber Accent Line */}
        <div className="h-1 w-full bg-gradient-to-r from-bronze-600 via-amber-500 to-bronze-600" />

        <div className="relative p-6 sm:p-8 md:p-10 text-center space-y-6">
          {/* Status Icon */}
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-950/70 border border-amber-700/60 text-amber-400 flex items-center justify-center text-3xl shadow-lg">
            📋
          </div>

          {/* Heading */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400 font-bold">
              REGISTRATION STATUS
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-parchment-100 font-pirate">
              Registration Under Review
            </h1>
            {user?.name && (
              <p className="text-xs text-parchment-400">
                Participant: <span className="text-parchment-200 font-semibold">{user.name}</span>
                {team?.name && (
                  <>
                    {' '}• Team: <span className="text-gold-300 font-bold">{team.name}</span>
                  </>
                )}
              </p>
            )}
          </div>

          {/* Notice Card */}
          <div className="p-4 sm:p-5 rounded-xl bg-charcoal-950/80 border border-amber-800/40 shadow-inner space-y-2 text-left">
            <p className="text-sm font-semibold text-amber-300 text-center sm:text-left">
              Your registration has not been approved yet.
            </p>
            <p className="text-xs text-parchment-300/80 leading-relaxed">
              The competition coordinators review submitted team rosters to ensure complete verification. Once your team status is marked <strong className="text-emerald-400">APPROVED</strong>, your Team Lead will gain full access to the Round 1 quiz portal.
            </p>
            <p className="text-xs text-parchment-400">
              Please monitor announcements in the official WhatsApp group for live clearance updates.
            </p>
          </div>

          {/* Sign Out Action */}
          <div className="pt-2 border-t border-gold-900/30">
            <button
              type="button"
              onClick={onLogout}
              className="w-full sm:w-auto px-6 py-2.5 bg-charcoal-900 hover:bg-charcoal-800 text-parchment-300 hover:text-white text-xs font-semibold rounded-xl border border-bronze-700/40 hover:border-bronze-500/60 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
