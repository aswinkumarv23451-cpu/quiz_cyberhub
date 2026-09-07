/**
 * GET /api/health
 * Returns health status of the Round 1 API.
 */
export const getHealthStatus = (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Round 1 API is running',
  });
};
