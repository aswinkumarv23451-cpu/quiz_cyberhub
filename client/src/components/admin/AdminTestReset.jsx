import { useState, useEffect } from 'react';
import { resetTestEvent } from '../../services/adminService';
import { getRegistrationEvent } from '../../services/registrationService';

/**
 * AdminTestReset — Isolated Danger Zone component for resetting test event data (Module 12).
 * Strictly requires confirmation text "RESET ROUND 1" and shows returned deletion counts.
 */
export default function AdminTestReset({ onResetSuccess }) {
  const [eventData, setEventData] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Auto-detect current active event
  const fetchCurrentEvent = async () => {
    try {
      setLoadingEvent(true);
      setError(null);
      const res = await getRegistrationEvent();
      if (res?.success && res?.event) {
        setEventData(res.event);
        setSelectedEventId(res.event.id || '');
      }
    } catch {
      setError('Could not automatically detect active event. You can enter the Event UUID manually.');
    } finally {
      setLoadingEvent(false);
    }
  };

  useEffect(() => {
    fetchCurrentEvent();
  }, []);

  const isConfirmationValid = confirmation === 'RESET ROUND 1';
  const isEventIdValid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    selectedEventId.trim()
  );
  const canSubmit = isConfirmationValid && isEventIdValid && !isResetting;

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      setIsResetting(true);
      setError(null);
      setResult(null);

      const res = await resetTestEvent({
        eventId: selectedEventId.trim(),
        confirmation: confirmation.trim(),
      });

      if (res?.success) {
        setResult(res);
        setConfirmation('');
        setEventData((prev) => (prev ? { ...prev, status: 'READY' } : null));

        if (onResetSuccess) {
          onResetSuccess();
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to reset test event. Environment or authorization rejected.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Danger Zone Banner */}
      <div className="bg-rose-950/20 border-2 border-rose-800/60 rounded-2xl p-6 sm:p-7 shadow-xl space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-950/80 border border-rose-700/60 flex items-center justify-center text-2xl shrink-0">
            ⚠️
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-rose-300 tracking-tight uppercase">
                Danger Zone: Test Reset
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950 border border-rose-700 text-rose-400 uppercase">
                DEVELOPMENT / TEST ONLY
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Deletes event-scoped test registrations, participant users, attempts and answers while preserving questions and admin users.
            </p>
          </div>
        </div>

        {/* Safety Invariants List */}
        <div className="bg-slate-950/80 border border-rose-900/40 rounded-xl p-4 text-xs space-y-2 text-slate-300">
          <span className="font-bold text-rose-300 uppercase tracking-wider block font-mono text-[11px]">
            Authoritative Reset Invariants:
          </span>
          <ul className="list-disc list-inside space-y-1 text-slate-400">
            <li>
              <strong className="text-slate-200">Preserved:</strong> Event configuration, question bank, and administrator accounts.
            </li>
            <li>
              <strong className="text-slate-200">Purged:</strong> Test teams, team members, quiz attempts, and submitted answers.
            </li>
            <li>
              <strong className="text-slate-200">Reset:</strong> Sets event status back to <code className="text-amber-300">READY</code>.
            </li>
            <li>
              <strong className="text-rose-400">Restricted:</strong> Strictly disabled in production environment by backend security middleware.
            </li>
          </ul>
        </div>

        {/* Reset Form */}
        <form onSubmit={handleResetSubmit} className="space-y-4 pt-2 border-t border-rose-900/40">
          {/* Target Event ID */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 uppercase font-mono">
              Target Event UUID
            </label>
            <input
              type="text"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              placeholder="e.g. 12345678-1234-1234-1234-123456789abc"
              disabled={loadingEvent || isResetting}
              className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500"
            />
            {eventData?.name && (
              <span className="text-[11px] text-slate-400 block">
                Targeting: <strong className="text-slate-200">{eventData.name}</strong> (Status: {eventData.status})
              </span>
            )}
          </div>

          {/* Exact Confirmation Text Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              To confirm, type <span className="font-mono text-rose-300 font-black">RESET ROUND 1</span> below:
            </label>
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="RESET ROUND 1"
              disabled={isResetting}
              className="w-full p-2.5 bg-slate-950 border border-rose-900/60 rounded-xl text-xs font-mono font-bold text-rose-200 placeholder-slate-700 focus:outline-none focus:border-rose-500 tracking-wider"
            />
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full sm:w-auto px-6 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-lg flex items-center justify-center gap-2"
            >
              {isResetting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Executing Safe Test Reset…</span>
                </>
              ) : (
                <span>Permanently Reset Event Test Data</span>
              )}
            </button>
          </div>
        </form>

        {/* Success Result Breakdown */}
        {result && (
          <div className="p-5 rounded-xl bg-slate-950/90 border border-emerald-700/60 space-y-3 animate-fadeIn text-xs">
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
              <span>✓</span>
              <span>{result.message || 'Test reset completed successfully!'}</span>
            </div>
            <p className="text-slate-400">
              The event has been safely returned to <code className="text-amber-300">READY</code> status. The following records were purged:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 font-mono">
              <div className="p-2 bg-slate-900 rounded-lg text-center border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Teams</span>
                <span className="font-bold text-slate-100 text-sm">{result.deleted?.teams ?? 0}</span>
              </div>
              <div className="p-2 bg-slate-900 rounded-lg text-center border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Members</span>
                <span className="font-bold text-slate-100 text-sm">{result.deleted?.members ?? 0}</span>
              </div>
              <div className="p-2 bg-slate-900 rounded-lg text-center border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Attempts</span>
                <span className="font-bold text-slate-100 text-sm">{result.deleted?.attempts ?? 0}</span>
              </div>
              <div className="p-2 bg-slate-900 rounded-lg text-center border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Answers</span>
                <span className="font-bold text-slate-100 text-sm">{result.deleted?.answers ?? 0}</span>
              </div>
              <div className="p-2 bg-slate-900 rounded-lg text-center border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Users</span>
                <span className="font-bold text-slate-100 text-sm">{result.deleted?.participantUsers ?? 0}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
