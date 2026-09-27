import { useState, useEffect, useCallback } from 'react';
import { getAdminLeaderboard, downloadLeaderboardCsv } from '../../services/adminService';

/**
 * AdminLeaderboard — Official admin-only competition leaderboard.
 * Displays authoritative server-calculated standings (DO NOT sort/rank on client).
 */
export default function AdminLeaderboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'COMPLETED' | 'IN_PROGRESS'

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminLeaderboard();
      if (res?.success) {
        setData(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch authoritative leaderboard.');
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

  const formatTimestamp = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const formatDuration = (seconds) => {
    if (seconds === null || seconds === undefined) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const eventStatus = data?.event?.status || 'READY';
  const leaderboard = data?.leaderboard || [];

  // Filter without modifying ranking order
  const filteredList = leaderboard.filter((item) => {
    if (filter === 'COMPLETED') return item.status === 'COMPLETED';
    if (filter === 'IN_PROGRESS') return item.status === 'IN_PROGRESS';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0F172A] border border-slate-800 p-5 rounded-2xl shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
              <span>🏆</span> Official Leaderboard
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase">
              STATUS: {eventStatus}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative Cryptic Tide scoring standings calculated directly by the backend engine.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={fetchLeaderboard}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 disabled:opacity-50 rounded-xl border border-slate-700 transition"
          >
            ↻ Refresh
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={downloadingCsv || loading || leaderboard.length === 0}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl transition shadow-xs flex items-center gap-1.5"
          >
            <span>⬇️</span>
            <span>{downloadingCsv ? 'Exporting…' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs sm:text-sm flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* READY Empty State */}
      {eventStatus === 'READY' && leaderboard.length === 0 && (
        <div className="p-10 rounded-2xl bg-[#0F172A] border border-slate-800 text-center space-y-3 shadow-lg">
          <div className="text-3xl">⏳</div>
          <h3 className="text-base font-bold text-slate-100">Cryptic Tide Has Not Started Yet</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            The leaderboard will become active once the competition is LIVE and teams submit quiz answers.
          </p>
          <div className="pt-2">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-900 border border-slate-800 text-gold-300">
              STATE: READY
            </span>
          </div>
        </div>
      )}

      {/* Leaderboard Table (When data exists or LIVE/ENDED) */}
      {(leaderboard.length > 0 || eventStatus !== 'READY') && (
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl overflow-hidden shadow-lg space-y-0">
          {/* Status Filter Bar */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              {[
                { label: 'All Standings', val: 'ALL' },
                { label: 'Completed Only', val: 'COMPLETED' },
                { label: 'In Progress Only', val: 'IN_PROGRESS' },
              ].map((f) => (
                <button
                  key={f.val}
                  type="button"
                  onClick={() => setFilter(f.val)}
                  className={`px-3 py-1 font-semibold rounded-md transition ${
                    filter === f.val
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="text-xs font-mono text-slate-400">
              Total Ranked: <strong className="text-slate-200">{filteredList.length}</strong>
            </div>
          </div>

          {/* Standings Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 font-semibold text-center w-16">Rank</th>
                  <th className="py-3.5 px-4 font-semibold">Team Name</th>
                  <th className="py-3.5 px-4 font-semibold font-mono text-right">Score</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                  <th className="py-3.5 px-4 font-semibold font-mono">Completed At</th>
                  <th className="py-3.5 px-4 font-semibold font-mono">Total Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        <span>Loading authoritative leaderboard…</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredList.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-500">
                      No teams match the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredList.map((item) => {
                    const isPodium = item.rank <= 3;
                    return (
                      <tr
                        key={item.teamId || item.rank}
                        className={`hover:bg-slate-850/50 transition ${
                          item.rank === 1
                            ? 'bg-amber-500/5'
                            : item.rank === 2
                            ? 'bg-slate-400/5'
                            : item.rank === 3
                            ? 'bg-amber-700/5'
                            : ''
                        }`}
                      >
                        {/* Rank Badge */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-mono font-black text-xs ${
                              item.rank === 1
                                ? 'bg-amber-400 text-charcoal-950 shadow-sm'
                                : item.rank === 2
                                ? 'bg-slate-300 text-charcoal-950 shadow-sm'
                                : item.rank === 3
                                ? 'bg-amber-700 text-white shadow-sm'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {item.rank}
                          </span>
                        </td>

                        {/* Team Name */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-100 text-sm">
                            {item.teamName}
                          </div>
                          {item.college && (
                            <div className="text-[11px] text-slate-400">{item.college}</div>
                          )}
                        </td>

                        {/* Score */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-sm">
                          <span
                            className={
                              item.score > 0
                                ? 'text-emerald-400'
                                : item.score < 0
                                ? 'text-rose-400'
                                : 'text-slate-300'
                            }
                          >
                            {item.score}
                          </span>
                          <span className="text-[11px] text-slate-500 ml-1">pts</span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          {item.status === 'COMPLETED' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              COMPLETED
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              IN PROGRESS
                            </span>
                          )}
                        </td>

                        {/* Completed At */}
                        <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                          {formatTimestamp(item.completedAt)}
                        </td>

                        {/* Total Duration */}
                        <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                          {formatDuration(item.durationSeconds ?? item.totalTimeTakenSeconds)}
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
    </div>
  );
}
