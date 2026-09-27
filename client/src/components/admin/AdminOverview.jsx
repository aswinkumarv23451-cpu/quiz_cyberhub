import { useState, useEffect, useCallback } from 'react';
import {
  getRegistrationStats,
  startEvent,
  endEvent,
  getMonitoringOverview,
} from '../../services/adminService';
import { getRegistrationEvent } from '../../services/registrationService';
import AdminConfirmDialog from './AdminConfirmDialog';

/**
 * AdminOverview — Overview dashboard with event status cards and lifecycle controls.
 */
export default function AdminOverview({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState(null);
  const [regStats, setRegStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [completedCount, setCompletedCount] = useState(0);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  // Confirmation dialogs
  const [confirmStartOpen, setConfirmStartOpen] = useState(false);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);

  const loadOverviewData = useCallback(async () => {
    try {
      setLoading(true);
      setActionMessage(null);

      // 1. Fetch Event Status & Info
      const regEventRes = await getRegistrationEvent().catch(() => null);
      if (regEventRes?.event) {
        setEventData(regEventRes.event);
      }

      // 2. Fetch Registration Statistics
      const statsRes = await getRegistrationStats().catch(() => null);
      if (statsRes?.stats) {
        setRegStats(statsRes.stats);
      }

      // 3. Fetch Operational Monitoring to obtain completed teams count if active
      const monRes = await getMonitoringOverview().catch(() => null);
      if (monRes?.stats) {
        setCompletedCount(monRes.stats.completedCount || 0);
      }
      if (monRes?.event) {
        setEventData((prev) => ({ ...prev, ...monRes.event }));
      } else if (monRes?.status) {
        setEventData((prev) => ({ ...prev, status: monRes.status }));
      }
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to load event overview data.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverviewData();
  }, [loadOverviewData]);

  const handleStartRound1 = async () => {
    try {
      setActionLoading(true);
      setActionMessage(null);
      const res = await startEvent();
      setActionMessage({
        type: 'success',
        text: res.message || 'Round 1 has been started and is now LIVE!',
      });
      await loadOverviewData();
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to start Round 1. Please resolve any bank errors first.',
      });
    } finally {
      setActionLoading(false);
      setConfirmStartOpen(false);
    }
  };

  const handleEndRound1 = async () => {
    try {
      setActionLoading(true);
      setActionMessage(null);
      const res = await endEvent();
      setActionMessage({
        type: 'success',
        text: res.message || 'Round 1 has been permanently ENDED.',
      });
      await loadOverviewData();
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to end Round 1.',
      });
    } finally {
      setActionLoading(false);
      setConfirmEndOpen(false);
    }
  };

  const currentStatus = eventData?.status || 'READY';

  return (
    <div className="space-y-6">
      {/* Overview Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0F172A] border border-slate-800 p-5 rounded-2xl shadow-lg">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <span>📊</span> Round 1 Overview
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative status, team participation counts, and event lifecycle controls.
          </p>
        </div>

        <button
          type="button"
          onClick={loadOverviewData}
          disabled={loading || actionLoading}
          className="px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 disabled:opacity-50 rounded-xl border border-slate-700 transition flex items-center gap-1.5 shadow-xs"
        >
          <span>↻</span> Refresh Stats
        </button>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-xs sm:text-sm border flex items-center justify-between shadow-md ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
              : 'bg-rose-950/60 text-rose-300 border-rose-800/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{actionMessage.type === 'success' ? '✓' : '⚠️'}</span>
            <span>{actionMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-xs font-bold underline hover:opacity-80 ml-4 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 5 Primary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* 1. Event Status */}
        <div className="col-span-2 lg:col-span-1 bg-[#0F172A] border border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
            Event Status
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            {currentStatus === 'READY' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                READY
              </span>
            )}
            {currentStatus === 'LIVE' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                LIVE
              </span>
            )}
            {currentStatus === 'ENDED' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-700/40 text-slate-300 border border-slate-600/40">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                ENDED
              </span>
            )}
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {currentStatus === 'READY' && 'Awaiting round start'}
            {currentStatus === 'LIVE' && 'Participants answering'}
            {currentStatus === 'ENDED' && 'Competition closed'}
          </div>
        </div>

        {/* 2. Registered Teams */}
        <div className="bg-[#0F172A] border border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
            Registered
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-slate-100 font-mono">
            {loading ? '…' : regStats.total}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Total submitted teams</div>
        </div>

        {/* 3. Approved Teams */}
        <div className="bg-[#0F172A] border border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
            Approved
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-emerald-300 font-mono">
            {loading ? '…' : regStats.approved}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Eligible for Round 1</div>
        </div>

        {/* 4. Pending Teams */}
        <div className="bg-[#0F172A] border border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold">
            Pending Review
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-amber-300 font-mono">
            {loading ? '…' : regStats.pending}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Awaiting organizer review</div>
        </div>

        {/* 5. Completed Teams */}
        <div className="bg-[#0F172A] border border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="text-[11px] font-mono uppercase tracking-wider text-indigo-400 font-bold">
            Completed
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-indigo-300 font-mono">
            {loading ? '…' : completedCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Finished quiz attempt</div>
        </div>
      </div>

      {/* Main Event Lifecycle Control Card */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-lg space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>🎮</span> Event Lifecycle Authority
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Strictly controls transition between READY, LIVE, and ENDED states.
            </p>
          </div>

          <div className="text-xs font-mono px-3 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300">
            Current: <strong className="text-gold-300">{currentStatus}</strong>
          </div>
        </div>

        {/* Control Area */}
        <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-200">
              {currentStatus === 'READY' && 'Start Competition Round 1'}
              {currentStatus === 'LIVE' && 'Round 1 is Currently In Progress'}
              {currentStatus === 'ENDED' && 'Round 1 Has Concluded'}
            </h4>
            <p className="text-xs text-slate-400 max-w-lg leading-relaxed">
              {currentStatus === 'READY' &&
                'Starting Round 1 transitions the competition to LIVE, unlocks quiz access for approved teams, and freezes question bank modifications.'}
              {currentStatus === 'LIVE' &&
                'Ending Round 1 closes active quiz submissions and transitions participants to the completion screen.'}
              {currentStatus === 'ENDED' &&
                'Round 1 has ended. Final scores are locked and accessible on the Leaderboard.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="shrink-0 w-full md:w-auto">
            {currentStatus === 'READY' && (
              <button
                type="button"
                disabled={actionLoading || loading}
                onClick={() => setConfirmStartOpen(true)}
                className="w-full md:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
              >
                <span>▶</span>
                <span>START ROUND 1</span>
              </button>
            )}

            {currentStatus === 'LIVE' && (
              <button
                type="button"
                disabled={actionLoading || loading}
                onClick={() => setConfirmEndOpen(true)}
                className="w-full md:w-auto px-6 py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
              >
                <span>⏹</span>
                <span>END ROUND 1</span>
              </button>
            )}

            {currentStatus === 'ENDED' && (
              <div className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 text-center">
                Round 1 has ended.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <AdminConfirmDialog
        isOpen={confirmStartOpen}
        title="Start Round 1 Competition?"
        message="Are you sure you want to START Round 1? This will transition the event from READY to LIVE, lock question bank edits, and enable approved teams to begin the quiz."
        confirmText="Yes, Start Round 1"
        isDanger={false}
        loading={actionLoading}
        onConfirm={handleStartRound1}
        onCancel={() => setConfirmStartOpen(false)}
      />

      <AdminConfirmDialog
        isOpen={confirmEndOpen}
        title="End Round 1 Competition?"
        message="Are you sure you want to END Round 1? This will close all quiz submissions, finalize attempt scores, and prevent any further participant answers. This action cannot be undone."
        confirmText="Yes, End Round 1"
        isDanger={true}
        loading={actionLoading}
        onConfirm={handleEndRound1}
        onCancel={() => setConfirmEndOpen(false)}
      />
    </div>
  );
}
