import { useState, useEffect, useCallback } from 'react';
import {
  getRegistrations,
  getRegistrationStats,
  getRegistrationDetail,
  approveRegistration,
  rejectRegistration,
  downloadPaymentProof,
  startEvent,
  endEvent,
} from '../services/adminService';
import QuestionManagement from './QuestionManagement';
import AdminLeaderboard from './AdminLeaderboard';
import AdminMonitoring from './AdminMonitoring';

export default function AdminDashboard({ session, onLogout }) {
  // Navigation section: 'registrations' | 'questions' | 'leaderboard'
  const [activeSection, setActiveSection] = useState('registrations');

  // Stats state
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  // Registrations table state
  const [registrations, setRegistrations] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [tableLoading, setTableLoading] = useState(false);

  // Detail modal state
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [downloadingProof, setDownloadingProof] = useState(false);

  // Action status message state
  const [actionMessage, setActionMessage] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Load stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await getRegistrationStats();
      if (res?.success && res?.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Load registrations
  const fetchRegistrations = useCallback(
    async (page = pagination.page, limit = pagination.limit, status = statusFilter, search = searchTerm) => {
      try {
        setTableLoading(true);
        const res = await getRegistrations({ page, limit, status, search });
        if (res?.success) {
          setRegistrations(res.registrations || []);
          if (res.pagination) {
            setPagination(res.pagination);
          }
        }
      } catch (err) {
        setActionMessage({
          type: 'error',
          text: err.message || 'Failed to fetch team registrations.',
        });
      } finally {
        setTableLoading(false);
      }
    },
    [pagination.page, pagination.limit, statusFilter, searchTerm]
  );

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchRegistrations(1, 10, statusFilter, searchTerm);
  }, []);

  // Handle filter changes
  const handleStatusFilterChange = (newStatus) => {
    setStatusFilter(newStatus);
    fetchRegistrations(1, pagination.limit, newStatus, searchTerm);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchRegistrations(1, pagination.limit, statusFilter, searchTerm);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    fetchRegistrations(newPage, pagination.limit, statusFilter, searchTerm);
  };

  // View Details
  const handleViewDetail = async (teamId) => {
    try {
      setDetailLoading(true);
      const res = await getRegistrationDetail(teamId);
      if (res?.success && res?.registration) {
        setSelectedTeam(res.registration);
      }
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to fetch team details.',
      });
    } finally {
      setDetailLoading(false);
    }
  };

  // Approve Team
  const handleApprove = async (teamId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to APPROVE this team registration?')) return;

    setActionLoadingId(teamId);
    setActionMessage(null);

    try {
      const res = await approveRegistration(teamId);
      setActionMessage({
        type: 'success',
        text: res.message || 'Registration approved successfully!',
      });
      // Refresh both stats and list
      await fetchStats();
      await fetchRegistrations(pagination.page, pagination.limit, statusFilter, searchTerm);

      // If modal is open for this team, update it
      if (selectedTeam && selectedTeam.id === teamId) {
        setSelectedTeam((prev) => ({ ...prev, registrationStatus: 'APPROVED' }));
      }
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Approval failed.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Reject Team
  const handleReject = async (teamId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to REJECT this team registration?')) return;

    setActionLoadingId(teamId);
    setActionMessage(null);

    try {
      const res = await rejectRegistration(teamId);
      setActionMessage({
        type: 'success',
        text: res.message || 'Registration rejected.',
      });
      // Refresh stats and list
      await fetchStats();
      await fetchRegistrations(pagination.page, pagination.limit, statusFilter, searchTerm);

      // If modal is open for this team, update it
      if (selectedTeam && selectedTeam.id === teamId) {
        setSelectedTeam((prev) => ({ ...prev, registrationStatus: 'REJECTED' }));
      }
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Rejection failed.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Download Proof
  const handleDownloadProof = async (teamId, teamName) => {
    try {
      setDownloadingProof(true);
      const safeName = `${teamName.replace(/[^a-zA-Z0-9_-]/g, '_')}_proof`;
      await downloadPaymentProof(teamId, safeName);
    } catch (err) {
      alert(err.message || 'Failed to download payment proof file.');
    } finally {
      setDownloadingProof(false);
    }
  };

  // Event Lifecycle Handlers
  const handleStartRound1 = async () => {
    if (!window.confirm('Are you sure you want to START Round 1? This will lock question editing and make the quiz LIVE for participants.')) {
      return;
    }
    try {
      const res = await startEvent();
      setActionMessage({
        type: 'success',
        text: res.message || 'Round 1 is now LIVE!',
      });
      fetchStats();
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to start Round 1.',
      });
    }
  };

  const handleEndRound1 = async () => {
    if (!window.confirm('Are you sure you want to END Round 1? This will prevent any further quiz answers.')) {
      return;
    }
    try {
      const res = await endEvent();
      setActionMessage({
        type: 'success',
        text: res.message || 'Round 1 has ENDED.',
      });
      fetchStats();
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to end Round 1.',
      });
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Top Bar: Admin Identity & Actions */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold text-lg">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-100">Admin Control Center</h2>
              <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                ADMIN
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Logged in as <span className="text-slate-300 font-medium">{session?.user?.email}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleStartRound1}
            className="px-3.5 py-2 text-xs font-semibold text-emerald-300 bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-800/60 rounded-lg transition flex items-center gap-1.5 shadow-sm"
          >
            <span>▶</span> Start Round 1
          </button>
          <button
            type="button"
            onClick={handleEndRound1}
            className="px-3.5 py-2 text-xs font-semibold text-amber-300 bg-amber-950/50 hover:bg-amber-900/60 border border-amber-800/60 rounded-lg transition flex items-center gap-1.5 shadow-sm"
          >
            <span>⏹</span> End Round 1
          </button>
          <button
            type="button"
            onClick={() => {
              fetchStats();
              fetchRegistrations();
            }}
            className="px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg transition"
          >
            ↻
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="px-3.5 py-2 text-xs font-medium text-rose-300 bg-rose-950/30 hover:bg-rose-900/40 border border-rose-800/40 rounded-lg transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Navigation Section Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => setActiveSection('registrations')}
          className={`pb-3 px-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeSection === 'registrations'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>👥</span> Teams & Registrations
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('questions')}
          className={`pb-3 px-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeSection === 'questions'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>📝</span> Question Management
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('leaderboard')}
          className={`pb-3 px-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeSection === 'leaderboard'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>🏆</span> Leaderboard & Scoring
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('monitoring')}
          className={`pb-3 px-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeSection === 'monitoring'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>📡</span> Live Monitoring
        </button>
      </div>

      {activeSection === 'questions' && <QuestionManagement />}

      {activeSection === 'leaderboard' && <AdminLeaderboard />}

      {activeSection === 'monitoring' && <AdminMonitoring />}

      {activeSection === 'registrations' && (
        <>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-sm border flex items-center justify-between ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60'
              : 'bg-rose-950/50 text-rose-300 border-rose-800/60'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-xs underline hover:opacity-80 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Registration Stats Cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Card */}
        <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Teams</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-slate-100">
            {statsLoading ? '...' : stats.total}
          </div>
          <div className="mt-1 text-xs text-slate-500">Registered across event</div>
        </div>

        {/* Pending Card */}
        <div className="bg-amber-950/20 border border-amber-800/40 p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-300 uppercase tracking-wider">Pending Review</span>
            {stats.pending > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            )}
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-amber-300">
            {statsLoading ? '...' : stats.pending}
          </div>
          <div className="mt-1 text-xs text-amber-400/70">Awaiting verification</div>
        </div>

        {/* Approved Card */}
        <div className="bg-emerald-950/20 border border-emerald-800/40 p-4 rounded-xl">
          <div className="text-xs font-medium text-emerald-300 uppercase tracking-wider">Approved</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-emerald-300">
            {statsLoading ? '...' : stats.approved}
          </div>
          <div className="mt-1 text-xs text-emerald-400/70">Eligible for competition</div>
        </div>

        {/* Rejected Card */}
        <div className="bg-rose-950/20 border border-rose-800/40 p-4 rounded-xl">
          <div className="text-xs font-medium text-rose-300 uppercase tracking-wider">Rejected</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-rose-300">
            {statsLoading ? '...' : stats.rejected}
          </div>
          <div className="mt-1 text-xs text-rose-400/70">Declined registrations</div>
        </div>
      </section>

      {/* Main Registrations Management Panel */}
      <section className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {/* Filter and Search Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
            {[
              { label: 'All', val: '' },
              { label: 'Pending', val: 'PENDING' },
              { label: 'Approved', val: 'APPROVED' },
              { label: 'Rejected', val: 'REJECTED' },
            ].map((tab) => (
              <button
                key={tab.val}
                type="button"
                onClick={() => handleStatusFilterChange(tab.val)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  statusFilter === tab.val
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by team name or college..."
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition shrink-0"
            >
              Search
            </button>
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  fetchRegistrations(1, pagination.limit, statusFilter, '');
                }}
                className="px-2 py-1.5 text-slate-400 hover:text-slate-200 text-xs"
              >
                Clear
              </button>
            )}
          </form>
        </div>

        {/* Registrations Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Team & College</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Team Lead</th>
                <th className="py-3 px-4">Members</th>
                <th className="py-3 px-4">Payment ID</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {tableLoading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      Loading registrations...
                    </div>
                  </td>
                </tr>
              ) : registrations.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500">
                    No registrations found matching the criteria.
                  </td>
                </tr>
              ) : (
                registrations.map((reg) => (
                  <tr
                    key={reg.id}
                    onClick={() => handleViewDetail(reg.id)}
                    className="hover:bg-slate-800/40 cursor-pointer transition group"
                  >
                    {/* Team & College */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-200 group-hover:text-indigo-300 transition">
                        {reg.teamName}
                      </div>
                      <div className="text-[11px] text-slate-400">{reg.college}</div>
                    </td>

                    {/* Department */}
                    <td className="py-3.5 px-4 text-slate-300">
                      {reg.department || '—'}
                    </td>

                    {/* Team Lead */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-200">{reg.leadName || '—'}</div>
                      <div className="text-[11px] text-slate-400">{reg.leadEmail || '—'}</div>
                    </td>

                    {/* Member Count */}
                    <td className="py-3.5 px-4 text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {reg.memberCount} members
                      </span>
                    </td>

                    {/* Payment ID */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                      {reg.paymentId || '—'}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      {reg.registrationStatus === 'PENDING' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          ⏳ PENDING
                        </span>
                      )}
                      {reg.registrationStatus === 'APPROVED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          ✓ APPROVED
                        </span>
                      )}
                      {reg.registrationStatus === 'REJECTED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          ✕ REJECTED
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleViewDetail(reg.id)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
                        >
                          Details
                        </button>

                        {reg.registrationStatus === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              disabled={actionLoadingId === reg.id}
                              onClick={(e) => handleApprove(reg.id, e)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-medium transition"
                            >
                              {actionLoadingId === reg.id ? '...' : 'Approve'}
                            </button>
                            <button
                              type="button"
                              disabled={actionLoadingId === reg.id}
                              onClick={(e) => handleReject(reg.id, e)}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded font-medium transition"
                            >
                              {actionLoadingId === reg.id ? '...' : 'Reject'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            Showing <span className="font-semibold text-slate-200">{registrations.length}</span> of{' '}
            <span className="font-semibold text-slate-200">{pagination.total}</span> registrations
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1 || tableLoading}
              onClick={() => handlePageChange(pagination.page - 1)}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-750 disabled:opacity-40 text-slate-300 rounded border border-slate-700 transition"
            >
              Previous
            </button>
            <span className="px-2 text-slate-300">
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages || tableLoading}
              onClick={() => handlePageChange(pagination.page + 1)}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-750 disabled:opacity-40 text-slate-300 rounded border border-slate-700 transition"
            >
              Next
            </button>
          </div>
        </div>
      </section>
        </>
      )}

      {/* Team Details Modal */}
      {selectedTeam && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                  Registration Detail
                </span>
                <h3 className="text-xl font-bold text-slate-100 mt-1">{selectedTeam.teamName}</h3>
                <p className="text-xs text-slate-400">
                  {selectedTeam.college} • {selectedTeam.department}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {selectedTeam.registrationStatus === 'PENDING' && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    PENDING
                  </span>
                )}
                {selectedTeam.registrationStatus === 'APPROVED' && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    APPROVED
                  </span>
                )}
                {selectedTeam.registrationStatus === 'REJECTED' && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                    REJECTED
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedTeam(null)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-750 flex items-center justify-center text-slate-400 hover:text-slate-200 ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Payment & Proof Verification Card */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Payment Verification
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Transaction Reference / Payment ID:</span>
                  <span className="font-mono text-slate-200 font-semibold">{selectedTeam.paymentId || 'None'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Payment Proof File:</span>
                  <span className="text-slate-200">
                    {selectedTeam.hasPaymentProof ? '✓ Verified on disk' : '✕ Missing or Not Uploaded'}
                  </span>
                </div>
              </div>

              {selectedTeam.hasPaymentProof && (
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={downloadingProof}
                    onClick={() => handleDownloadProof(selectedTeam.id, selectedTeam.teamName)}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition"
                  >
                    <span>📥</span>
                    {downloadingProof ? 'Downloading...' : 'Download / View Payment Proof'}
                  </button>
                </div>
              )}
            </div>

            {/* Team Members List */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Team Members ({selectedTeam.members?.length || 0})
              </h4>
              <div className="space-y-2">
                {selectedTeam.members?.map((member, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200 text-sm">{member.name}</span>
                        {member.role === 'TEAM_LEAD' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            LEAD
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                            MEMBER
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400 mt-0.5">{member.email}</div>
                    </div>

                    <div className="text-right sm:border-l sm:border-slate-850 sm:pl-4">
                      <div className="text-slate-300 font-mono">{member.registerNumber}</div>
                      <div className="text-slate-500 text-[11px]">{member.phone}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedTeam(null)}
                className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition"
              >
                Close
              </button>

              {selectedTeam.registrationStatus === 'PENDING' && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    disabled={actionLoadingId === selectedTeam.id}
                    onClick={() => handleReject(selectedTeam.id)}
                    className="flex-1 sm:flex-none px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition"
                  >
                    Reject Registration
                  </button>
                  <button
                    type="button"
                    disabled={actionLoadingId === selectedTeam.id}
                    onClick={() => handleApprove(selectedTeam.id)}
                    className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition"
                  >
                    Approve Registration
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
