import { apiClient } from './apiClient';

/**
 * Fetches the currently open event and registration parameters.
 * @returns {Promise<{ success: boolean, registrationOpen: boolean, event?: Object, whatsappGroupLink?: string }>}
 */
export const getRegistrationEvent = async () => {
  return await apiClient('/api/registration/event', {
    method: 'GET',
  });
};

/**
 * Submits team registration form data (free registration with WhatsApp confirmation).
 * Supports plain JSON object or FormData.
 * @param {Object|FormData} data
 * @returns {Promise<{ success: boolean, message: string, registrationStatus: string, teamName: string, memberCount: number, whatsappGroupJoined: boolean }>}
 */
export const registerTeam = async (data) => {
  const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
  return await apiClient('/api/registration', {
    method: 'POST',
    body: isFormData ? data : JSON.stringify(data),
  });
};

