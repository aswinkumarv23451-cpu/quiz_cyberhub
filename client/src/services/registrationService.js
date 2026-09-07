import { apiClient } from './apiClient';

/**
 * Fetches the currently open event and registration parameters.
 * @returns {Promise<{ success: boolean, registrationOpen: boolean, event?: Object, feePerMember?: number }>}
 */
export const getRegistrationEvent = async () => {
  return await apiClient('/api/registration/event', {
    method: 'GET',
  });
};

/**
 * Submits team registration form data including payment proof file.
 * @param {FormData} formData
 * @returns {Promise<{ success: boolean, message: string, registrationStatus: string, teamName: string, memberCount: number, fee: number }>}
 */
export const registerTeam = async (formData) => {
  return await apiClient('/api/registration', {
    method: 'POST',
    body: formData,
  });
};
