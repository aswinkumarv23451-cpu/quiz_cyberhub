import { getAdminLeaderboard } from '../services/admin.leaderboard.service.js';

/**
 * Controller: Retrieves the official Admin Leaderboard.
 * GET /api/admin/leaderboard
 *
 * Query params:
 * - eventId (optional): target competition event UUID
 */
export const getLeaderboardController = async (req, res, next) => {
  try {
    const { eventId } = req.query || {};
    const result = await getAdminLeaderboard({ eventId });
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
