import {
  getMonitoringOverview,
  getTeamMonitoringDetail,
} from '../services/admin.monitoring.service.js';

/**
 * Controller: Retrieves real-time operational monitoring overview.
 * GET /api/admin/monitoring
 */
export const getMonitoringOverviewController = async (req, res, next) => {
  try {
    const result = await getMonitoringOverview();
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Retrieves detailed operational monitoring for a specific team.
 * GET /api/admin/monitoring/team/:teamId
 */
export const getTeamMonitoringDetailController = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const result = await getTeamMonitoringDetail(teamId);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
