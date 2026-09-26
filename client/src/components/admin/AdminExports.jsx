import { useState } from 'react';
import { downloadLeaderboardCsv, downloadRegistrationsCsv } from '../../services/adminService';

/**
 * AdminExports — Official competition data export center.
 * Triggers backend streaming RFC 4180 CSV downloads for:
 * 1. Official Leaderboard
 * 2. Complete Team Registrations
 */
export default function AdminExports() {
  const [downloadingLeaderboard, setDownloadingLeaderboard] = useState(false);
  const [downloadingRegistrations, setDownloadingRegistrations] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const handleDownloadLeaderboard = async () => {
    try {
      setDownloadingLeaderboard(true);
      setStatusMessage(null);
      await downloadLeaderboardCsv();
      setStatusMessage({
        type: 'success',
        text: 'Leaderboard CSV downloaded successfully.',
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to download leaderboard CSV.',
      });
    } finally {
      setDownloadingLeaderboard(false);
    }
  };

  const handleDownloadRegistrations = async () => {
    try {
      setDownloadingRegistrations(true);
      setStatusMessage(null);
      await downloadRegistrationsCsv();
      setStatusMessage({
        type: 'success',
        text: 'Registrations CSV downloaded successfully.',
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to download registrations CSV.',
      });
    } finally {
      setDownloadingRegistrations(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-lg">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
          <span>⬇️</span> Data Exports Center
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Export authoritative competition records in RFC 4180 compliant CSV format. Downloads are authenticated and read-only.
        </p>
      </div>

      {/* Status Feedback Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs sm:text-sm border flex items-center justify-between shadow-md ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
              : 'bg-rose-950/60 text-rose-300 border-rose-800/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{statusMessage.type === 'success' ? '✓' : '⚠️'}</span>
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs font-bold underline hover:opacity-80 ml-4 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Export Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 1. Leaderboard CSV Card */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              <h3 className="text-base font-bold text-slate-100">Leaderboard Standings CSV</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Downloads the official rankings, scores, and completion durations for all participating teams in Round 1.
            </p>
            <div className="text-[11px] font-mono text-slate-500 pt-1">
              File: <code className="text-slate-400">round1-leaderboard.csv</code>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              disabled={downloadingLeaderboard}
              onClick={handleDownloadLeaderboard}
              className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-2"
            >
              {downloadingLeaderboard ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Exporting Leaderboard…</span>
                </>
              ) : (
                <>
                  <span>📥</span>
                  <span>Export Leaderboard CSV</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 2. Registrations CSV Card */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">👥</span>
              <h3 className="text-base font-bold text-slate-100">Team Registrations CSV</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Downloads the complete roster of registered teams, institutions, contact information, and member roles.
            </p>
            <div className="text-[11px] font-mono text-slate-500 pt-1">
              File: <code className="text-slate-400">round1-registrations.csv</code>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              disabled={downloadingRegistrations}
              onClick={handleDownloadRegistrations}
              className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-2"
            >
              {downloadingRegistrations ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Exporting Registrations…</span>
                </>
              ) : (
                <>
                  <span>📥</span>
                  <span>Export Registrations CSV</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
