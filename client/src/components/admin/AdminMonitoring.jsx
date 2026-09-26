import { useState, useEffect, useRef, useCallback } from 'react';
import { getMonitoringOverview, getTeamMonitoringDetail } from '../../services/adminService';

/**
 * AdminMonitoring — Operational live monitoring component.
 * Features:
 * - Event status, approved count, not started, in-progress, completed counts.
 * - Silent non-flickering polling (every 8 seconds when LIVE).
 * - "Last updated: ..." indicator.
 * - Team progress table and detail breakdown modal.
 */
export default function AdminMonitoring() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notLiveInfo, setNotLiveInfo] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Selected Team Detail Modal
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [teamDetail, setTeamDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  // Polling guards
  const isFetchingOverviewRef = useRef(false);
  const isFetchingDetailRef = useRef(false);
  const isMountedRef = useRef(true);

  // Fetch Overview
  const fetchOverview = useCallback(async (isManual = false) => {
    if (isFetchingOverviewRef.current) return;
    isFetchingOverviewRef.current = true;

    if (isManual) {
      setError(null);
    }

    try {
      const res = await getMonitoringOverview();
      if (!isMountedRef.current) return;

      if (res?.notLive) {
        setNotLiveInfo(res);
        setOverview(null);
        setLastUpdated(new Date().toLocaleTimeString());
        return;
      }

      if (res?.success) {
        setOverview(res);
        setNotLiveInfo(null);
        setError(null);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err.message || 'Failed to fetch monitoring overview.');
    } finally {
      isFetchingOverviewRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Fetch Team Detail
  const fetchTeamDetail = useCallback(async (teamId, isManual = false) => {
    if (!teamId || isFetchingDetailRef.current) return;
    isFetchingDetailRef.current = true;

    if (isManual) {
      setDetailLoading(true);
      setDetailError(null);
    }

    try {
      const res = await getTeamMonitoringDetail(teamId);
      if (!isMountedRef.current) return;

      if (res?.success) {
        setTeamDetail(res);
        setDetailError(null);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setDetailError(err.message || 'Failed to fetch team details.');
    } finally {
      isFetchingDetailRef.current = false;
      if (isMountedRef.current) {
        setDetailLoading(false);
      }
    }
  }, []);

  // Polling Lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    fetchOverview(true);

    const interval = setInterval(() => {
      if (!notLiveInfo && isMountedRef.current) {
        fetchOverview(false);
      }
    }, 8000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchOverview, notLiveInfo]);

  // Team detail polling
  useEffect(() => {
    if (!selectedTeamId || notLiveInfo) return;
    fetchTeamDetail(selectedTeamId, true);

    const detailInterval = setInterval(() => {
      if (isMountedRef.current && selectedTeamId && !notLiveInfo) {
        fetchTeamDetail(selectedTeamId, false);
      }
    }, 5000);

    return () => clearInterval(detailInterval);
  }, [selectedTeamId, notLiveInfo, fetchTeamDetail]);

  const teams = overview?.teams || [];
  const filteredTeams = teams.filter((t) => {
    const matchesSearch =
      t.teamName?.toLowerCase().includes(search.toLowerCase()) ||
      t.leadName?.toLowerCase().includes(search.toLowerCase()) ||
      t.leadEmail?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatTimestamp = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0F172A] border border-slate-800 p-5 rounded-2xl shadow-lg">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <span>📡</span> Live Operational Monitoring
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative tracking of active team quiz attempts, timers, and question progression.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[11px] font-mono text-slate-400">
              Last updated: <strong className="text-slate-200">{lastUpdated}</strong>
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchOverview(true)}
            disabled={loading}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 disabled:opacity-50 rounded-xl border border-slate-700 transition flex items-center gap-1.5"
          >
            <span>↻</span> Refresh
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs sm:text-sm flex items-center gap-2 shadow-sm">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Event Not Live Notice */}
      {notLiveInfo && (
        <div className="p-8 rounded-2xl bg-[#0F172A] border border-slate-800 text-center space-y-3 shadow-lg">
          <div className="text-3xl">⏸️</div>
          <h3 className="text-base font-bold text-slate-100">
            Event is in {notLiveInfo.status} status
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            {notLiveInfo.message ||
              'Operational monitoring will activate once the competition round is started.'}
          </p>
          <div className="pt-2">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-900 border border-slate-800 text-gold-300">
              STATUS: {notLiveInfo.status}
            </span>
          </div>
        </div>
      )}

      {/* Live Monitoring Dashboard (When LIVE or data present) */}
      {overview && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            <div className="bg-[#0F172A] border border-slate-800 p-4 rounded-xl shadow-xs">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Approved Teams
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-100 font-mono">
                {overview.stats?.totalApprovedTeams || 0}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Eligible participants</div>
            </div>

            <div className="bg-[#0F172A] border border-slate-800 p-4 rounded-xl shadow-xs">
              <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                Not Started
              </div>
              <div className="mt-2 text-2xl font-bold text-amber-300 font-mono">
                {overview.stats?.notStartedCount || 0}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Yet to start attempt</div>
            </div>

            <div className="bg-[#0F172A] border border-slate-800 p-4 rounded-xl shadow-xs">
              <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                In Progress
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-300 font-mono">
                {overview.stats?.inProgressCount || 0}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Currently answering</div>
            </div>

            <div className="bg-[#0F172A] border border-slate-800 p-4 rounded-xl shadow-xs">
              <div className="text-[11px] font-mono uppercase tracking-wider text-indigo-400 font-bold">
                Completed
              </div>
              <div className="mt-2 text-2xl font-bold text-indigo-300 font-mono">
                {overview.stats?.completedCount || 0}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Finished Round 1</div>
            </div>
          </div>

          {/* Teams Table Section */}
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl overflow-hidden shadow-lg space-y-0">
            {/* Search and Filter */}
            <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {[
                  { label: 'All', val: 'ALL' },
                  { label: 'In Progress', val: 'IN_PROGRESS' },
                  { label: 'Not Started', val: 'NOT_STARTED' },
                  { label: 'Completed', val: 'COMPLETED' },
                ].map((f) => (
                  <button
                    key={f.val}
                    type="button"
                    onClick={() => setStatusFilter(f.val)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                      statusFilter === f.val
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search team or lead…"
                className="px-3.5 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 max-w-xs"
              />
            </div>

            {/* Teams Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Team Name</th>
                    <th className="py-3 px-4 font-semibold">Team Lead</th>
                    <th className="py-3 px-4 font-semibold">Current Progress</th>
                    <th className="py-3 px-4 font-semibold">Started At</th>
                    <th className="py-3 px-4 font-semibold">Completed / Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTeams.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-10 text-center text-slate-500">
                        No team activity matching the filters.
                      </td>
                    </tr>
                  ) : (
                    filteredTeams.map((team) => (
                      <tr
                        key={team.teamId}
                        onClick={() => setSelectedTeamId(team.teamId)}
                        className="hover:bg-slate-850/50 cursor-pointer transition"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-100">{team.teamName}</div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-300">
                          <div>{team.leadName || '—'}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{team.leadEmail}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          {team.status === 'NOT_STARTED' && (
                            <span className="text-slate-500">Not started yet</span>
                          )}
                          {team.status === 'IN_PROGRESS' && (
                            <div className="space-y-1">
                              <span className="font-mono text-emerald-400 font-bold">
                                Question {team.currentQuestionNumber || 1} of{' '}
                                {overview.event?.totalQuestions || 10}
                              </span>
                              <div className="w-28 h-1 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{
                                    width: `${
                                      ((team.currentQuestionNumber || 1) /
                                        (overview.event?.totalQuestions || 10)) *
                                      100
                                    }%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          {team.status === 'COMPLETED' && (
                            <span className="inline-flex items-center gap-1 font-mono text-indigo-400 font-bold">
                              ✓ Completed all questions
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                          {formatTimestamp(team.startedAt)}
                        </td>

                        <td className="py-3.5 px-4">
                          {team.status === 'NOT_STARTED' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-400">
                              NOT STARTED
                            </span>
                          )}
                          {team.status === 'IN_PROGRESS' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                              IN PROGRESS
                            </span>
                          )}
                          {team.status === 'COMPLETED' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                              COMPLETED {formatTimestamp(team.completedAt)}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTeamId(team.teamId);
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Team Progress Detail Modal */}
      {selectedTeamId && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400">
                  Team Progress Detail
                </span>
                <h3 className="text-lg font-bold text-slate-100 mt-1">
                  {teamDetail?.team?.name || 'Loading Team Details…'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTeamId(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-100"
              >
                ✕
              </button>
            </div>

            {detailLoading && !teamDetail ? (
              <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span>Fetching live team state…</span>
              </div>
            ) : detailError ? (
              <div className="p-4 bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs rounded-xl">
                {detailError}
              </div>
            ) : teamDetail ? (
              <div className="space-y-4 text-xs">
                {/* Status Pills */}
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 font-mono">
                  <div>
                    <span className="text-slate-500 block">Status:</span>
                    <span className="font-bold text-slate-200">
                      {teamDetail.attempt?.status || 'NOT_STARTED'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Questions Answered:</span>
                    <span className="font-bold text-emerald-400">
                      {teamDetail.attempt?.answeredCount || 0} /{' '}
                      {teamDetail.event?.totalQuestions || 10}
                    </span>
                  </div>
                </div>

                {/* Per-Question History (no answers exposed) */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-400 uppercase font-mono tracking-wider">
                    Question Timeline
                  </h4>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {teamDetail.questions?.map((q) => (
                      <div
                        key={q.questionNumber}
                        className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between font-mono"
                      >
                        <span className="font-semibold text-slate-300">
                          Question #{q.questionNumber}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            q.status === 'ANSWERED'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : q.status === 'SKIPPED'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {q.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="pt-2 text-right border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedTeamId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
