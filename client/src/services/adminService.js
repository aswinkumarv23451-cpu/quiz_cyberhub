import { apiClient } from './apiClient.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

/**
 * Retrieves paginated list of team registrations with optional filters.
 *
 * @param {Object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @param {string} [params.status] - 'PENDING' | 'APPROVED' | 'REJECTED'
 * @param {string} [params.search]
 * @returns {Promise<{ success: boolean, registrations: Array, pagination: Object }>}
 */
export const getRegistrations = async ({ page = 1, limit = 20, status = '', search = '' } = {}) => {
  const queryParams = new URLSearchParams();
  if (page) queryParams.append('page', page.toString());
  if (limit) queryParams.append('limit', limit.toString());
  if (status) queryParams.append('status', status);
  if (search) queryParams.append('search', search);

  const qs = queryParams.toString();
  const endpoint = `/api/admin/registrations${qs ? `?${qs}` : ''}`;
  return await apiClient(endpoint);
};

/**
 * Retrieves registration breakdown statistics.
 *
 * @returns {Promise<{ success: boolean, stats: { total: number, pending: number, approved: number, rejected: number } }>}
 */
export const getRegistrationStats = async () => {
  return await apiClient('/api/admin/registrations/stats');
};

/**
 * Retrieves full details for a single registration, including all members.
 *
 * @param {string} teamId
 * @returns {Promise<{ success: boolean, registration: Object }>}
 */
export const getRegistrationDetail = async (teamId) => {
  return await apiClient(`/api/admin/registrations/${teamId}`);
};

/**
 * Approves a PENDING registration.
 *
 * @param {string} teamId
 * @returns {Promise<{ success: boolean, message: string, registrationStatus: string }>}
 */
export const approveRegistration = async (teamId) => {
  return await apiClient(`/api/admin/registrations/${teamId}/approve`, {
    method: 'POST',
  });
};

/**
 * Rejects a PENDING registration.
 *
 * @param {string} teamId
 * @returns {Promise<{ success: boolean, message: string, registrationStatus: string }>}
 */
export const rejectRegistration = async (teamId) => {
  return await apiClient(`/api/admin/registrations/${teamId}/reject`, {
    method: 'POST',
  });
};

/**
 * Downloads the payment proof file securely using authenticated credentials.
 * Triggers a browser download without exposing file paths.
 *
 * @param {string} teamId
 * @param {string} [fallbackName='payment-proof']
 * @returns {Promise<void>}
 */
export const downloadPaymentProof = async (teamId, fallbackName = 'payment-proof') => {
  const url = `${BASE_URL}/api/admin/registrations/${teamId}/proof`;
  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    let errorMsg = 'Failed to download payment proof';
    try {
      const errData = await response.json();
      if (errData.message) errorMsg = errData.message;
    } catch (_) {}
    throw new Error(errorMsg);
  }

  // Extract filename from Content-Disposition if present
  let filename = fallbackName;
  const disposition = response.headers.get('content-disposition');
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
};

/**
 * Admin: Starts Round 1 (READY -> LIVE).
 * @returns {Promise<{ success: boolean, message: string, event: Object }>}
 */
export const startEvent = async () => {
  return await apiClient('/api/admin/event/start', {
    method: 'POST',
  });
};

/**
 * Admin: Ends Round 1 (LIVE -> ENDED).
 * @returns {Promise<{ success: boolean, message: string, event: Object }>}
 */
export const endEvent = async () => {
  return await apiClient('/api/admin/event/end', {
    method: 'POST',
  });
};

/**
 * Admin: Retrieves the official Leaderboard.
 * @param {string} [eventId]
 * @returns {Promise<Object>}
 */
export const getAdminLeaderboard = async (eventId) => {
  const endpoint = eventId
    ? `/api/admin/leaderboard?eventId=${encodeURIComponent(eventId)}`
    : '/api/admin/leaderboard';
  return await apiClient(endpoint);
};

/**
 * Admin: Retrieves real-time operational monitoring overview.
 * @returns {Promise<Object>}
 */
export const getMonitoringOverview = async () => {
  return await apiClient('/api/admin/monitoring');
};

/**
 * Admin: Retrieves detailed operational monitoring for a specific team.
 * @param {string} teamId
 * @returns {Promise<Object>}
 */
export const getTeamMonitoringDetail = async (teamId) => {
  return await apiClient(`/api/admin/monitoring/team/${encodeURIComponent(teamId)}`);
};

/**
 * Admin: Downloads the official leaderboard as a CSV file.
 * @param {string} [eventId]
 * @returns {Promise<void>}
 */
export const downloadLeaderboardCsv = async (eventId) => {
  const qs = eventId ? `?eventId=${encodeURIComponent(eventId)}` : '';
  const url = `${BASE_URL}/api/admin/exports/leaderboard.csv${qs}`;
  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    let errorMsg = 'Failed to download leaderboard CSV';
    try {
      const errData = await response.json();
      if (errData.message) errorMsg = errData.message;
    } catch (_) {}
    throw new Error(errorMsg);
  }

  let filename = 'round1-leaderboard.csv';
  const disposition = response.headers.get('content-disposition');
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
};

/**
 * Admin: Downloads registered participants and teams as a CSV file.
 * @param {string} [eventId]
 * @returns {Promise<void>}
 */
export const downloadRegistrationsCsv = async (eventId) => {
  const qs = eventId ? `?eventId=${encodeURIComponent(eventId)}` : '';
  const url = `${BASE_URL}/api/admin/exports/registrations.csv${qs}`;
  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    let errorMsg = 'Failed to download registrations CSV';
    try {
      const errData = await response.json();
      if (errData.message) errorMsg = errData.message;
    } catch (_) {}
    throw new Error(errorMsg);
  }

  let filename = 'round1-registrations.csv';
  const disposition = response.headers.get('content-disposition');
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
};

/**
 * Admin: Resets development/test event data.
 * Permanently removes test teams, members, attempts, answers, and participant users for the current Round 1 event.
 * Sets event status to READY. Questions and admin accounts are preserved.
 * Internal event UUID is automatically resolved server-side.
 *
 * @param {Object} [params]
 * @param {string} params.confirmation - Must be 'RESET ROUND 1'
 * @returns {Promise<{ success: boolean, message: string, eventId: string, deleted: Object }>}
 */
export const resetTestEvent = async ({ confirmation } = {}) => {
  return await apiClient('/api/admin/test-reset', {
    method: 'POST',
    body: JSON.stringify({ confirmation }),
  });
};
