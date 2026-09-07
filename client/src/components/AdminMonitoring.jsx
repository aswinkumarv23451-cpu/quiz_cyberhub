import { useState, useEffect, useRef, useCallback } from 'react';
import { getMonitoringOverview, getTeamMonitoringDetail } from '../services/adminService';

export default function AdminMonitoring() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notLiveInfo, setNotLiveInfo] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'IN_PROGRESS' | 'NOT_STARTED' | 'COMPLETED'

  // Selected team for detail view modal
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [teamDetail, setTeamDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  // Polling In-Flight Ref Guards (Genuine overlap prevention)
  const isFetchingOverviewRef = useRef(false);
  const isFetchingDetailRef = useRef(false);
  const isMountedRef = useRef(true);

  // 1. Fetch Monitoring Overview
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
        return;
      }

      if (res?.success) {
        setOverview(res);
        setNotLiveInfo(null);
        setError(null);
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

  // 2. Fetch Team Detail
  const fetchTeamDetail = useCallback(async (teamId, isManual = false) => {
    if (!teamId) return;
    if (isFetchingDetailRef.current) return;
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

  // Lifecycle & 10-second Overview Polling
  useEffect(() => {
    isMountedRef.current = true;
    fetchOverview(true);

    const overviewInterval = setInterval(() => {
      // Only continue polling if event is still active and mounted
      if (!notLiveInfo && isMountedRef.current) {
        fetchOverview(false);
      }
    }, 10000); // 10 seconds

    return () => {
      isMountedRef.current = false;
      clearInterval(overviewInterval);
    };
  }, [fetchOverview, notLiveInfo]);

  // 5-second Team Detail Polling (Active only when detail modal is open)
  useEffect(() => {
    if (!selectedTeamId || notLiveInfo) return;

    fetchTeamDetail(selectedTeamId, true);

    const detailInterval = setInterval(() => {
      if (isMountedRef.current && selectedTeamId && !notLiveInfo) {
        fetchTeamDetail(selectedTeamId, false);
      }
    }, 5000); // 5 seconds

    return () => {
      clearInterval(detailInterval);
    };
  }, [selectedTeamId, notLiveInfo, fetchTeamDetail]);

  const handleOpenDetail = (teamId) => {
    setSelectedTeamId(teamId);
    setTeamDetail(null);
    setDetailError(null);
  };

  const handleCloseDetail = () => {
    setSelectedTeamId(null);
    setTeamDetail(null);
    setDetailError(null);
  };

  const formatTimer = (remainingSeconds) => {
    if (remainingSeconds === null || remainingSeconds === undefined) return '—';
    if (remainingSeconds <= 0) return '0s (Expired)';
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const formatTimeOnly = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'IN_PROGRESS':
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-sky-950/70 text-sky-400 border border-sky-800/70 flex items-center gap-1.5 w-fit">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span> In Progress
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-800/70 flex items-center gap-1.5 w-fit">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Completed
          </span>
        );
      case 'NOT_STARTED':
      default:
        return (
          <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/70 flex items-center gap-1.5 w-fit">
            <span className="w-2 h-2 rounded-full bg-slate-500"></span> Not Started
          </span>
        );
    }
  };

  const getQuestionStatusBadge = (status) => {
    switch (status) {
      case 'CORRECT':
        return (
          <span className="px-2 py-0.5 text-xs font-bold rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
            ✓ CORRECT
          </span>
        );
      case 'WRONG':
        return (
          <span className="px-2 py-0.5 text-xs font-bold rounded bg-rose-950/60 text-rose-400 border border-rose-800/60">
            ✗ WRONG
          </span>
        );
      case 'SKIPPED':
        return (
          <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-950/60 text-amber-400 border border-amber-800/60">
            ↷ SKIPPED
          </span>
        );
      case 'CURRENT':
        return (
          <span className="px-2 py-0.5 text-xs font-bold rounded bg-sky-950/60 text-sky-300 border border-sky-800/60 animate-pulse">
            ⏳ CURRENT
          </span>
        );
      case 'UNANSWERED':
      default:
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-800 text-slate-400 border border-slate-700">
            ○ UNANSWERED
          </span>
        );
    }
  };

  // Filter and search
  const filteredTeams = (overview?.teams || []).filter((team) => {
    if (statusFilter !== 'ALL' && team.status !== statusFilter) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = team.teamName?.toLowerCase().includes(q);
      const matchCollege = team.college?.toLowerCase().includes(q);
      const matchDept = team.department?.toLowerCase().includes(q);
      return matchName || matchCollege || matchDept;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <span>📡</span> Live Operational Monitoring
            </h2>
            {overview?.event && (
              <span className="px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider rounded border bg-emerald-950/60 text-emerald-300 border-emerald-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                LIVE
              </span>
            )}
            {notLiveInfo && (
              <span className="px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider rounded border bg-slate-800 text-slate-300 border-slate-700">
                {notLiveInfo.status}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {overview?.event ? (
              <>
                Event: <span className="text-slate-300 font-medium">{overview.event.name}</span>
                {' • '}Questions: <span className="text-slate-300 font-medium">{overview.totalQuestions}</span>
                {' • '}Server Time (PostgreSQL):{' '}
                <span className="text-sky-400 font-mono">{formatTimeOnly(overview.serverTime)}</span>
                {' • '}Auto-refreshing every 10s
              </>
            ) : notLiveInfo ? (
              notLiveInfo.message
            ) : (
              'Connecting to live event operational monitor...'
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchOverview(true)}
          disabled={loading || isFetchingOverviewRef.current}
          className="px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg transition flex items-center gap-1.5 self-end sm:self-center disabled:opacity-50"
        >
          <span className={loading ? 'animate-spin' : ''}>↻</span> Refresh Now
        </button>
      </div>

      {/* Non-Live Fallback Notice */}
      {notLiveInfo && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center shadow-lg">
          <div className="text-4xl mb-3">📡</div>
          <h3 className="text-lg font-bold text-slate-200 mb-2">Live Monitoring Inactive</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-4">
            {notLiveInfo.status === 'READY'
              ? 'The event has not started yet. Live monitoring will activate automatically once the event is marked LIVE.'
              : 'The event has ended. Live operational monitoring is disabled for ended events. Use the official Leaderboard tab to view final standings.'}
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-mono">
            Status: {notLiveInfo.status}
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-sm flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs text-rose-400 hover:text-rose-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Operational Stats Grid */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400 font-medium block">Approved Teams</span>
            <span className="text-2xl font-bold text-slate-100 mt-1 block">
              {overview.stats?.totalApprovedTeams ?? 0}
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-sky-400 font-medium block">In Progress</span>
            <span className="text-2xl font-bold text-sky-300 mt-1 block">
              {overview.stats?.inProgressCount ?? 0}
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-emerald-400 font-medium block">Completed</span>
            <span className="text-2xl font-bold text-emerald-300 mt-1 block">
              {overview.stats?.completedCount ?? 0}
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-indigo-400 font-medium block">Completion Rate</span>
            <span className="text-2xl font-bold text-indigo-300 mt-1 block">
              {overview.stats?.completionPercentage ?? 0}%
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-amber-400 font-medium block">Highest Score</span>
            <span className="text-2xl font-bold text-amber-300 mt-1 block">
              {overview.stats?.highestScore ?? 0}
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
            <span className="text-xs text-slate-400 font-medium block">Avg Completed Score</span>
            <span className="text-2xl font-bold text-slate-200 mt-1 block">
              {overview.stats?.averageCompletedScore ?? 0}
            </span>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      {overview && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {['ALL', 'IN_PROGRESS', 'NOT_STARTED', 'COMPLETED'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                  statusFilter === tab
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-750'
                }`}
              >
                {tab === 'ALL'
                  ? `All Teams (${overview.stats?.totalApprovedTeams ?? 0})`
                  : tab === 'IN_PROGRESS'
                  ? `In Progress (${overview.stats?.inProgressCount ?? 0})`
                  : tab === 'NOT_STARTED'
                  ? `Not Started (${overview.stats?.notStartedCount ?? 0})`
                  : `Completed (${overview.stats?.completedCount ?? 0})`}
              </button>
            ))}
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Search team or college..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64 px-3 py-1.5 pl-8 text-xs bg-slate-950 border border-slate-750 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
            <span className="absolute left-2.5 top-2 text-slate-500 text-xs">🔍</span>
          </div>
        </div>
      )}

      {/* Live Operational Teams Table */}
      {overview && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4">College / Dept</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Progress</th>
                  <th className="py-3 px-4">Current Q#</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Active Timer</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTeams.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-slate-500">
                      No teams match the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredTeams.map((t) => {
                    const isUrgentTimer =
                      t.status === 'IN_PROGRESS' &&
                      t.remainingSeconds !== null &&
                      t.remainingSeconds <= 5;

                    return (
                      <tr
                        key={t.teamId}
                        onClick={() => handleOpenDetail(t.teamId)}
                        className="hover:bg-slate-800/40 transition cursor-pointer"
                      >
                        <td className="py-3 px-4 font-semibold text-slate-200">
                          {t.teamName}
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {t.college} {t.department ? `(${t.department})` : ''}
                        </td>
                        <td className="py-3 px-4">{getStatusBadge(t.status)}</td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-300">
                          {t.progress}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {t.currentQuestionNumber ? `Q${t.currentQuestionNumber}` : '—'}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-100">
                          {t.score}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {t.status === 'IN_PROGRESS' ? (
                            <span
                              className={`px-2 py-0.5 rounded font-bold ${
                                isUrgentTimer
                                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800 animate-pulse'
                                  : 'bg-slate-800 text-sky-300'
                              }`}
                            >
                              ⏱ {formatTimer(t.remainingSeconds)}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetail(t.teamId);
                            }}
                            className="px-2.5 py-1 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-950/40 hover:bg-blue-900/50 border border-blue-800/50 rounded transition"
                          >
                            Inspect ↗
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Team Detail Modal / Drawer */}
      {selectedTeamId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-950/60">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-slate-100">
                    {teamDetail?.team?.teamName || 'Team Progress Inspection'}
                  </h3>
                  {teamDetail?.team && getStatusBadge(teamDetail.team.status)}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {teamDetail?.team?.college}{' '}
                  {teamDetail?.team?.department ? `• ${teamDetail.team.department}` : ''}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseDetail}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition text-lg"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {detailLoading && !teamDetail && (
                <div className="py-12 text-center text-slate-400 text-sm">
                  Loading operational inspection...
                </div>
              )}

              {detailError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs rounded-lg">
                  ⚠️ {detailError}
                </div>
              )}

              {teamDetail?.team && (
                <>
                  {/* Summary Bar */}
                  <div className="grid grid-cols-4 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                    <div>
                      <span className="text-xs text-slate-500 block">Score</span>
                      <span className="text-lg font-bold text-slate-100 block">
                        {teamDetail.team.score}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Progress</span>
                      <span className="text-lg font-bold text-slate-100 block">
                        {teamDetail.team.progress}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Current Q#</span>
                      <span className="text-lg font-bold text-sky-400 block">
                        {teamDetail.team.currentQuestionNumber
                          ? `Q${teamDetail.team.currentQuestionNumber}`
                          : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Active Timer</span>
                      <span
                        className={`text-lg font-bold block ${
                          teamDetail.team.remainingSeconds !== null &&
                          teamDetail.team.remainingSeconds <= 5
                            ? 'text-rose-400 animate-pulse'
                            : 'text-sky-300'
                        }`}
                      >
                        {formatTimer(teamDetail.team.remainingSeconds)}
                      </span>
                    </div>
                  </div>

                  {/* Questions Matrix */}
                  <div>
                    <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-2">
                      Per-Question Breakdown
                    </h4>
                    <div className="border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">Order</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Marks</th>
                            <th className="py-2.5 px-3">Answered At</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {(teamDetail.questions || []).map((q) => (
                            <tr key={q.questionOrder} className="hover:bg-slate-800/20">
                              <td className="py-2.5 px-3 font-mono font-medium text-slate-400">
                                Question {q.questionOrder}
                              </td>
                              <td className="py-2.5 px-3">{getQuestionStatusBadge(q.status)}</td>
                              <td className="py-2.5 px-3 font-semibold">
                                {q.marksAwarded !== null ? (
                                  <span
                                    className={
                                      q.marksAwarded > 0
                                        ? 'text-emerald-400'
                                        : q.marksAwarded < 0
                                        ? 'text-rose-400'
                                        : 'text-slate-400'
                                    }
                                  >
                                    {q.marksAwarded > 0 ? `+${q.marksAwarded}` : q.marksAwarded}
                                  </span>
                                ) : (
                                  <span className="text-slate-600">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-slate-400 font-mono">
                                {formatTimeOnly(q.answeredAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">
                Auto-refreshing every 5s • Server Time:{' '}
                {formatTimeOnly(teamDetail?.serverTime)}
              </span>
              <button
                type="button"
                onClick={handleCloseDetail}
                className="px-4 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
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
