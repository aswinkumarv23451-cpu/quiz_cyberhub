import {
  buildLeaderboardCsv,
  buildRegistrationsCsv,
  validateExportEventId,
} from '../services/admin.exports.service.js';

/**
 * Controller: Download Official Leaderboard as CSV.
 * GET /api/admin/exports/leaderboard.csv
 *
 * - Requires: requireAuth + requireAdmin (applied at router level)
 * - Reuses Module 8 leaderboard ranking: no second algorithm.
 * - Read-only: no score/answer mutation.
 * - Content-Type: text/csv; charset=utf-8
 * - Content-Disposition: attachment; filename="round1-leaderboard-<event>.csv"
 *
 * Query params:
 *   eventId (optional): target event UUID. Falls back to Module 8 safe auto-resolution.
 */
export const downloadLeaderboardCsvController = async (req, res, next) => {
  try {
    const rawEventId = req.query?.eventId;

    // Validate eventId early to return clean 400 before any DB hit
    validateExportEventId(rawEventId);

    const { csv, filename } = await buildLeaderboardCsv(rawEventId);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');

    return res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Download Registered Participants as CSV.
 * GET /api/admin/exports/registrations.csv
 *
 * - Requires: requireAuth + requireAdmin (applied at router level)
 * - One row per team member.
 * - Does NOT export: payment_id, payment_proof_path, OTPs, passwords, JWTs, secrets.
 * - Content-Type: text/csv; charset=utf-8
 * - Content-Disposition: attachment; filename="round1-registrations-<event>.csv"
 *
 * Query params:
 *   eventId (optional): target event UUID. Falls back to Module 8 safe auto-resolution.
 */
export const downloadRegistrationsCsvController = async (req, res, next) => {
  try {
    const rawEventId = req.query?.eventId;

    // Validate eventId early to return clean 400 before any DB hit
    validateExportEventId(rawEventId);

    const { csv, filename } = await buildRegistrationsCsv(rawEventId);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');

    return res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};
