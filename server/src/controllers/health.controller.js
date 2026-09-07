import { testConnection } from '../config/database.js';

/**
 * GET /api/health
 * Returns health status of the Round 1 API, including database connectivity.
 * Always returns HTTP 200 — database status is informational.
 */
export const getHealthStatus = async (req, res) => {
  const health = {
    success: true,
    message: 'Round 1 API is running',
    timestamp: new Date().toISOString(),
  };

  // Attempt database connectivity check (non-blocking to API health)
  try {
    const dbStatus = await testConnection();
    health.database = {
      connected: true,
      serverTime: dbStatus.serverTime,
      database: dbStatus.database,
    };
  } catch (err) {
    health.database = {
      connected: false,
      error: err.message,
    };
  }

  res.status(200).json(health);
};
