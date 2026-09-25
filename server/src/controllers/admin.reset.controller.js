import { resetTestEventService } from '../services/admin.reset.service.js';

/**
 * Controller for Admin Reset Test Event endpoint: POST /api/admin/test-reset
 */
export const handleResetTestEvent = async (req, res, next) => {
  try {
    const { eventId, confirmation } = req.body || {};
    const result = await resetTestEventService({ eventId, confirmation });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};
