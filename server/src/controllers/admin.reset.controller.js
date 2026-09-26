import { resetTestEventService } from '../services/admin.reset.service.js';

/**
 * Controller for Admin Reset Test Event endpoint: POST /api/admin/test-reset
 * Client is only required to supply the confirmation phrase.
 * Event UUID is automatically resolved server-side.
 */
export const handleResetTestEvent = async (req, res, next) => {
  try {
    const { confirmation } = req.body || {};
    const result = await resetTestEventService({ confirmation });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};
