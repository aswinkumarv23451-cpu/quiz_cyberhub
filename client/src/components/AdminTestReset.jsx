import { useState, useEffect } from 'react';
import { resetTestEvent } from '../services/adminService';
import { getRegistrationEvent } from '../services/registrationService';

export default function AdminTestReset({ onResetSuccess }) {
  const [eventData, setEventData] = useState(null);
  const [confirmation, setConfirmation] = useState('');
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Fetch current event to show event context without exposing internal UUID
  const fetchCurrentEvent = async () => {
    try {
      setLoadingEvent(true);
      setError(null);
      const res = await getRegistrationEvent();
      if (res?.success && res?.event) {
        setEventData(res.event);
      }
    } catch (_) {
      // Non-blocking: backend automatically resolves event during reset
    } finally {
      setLoadingEvent(false);
    }
  };

  useEffect(() => {
    fetchCurrentEvent();
  }, []);

  const isConfirmationValid = confirmation === 'RESET ROUND 1';
  const canSubmit = isConfirmationValid && !isResetting;

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      setIsResetting(true);
      setError(null);
      setResult(null);

      const res = await resetTestEvent({
        confirmation: confirmation.trim(),
      });

      if (res?.success) {
        setResult(res);
        setConfirmation('');
        // Update local event status to READY
        setEventData((prev) => (prev ? { ...prev, status: 'READY' } : null));

        if (onResetSuccess) {
          onResetSuccess(res);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to reset test event.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>🛠️</span> Development Utilities
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Safe operational reset for development, staging, and mock competition testing.
          </p>
        </div>
      </div>

      {/* Main Destructive Action Container */}
      <div className="bg-slate-900 border-2 border-rose-900/60 rounded-xl p-6 shadow-xl relative overflow-hidden space-y-6">
        {/* Visual Caution Badge */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold text-lg">
            ⚠️
          </div>
          <div>
            <h3 className="text-lg font-bold text-rose-300">Reset Current Round 1 Test Data</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 uppercase tracking-wider">
              Destructive Action — Development / Test Only
            </span>
          </div>
        </div>

        {/* Clear Explanation */}
        <div className="bg-rose-950/30 border border-rose-800/50 rounded-lg p-4 text-xs text-rose-200/90 leading-relaxed space-y-2">
          <p className="font-semibold text-rose-300">
            This operation resets the current Round 1 event data back to a clean state.
          </p>
          <ul className="list-disc list-inside space-y-1 text-rose-200/80 pl-1">
            <li>Permanently wipes all test registrations, teams, members, quiz attempts, and answers for Round 1.</li>
            <li>Restores event lifecycle status to <strong className="text-white">READY</strong> so testing can be repeated.</li>
            <li>Questions, competition scoring rules, and administrator accounts remain 100% intact.</li>
          </ul>
          <p className="text-rose-300/70 pt-1 border-t border-rose-900/50">
            Protected operation: Disabled by default in production. Only available when <code className="text-rose-200 font-mono">ALLOW_TEST_RESET=true</code>.
          </p>
        </div>

        {/* Current Event Context Banner (Zero UUID Exposure) */}
        {eventData && (
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-4 py-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Current Target Event:</span>
              <span className="text-slate-200 font-semibold">{eventData.name || 'Round 1'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Current Status:</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono uppercase bg-slate-800 text-amber-300 border border-slate-700">
                {eventData.status}
              </span>
            </div>
          </div>
        )}

        {/* Error Notice */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-sm flex items-center justify-between">
            <span>❌ {error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs font-semibold ml-4 hover:opacity-80"
            >
              ✕
            </button>
          </div>
        )}

        {/* Success / Audit Summary */}
        {result && (
          <div className="p-5 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 text-sm space-y-3">
            <div className="flex items-center gap-2 font-bold text-emerald-200 text-base">
              <span>✅</span> {result.message}
            </div>
            <p className="text-xs text-emerald-400/90">
              The event status is now <span className="font-bold underline text-white">READY</span>. All questions and admin accounts remain intact.
            </p>
            {result.deleted && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-emerald-800/40 text-xs text-emerald-200">
                <div className="bg-slate-900/60 p-2.5 rounded border border-emerald-800/30 text-center">
                  <span className="block text-slate-400">Teams</span>
                  <span className="font-mono text-base font-bold text-emerald-300">{result.deleted.teams}</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded border border-emerald-800/30 text-center">
                  <span className="block text-slate-400">Members</span>
                  <span className="font-mono text-base font-bold text-emerald-300">{result.deleted.teamMembers}</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded border border-emerald-800/30 text-center">
                  <span className="block text-slate-400">Attempts</span>
                  <span className="font-mono text-base font-bold text-emerald-300">{result.deleted.attempts}</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded border border-emerald-800/30 text-center">
                  <span className="block text-slate-400">Answers</span>
                  <span className="font-mono text-base font-bold text-emerald-300">{result.deleted.answers}</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded border border-emerald-800/30 text-center">
                  <span className="block text-slate-400">Users</span>
                  <span className="font-mono text-base font-bold text-emerald-300">{result.deleted.participantUsers}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reset Form — Only Confirmation Phrase Required */}
        <form onSubmit={handleResetSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Type <span className="font-mono text-rose-400 font-bold">RESET ROUND 1</span> to confirm
            </label>
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="Type RESET ROUND 1 to confirm"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 font-mono tracking-wide focus:outline-none focus:border-rose-500 transition"
              required
              autoComplete="off"
            />
            <p className="text-[11px] text-slate-500">
              Exact match required. Case-sensitive. Leading or trailing spaces will prevent activation.
            </p>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition flex items-center justify-center gap-2 shadow-lg disabled:cursor-not-allowed border border-rose-500/40 disabled:border-slate-700"
            >
              {isResetting ? (
                <>
                  <span className="animate-spin text-sm">↻</span>
                  Resetting Round 1 Test Data...
                </>
              ) : (
                <>
                  <span>🔥</span> Reset Round 1 Test Data
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
