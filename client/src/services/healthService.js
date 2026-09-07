import { apiClient } from './apiClient.js';

/**
 * Health Service
 * Encapsulates health check endpoints.
 */
export const checkHealth = async () => {
  return apiClient('/api/health');
};
