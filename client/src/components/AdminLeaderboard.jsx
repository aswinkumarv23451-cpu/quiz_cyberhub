import { useState, useEffect, useCallback } from 'react';
import { getAdminLeaderboard, downloadLeaderboardCsv } from '../services/adminService';

export default function AdminLeaderboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED'

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminLeaderboard();
      if (res?.success) {
        setData(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch leaderboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const handleDownloadCsv = async () => {
    try {
      setDownloadingCsv(true);
      await downloadLeaderboardCsv(data?.event?.id);
    } catch (err) {
      alert(err.message || 'Failed to download leaderboard CSV.');
    } finally {
      setDownloadingCsv(false);
    }
  };

  const formatDuration = (seconds) => {
    if (seconds === null || seconds === undefined) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const formatTimestamp = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const getRankBadge = (rank) => {
    if (rank === 1) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 font-black border border-amber-400/40 text-sm shadow-sm">
          🥇 1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300/20 text-slate-200 font-black border border-slate-300/40 text-sm shadow-sm">
          🥈 2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700/20 text-amber-500 font-black border border-amber-600/40 text-sm shadow-sm">
          🥉 3
        </span>
      );
    }
    if (rank) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-800 text-slate-300 font-bold border border-slate-700 text-xs">
          #{rank}
        </span>
      );
    }
    return <span className="text-slate-600 font-semibold">—</span>;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 flex items-center gap-1 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Completed
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-sky-950/60 text-sky-400 border border-sky-800/60 flex items-center gap-1 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span> In Progress
          </span>
        );
      case 'NOT_STARTED':
      default:
        return (
          <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/60 flex items-center gap-1 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Not Started
          </span>
        );
    }
  };

  const filteredLeaderboard = (data?.leaderboard || []).filter((item) => {
    if (filter === 'COMPLETED') return item.completionStatus === 'COMPLETED';
    if (filter === 'IN_PROGRESS') return item.completionStatus === 'IN_PROGRESS';
    if (filter === 'NOT_STARTED') return item.completionStatus === 'NOT_STARTED';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <span>🏆</span> Round 1 Leaderboard
            </h2>
            {data?.event && (
              <span
                className={`px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider rounded border ${
                  data.event.status === 'LIVE'
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                    : data.event.status === 'ENDED'
                    ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {data.event.status}
              </span>
            )}
            {data?.isFinal && (
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                FINAL STANDINGS
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Event: <span className="text-slate-300 font-medium">{data?.event?.name || 'Round 1'}</span>
            {' • '}Correct: <span className="text-emerald-400">+{data?.event?.correctMarks ?? 10}</span>
            {' • '}Wrong: <span className="text-rose-400">{data?.event?.wrongMarks ?? -5}</span>
            {' • '}Skip: <span className="text-amber-400">{data?.event?.skipMarks ?? -10}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={downloadingCsv}
            className="px-3.5 py-2 text-xs font-semibold text-indigo-300 bg-indigo-950/50 hover:bg-indigo-900/60 border border-indigo-800/60 rounded-lg transition flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
          >
            <span>📥</span> {downloadingCsv ? 'Downloading...' : 'Export CSV'}
          </button>
          <button
            type="button"
            onClick={fetchLeaderboard}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <span className={loading ? 'animate-spin' : ''}>↻</span> Refresh
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-sm flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button
            type="button"
            onClick={fetchLeaderboard}
            className="text-xs underline hover:text-rose-200 ml-4 font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* High-Level Stat Cards */}
      {data?.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-sm">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Approved Teams</span>
            <div className="text-2xl font-black text-slate-100 mt-1">{data.stats.totalApprovedTeams}</div>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-sm">
            <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Completed</span>
            <div className="text-2xl font-black text-emerald-300 mt-1">{data.stats.completedCount}</div>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-sm">
            <span className="text-xs font-medium text-sky-400 uppercase tracking-wider">In Progress</span>
            <div className="text-2xl font-black text-sky-300 mt-1">{data.stats.inProgressCount}</div>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-sm">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Not Started</span>
            <div className="text-2xl font-black text-slate-400 mt-1">{data.stats.notStartedCount}</div>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-sm col-span-2 sm:col-span-1">
            <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">Top Score</span>
            <div className="text-2xl font-black text-amber-300 mt-1">
              {data.stats.topScore !== null ? `${data.stats.topScore} pts` : '—'}
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
            filter === 'ALL'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          All Teams ({data?.leaderboard?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setFilter('COMPLETED')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
            filter === 'COMPLETED'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Completed Ranked ({data?.stats?.completedCount || 0})
        </button>
        <button
          type="button"
          onClick={() => setFilter('IN_PROGRESS')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
            filter === 'IN_PROGRESS'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          In Progress ({data?.stats?.inProgressCount || 0})
        </button>
        <button
          type="button"
          onClick={() => setFilter('NOT_STARTED')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
            filter === 'NOT_STARTED'
              ? 'border-slate-400 text-slate-300'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          Not Started ({data?.stats?.notStartedCount || 0})
        </button>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {loading && !data ? (
          <div className="p-12 text-center text-slate-400">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mb-3"></div>
            <p className="text-sm">Loading official standings...</p>
          </div>
        ) : filteredLeaderboard.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-sm">{data?.message || 'No teams found matching the selected filter.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 w-16 text-center">Rank</th>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4 text-center">Score</th>
                  <th className="py-3 px-4 text-center">Answer Breakdown</th>
                  <th className="py-3 px-4 text-center">Duration</th>
                  <th className="py-3 px-4 text-center">Finished At</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLeaderboard.map((team) => (
                  <tr
                    key={team.teamId}
                    className={`hover:bg-slate-800/40 transition ${
                      team.rank === 1
                        ? 'bg-amber-950/10'
                        : team.rank === 2
                        ? 'bg-slate-800/20'
                        : team.rank === 3
                        ? 'bg-amber-950/5'
                        : ''
                    }`}
                  >
                    <td className="py-3 px-4 text-center font-bold">{getRankBadge(team.rank)}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-100">{team.teamName}</div>
                      <div className="text-xs text-slate-400">
                        {team.college} • {team.department}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded font-black text-sm ${
                          team.score > 0
                            ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/50'
                            : team.score < 0
                            ? 'bg-rose-950/50 text-rose-300 border border-rose-800/50'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {team.score} pts
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-xs font-semibold">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-800/40" title="Correct">
                          ✓ {team.correctCount}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-rose-950/50 text-rose-400 border border-rose-800/40" title="Wrong">
                          ✗ {team.wrongCount}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-950/50 text-amber-400 border border-amber-800/40" title="Skipped">
                          ↷ {team.skippedCount}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-slate-300 font-mono">
                      {formatDuration(team.durationSeconds)}
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-slate-400 font-mono">
                      {formatTimestamp(team.completedAt)}
                    </td>
                    <td className="py-3 px-4 text-center">{getStatusBadge(team.completionStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
