import { useState, useEffect } from 'react';
import { resetTestEvent } from '../services/adminService';
import { getRegistrationEvent } from '../services/registrationService';

export default function AdminTestReset({ onResetSuccess }) {
  const [eventData, setEventData] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Fetch current event to pre-populate event selection
  const fetchCurrentEvent = async () => {
    try {
      setLoadingEvent(true);
      setError(null);
      const res = await getRegistrationEvent();
      if (res?.success && res?.event) {
        setEventData(res.event);
        setSelectedEventId(res.event.id || '');
      }
    } catch (err) {
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
            Safe operational reset for development and staging environments.
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
            <h3 className="text-lg font-bold text-rose-300">Reset Test Event</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 uppercase tracking-wider">
              Destructive Action — Development / Test Only
            </span>
          </div>
        </div>

        {/* Mandatory Safety Notice */}
        <div className="bg-rose-950/30 border border-rose-800/50 rounded-lg p-4 text-xs text-rose-200/90 leading-relaxed space-y-1">
          <p className="font-semibold text-rose-300">
            Development/Test use only. This permanently removes test registrations, attempts, answers, and participant accounts for the selected event. Questions and admin accounts are preserved.
          </p>
          <p className="text-rose-300/70">
            This endpoint is strictly disabled in production (<code className="text-rose-200">NODE_ENV === "production"</code>).
          </p>
        </div>

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

        {/* Reset Form */}
        <form onSubmit={handleResetSubmit} className="space-y-4 pt-2">
          {/* 1. Event Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              1. Selected Event ID (UUID)
            </label>
            {eventData && (
              <div className="text-xs text-slate-400 mb-1 flex items-center gap-2">
                <span>Detected Active Event:</span>
                <span className="text-slate-200 font-semibold">{eventData.name || 'Round 1'}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700 uppercase font-mono">
                  {eventData.status}
                </span>
              </div>
            )}
            <input
              type="text"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              placeholder="e.g. 12345678-1234-1234-1234-123456789abc"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-rose-500 transition"
              required
            />
            {!isEventIdValid && selectedEventId.length > 0 && (
              <p className="text-[11px] text-rose-400">Please enter a valid 36-character UUID.</p>
            )}
          </div>

          {/* 2. Explicit Confirmation Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              2. Type <span className="font-mono text-rose-400 font-bold">RESET ROUND 1</span> to confirm
            </label>
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="Type RESET ROUND 1 to confirm"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 font-mono tracking-wide focus:outline-none focus:border-rose-500 transition"
              required
            />
            <p className="text-[11px] text-slate-500">
              Exact match required. Case-sensitive. Leading or trailing spaces will prevent activation.
            </p>
          </div>

          {/* 3. Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition flex items-center justify-center gap-2 shadow-lg disabled:cursor-not-allowed border border-rose-500/40 disabled:border-slate-700"
            >
              {isResetting ? (
                <>
                  <span className="animate-spin text-sm">↻</span>
                  Resetting Test Event...
                </>
              ) : (
                <>
                  <span>🔥</span> Reset Test Event
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
