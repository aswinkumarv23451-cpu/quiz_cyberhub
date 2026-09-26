import { useState } from 'react';

/**
 * AdminHeader — Top bar with CyberHub / Round 1 branding, admin email, mobile drawer toggle, and sign out.
 */
export default function AdminHeader({ session, onLogout, onToggleSidebar }) {
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogoutClick = async () => {
    try {
      setLoggingOut(true);
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  };

  const adminEmail = session?.user?.email || 'admin@cyberhub.local';

  return (
    <header className="sticky top-0 z-30 w-full bg-[#0B1320]/95 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
      {/* Left: Mobile Menu Toggle & Branding */}
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Branding */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold text-sm">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-wider text-slate-300 uppercase">
                CYBERHUB
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold uppercase">
                ROUND 1
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-bold text-slate-100 tracking-tight">
              Admin Dashboard
            </h1>
          </div>
        </div>
      </div>

      {/* Right: Admin Email & Sign Out */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Admin identity pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
          <span className="text-slate-400 font-mono text-[11px] truncate max-w-[180px]" title={adminEmail}>
            {adminEmail}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase">
            ADMIN
          </span>
        </div>

        {/* Sign Out Button */}
        <button
          type="button"
          onClick={handleLogoutClick}
          disabled={loggingOut}
          aria-label="Sign out of admin session"
          className="px-3.5 py-1.5 text-xs font-semibold text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 disabled:opacity-50 border border-rose-800/50 rounded-lg transition shadow-xs flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          {loggingOut ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-rose-300" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Signing Out…</span>
            </>
          ) : (
            <span>Sign Out</span>
          )}
        </button>
      </div>
    </header>
  );
}
