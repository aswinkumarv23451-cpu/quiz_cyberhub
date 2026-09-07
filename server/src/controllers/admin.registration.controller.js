import {
  getRegistrations,
  getRegistrationDetail,
  getRegistrationStats,
  approveRegistration,
  rejectRegistration,
  getPaymentProofStream,
} from '../services/admin.registration.service.js';

/**
 * GET /api/admin/registrations
 * Paginated list of team registrations with optional filters.
 * Query params: page, limit, status, search
 */
export const listRegistrationsController = async (req, res, next) => {
  try {
    const { page, limit, status, search } = req.query;
    const result = await getRegistrations({ page, limit, status, search });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/registrations/stats
 * Returns registration count breakdown by status.
 */
export const getRegistrationStatsController = async (req, res, next) => {
  try {
    const stats = await getRegistrationStats();
    res.status(200).json({ success: true, stats });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/registrations/:teamId
 * Returns full team registration detail including member list.
 * NEVER returns payment_proof_path or filesystem paths.
 */
export const getRegistrationDetailController = async (req, res, next) => {
  try {
    const detail = await getRegistrationDetail(req.params.teamId);
    res.status(200).json({ success: true, registration: detail });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/registrations/:teamId/proof
 * Secure payment proof download via PaymentProofStorage abstraction.
 * Streams the file directly — never exposes filesystem paths.
 */
export const downloadPaymentProofController = async (req, res, next) => {
  try {
    const { stream, filename, contentType } = await getPaymentProofStream(
      req.params.teamId
    );

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    stream.pipe(res);

    stream.on('error', (err) => {
      if (!res.headersSent) {
        next(err);
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/registrations/:teamId/approve
 * Approves a PENDING registration.
 * State machine: PENDING → APPROVED only.
 */
export const approveRegistrationController = async (req, res, next) => {
  try {
    const result = await approveRegistration(req.params.teamId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/registrations/:teamId/reject
 * Rejects a PENDING registration.
 * State machine: PENDING → REJECTED only.
 */
export const rejectRegistrationController = async (req, res, next) => {
  try {
    const result = await rejectRegistration(req.params.teamId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
