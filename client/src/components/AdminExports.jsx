import { useState } from 'react';
import { downloadLeaderboardCsv, downloadRegistrationsCsv } from '../services/adminService';

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
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>⬇️</span> Admin Data Exports
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Export official competition data in RFC 4180 compliant CSV format. Downloads are authenticated and read-only.
          </p>
        </div>
      </div>

      {/* Status / Error Message */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-sm border flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60'
              : 'bg-rose-950/50 text-rose-300 border-rose-800/60'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs font-semibold ml-4 hover:opacity-80"
          >
            ✕
          </button>
        </div>
      )}

      {/* Export Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Leaderboard Export Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-lg">
                🏆
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-100">Leaderboard Export</h3>
                <span className="text-xs text-slate-400 font-mono">leaderboard.csv</span>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Export the official competition standings. Uses deterministic ranking identical to the live leaderboard:
            </p>

            <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
              <li>Rank & Team Name</li>
              <li>Calculated Total Score (with negative marking)</li>
              <li>Status (COMPLETED / IN_PROGRESS / NOT_STARTED)</li>
              <li>Completed At & Started At timestamps</li>
            </ul>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-xs text-slate-400">
              <span className="text-indigo-400 font-medium">Privacy Guaranteed:</span> Sensitive user information (emails, phone numbers) is omitted from this export.
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleDownloadLeaderboard}
              disabled={downloadingLeaderboard}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 disabled:text-indigo-400/50 text-white font-semibold text-sm rounded-lg transition flex items-center justify-center gap-2 shadow-sm"
            >
              {downloadingLeaderboard ? (
                <>
                  <span className="animate-spin text-base">↻</span>
                  Generating Leaderboard CSV...
                </>
              ) : (
                <>
                  <span>📥</span> Download Leaderboard CSV
                </>
              )}
            </button>
          </div>
        </div>

        {/* Registered Participants Export Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-lg">
                👥
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-100">Registered Participants Export</h3>
                <span className="text-xs text-slate-400 font-mono">registrations.csv</span>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Export all registered teams and their individual members (one row per team member):
            </p>

            <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
              <li>Team Name, Registration Status, Team Lead Name</li>
              <li>Member Name, Email, WhatsApp Phone</li>
              <li>College, Department, Register Number</li>
              <li>Member Role (TEAM_LEAD / MEMBER)</li>
              <li>WhatsApp Group Confirmation (Yes / No)</li>
              <li>Team Registration Timestamp</li>
            </ul>

            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-xs text-slate-400">
              <span className="text-emerald-400 font-medium">Free Registration:</span> Payment columns and authentication secrets are completely excluded.
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleDownloadRegistrations}
              disabled={downloadingRegistrations}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900/50 disabled:text-emerald-400/50 text-white font-semibold text-sm rounded-lg transition flex items-center justify-center gap-2 shadow-sm"
            >
              {downloadingRegistrations ? (
                <>
                  <span className="animate-spin text-base">↻</span>
                  Generating Registrations CSV...
                </>
              ) : (
                <>
                  <span>📥</span> Download Registrations CSV
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
