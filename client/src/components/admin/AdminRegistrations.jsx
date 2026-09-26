import { useState, useEffect, useCallback } from 'react';
import {
  getRegistrations,
  getRegistrationDetail,
  approveRegistration,
  rejectRegistration,
} from '../../services/adminService';
import AdminConfirmDialog from './AdminConfirmDialog';

/**
 * AdminRegistrations — Registrations table with search, filter, approve, reject, and details view.
 * No payment fields displayed (Round 1 is free).
 */
export default function AdminRegistrations() {
  const [registrations, setRegistrations] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Detail Modal State
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Action / Feedback State
  const [actionMessage, setActionMessage] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: null, // 'approve' | 'reject'
    teamId: null,
    teamName: '',
  });

  const fetchList = useCallback(
    async (page = pagination.page, limit = pagination.limit, status = statusFilter, search = searchTerm) => {
      try {
        setLoading(true);
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
        setLoading(false);
      }
    },
    [pagination.page, pagination.limit, statusFilter, searchTerm]
  );

  useEffect(() => {
    fetchList(1, 10, statusFilter, searchTerm);
  }, []);

  const handleStatusFilter = (val) => {
    setStatusFilter(val);
    fetchList(1, pagination.limit, val, searchTerm);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchList(1, pagination.limit, statusFilter, searchTerm);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    fetchList(newPage, pagination.limit, statusFilter, searchTerm);
  };

  // Open Details Modal
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

  // Trigger Confirmation Dialog
  const openConfirm = (type, teamId, teamName, e) => {
    if (e) e.stopPropagation();
    setConfirmDialog({
      isOpen: true,
      type,
      teamId,
      teamName,
    });
  };

  // Execute Approve / Reject
  const handleExecuteAction = async () => {
    const { type, teamId } = confirmDialog;
    if (!type || !teamId) return;

    setActionLoadingId(teamId);
    setActionMessage(null);

    try {
      if (type === 'approve') {
        const res = await approveRegistration(teamId);
        setActionMessage({
          type: 'success',
          text: res.message || 'Team registration successfully approved!',
        });
      } else if (type === 'reject') {
        const res = await rejectRegistration(teamId);
        setActionMessage({
          type: 'success',
          text: res.message || 'Team registration rejected.',
        });
      }

      await fetchList(pagination.page, pagination.limit, statusFilter, searchTerm);

      if (selectedTeam && selectedTeam.id === teamId) {
        setSelectedTeam((prev) => ({
          ...prev,
          registrationStatus: type === 'approve' ? 'APPROVED' : 'REJECTED',
        }));
      }
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.message || `Failed to ${type} registration.`,
      });
    } finally {
      setActionLoadingId(null);
      setConfirmDialog({ isOpen: false, type: null, teamId: null, teamName: '' });
    }
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
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
            <span>👥</span> Team Registrations
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Review submitted teams, verify roster eligibility, and grant competition access.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchList()}
          disabled={loading}
          className="px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 disabled:opacity-50 rounded-xl border border-slate-700 transition flex items-center gap-1.5 shadow-xs"
        >
          <span>↻</span> Refresh List
        </button>
      </div>

      {/* Action Notification */}
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

      {/* Filter and Search Bar */}
      <div className="bg-[#0F172A] border border-slate-800 p-4 rounded-xl shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/90 p-1 rounded-lg border border-slate-800">
          {[
            { label: 'All', val: '' },
            { label: 'Pending', val: 'PENDING' },
            { label: 'Approved', val: 'APPROVED' },
            { label: 'Rejected', val: 'REJECTED' },
          ].map((tab) => (
            <button
              key={tab.val}
              type="button"
              onClick={() => handleStatusFilter(tab.val)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                statusFilter === tab.val
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by team name or college…"
            className="w-full px-3.5 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition shrink-0"
          >
            Search
          </button>
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                fetchList(1, pagination.limit, statusFilter, '');
              }}
              className="px-2 py-1.5 text-slate-400 hover:text-slate-200 text-xs"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Registrations Table Container */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Team Name</th>
                <th className="py-3.5 px-4 font-semibold">Team Lead</th>
                <th className="py-3.5 px-4 font-semibold">Lead Email</th>
                <th className="py-3.5 px-4 font-semibold">College</th>
                <th className="py-3.5 px-4 font-semibold">Department</th>
                <th className="py-3.5 px-4 font-semibold">Members</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold">Registered At</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <span>Loading registrations…</span>
                    </div>
                  </td>
                </tr>
              ) : registrations.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-500">
                    No registrations found matching the specified criteria.
                  </td>
                </tr>
              ) : (
                registrations.map((reg) => (
                  <tr
                    key={reg.id}
                    onClick={() => handleViewDetail(reg.id)}
                    className="hover:bg-slate-850/50 cursor-pointer transition"
                  >
                    {/* Team Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-100">{reg.teamName}</div>
                    </td>

                    {/* Team Lead */}
                    <td className="py-3.5 px-4 text-slate-200 font-medium">
                      {reg.leadName || '—'}
                    </td>

                    {/* Lead Email */}
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                      {reg.leadEmail || '—'}
                    </td>

                    {/* College */}
                    <td className="py-3.5 px-4 text-slate-300">
                      {reg.college || '—'}
                    </td>

                    {/* Department */}
                    <td className="py-3.5 px-4 text-slate-300">
                      {reg.department || '—'}
                    </td>

                    {/* Member Count */}
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700 font-mono text-[11px]">
                        {reg.memberCount} members
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      {reg.registrationStatus === 'PENDING' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          PENDING
                        </span>
                      )}
                      {reg.registrationStatus === 'APPROVED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          APPROVED
                        </span>
                      )}
                      {reg.registrationStatus === 'REJECTED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                          REJECTED
                        </span>
                      )}
                    </td>

                    {/* Registered At */}
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                      {formatDateTime(reg.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div
                        className="inline-flex items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleViewDetail(reg.id)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-xs transition"
                        >
                          Details
                        </button>

                        {reg.registrationStatus === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              disabled={actionLoadingId === reg.id}
                              onClick={(e) => openConfirm('approve', reg.id, reg.teamName, e)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={actionLoadingId === reg.id}
                              onClick={(e) => openConfirm('reject', reg.id, reg.teamName, e)}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition"
                            >
                              Reject
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
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            Showing <strong className="text-slate-200">{registrations.length}</strong> of{' '}
            <strong className="text-slate-200">{pagination.total}</strong> registered teams
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1 || loading}
              onClick={() => handlePageChange(pagination.page - 1)}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-750 disabled:opacity-40 text-slate-300 rounded-lg border border-slate-700 transition"
            >
              Previous
            </button>
            <span className="px-2 text-slate-300 font-mono">
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => handlePageChange(pagination.page + 1)}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-750 disabled:opacity-40 text-slate-300 rounded-lg border border-slate-700 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Team Details Modal */}
      {selectedTeam && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-fadeIn">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400">
                  Registration Details
                </span>
                <h3 className="text-xl font-bold text-slate-100 mt-1">{selectedTeam.teamName}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedTeam.college} • {selectedTeam.department}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {selectedTeam.registrationStatus === 'PENDING' && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    PENDING
                  </span>
                )}
                {selectedTeam.registrationStatus === 'APPROVED' && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    APPROVED
                  </span>
                )}
                {selectedTeam.registrationStatus === 'REJECTED' && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                    REJECTED
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedTeam(null)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-100 ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Team Members List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-400">
                Team Roster ({selectedTeam.members?.length || 0} Members)
              </h4>
              <div className="space-y-2">
                {selectedTeam.members?.map((member, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-sm">{member.name}</span>
                        {member.role === 'TEAM_LEAD' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                            LEAD
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                            MEMBER
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400 font-mono text-[11px] mt-0.5">{member.email}</div>
                    </div>

                    <div className="text-left sm:text-right sm:border-l sm:border-slate-800 sm:pl-4">
                      <div className="text-slate-200 font-mono text-[11px]">
                        Reg #: {member.registerNumber}
                      </div>
                      <div className="text-slate-500 text-[11px] font-mono">Phone: {member.phone}</div>
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
                className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition"
              >
                Close
              </button>

              {selectedTeam.registrationStatus === 'PENDING' && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    disabled={actionLoadingId === selectedTeam.id}
                    onClick={() => openConfirm('reject', selectedTeam.id, selectedTeam.teamName)}
                    className="flex-1 sm:flex-none px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition"
                  >
                    Reject Registration
                  </button>
                  <button
                    type="button"
                    disabled={actionLoadingId === selectedTeam.id}
                    onClick={() => openConfirm('approve', selectedTeam.id, selectedTeam.teamName)}
                    className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition"
                  >
                    Approve Registration
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <AdminConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={
          confirmDialog.type === 'approve'
            ? `Approve Team "${confirmDialog.teamName}"?`
            : `Reject Team "${confirmDialog.teamName}"?`
        }
        message={
          confirmDialog.type === 'approve'
            ? `Are you sure you want to approve "${confirmDialog.teamName}"? This team will become eligible to participate in Round 1.`
            : `Are you sure you want to reject "${confirmDialog.teamName}"? The team will not be able to participate in Round 1.`
        }
        confirmText={confirmDialog.type === 'approve' ? 'Yes, Approve' : 'Yes, Reject'}
        isDanger={confirmDialog.type === 'reject'}
        loading={actionLoadingId !== null}
        onConfirm={handleExecuteAction}
        onCancel={() => setConfirmDialog({ isOpen: false, type: null, teamId: null, teamName: '' })}
      />
    </div>
  );
}
