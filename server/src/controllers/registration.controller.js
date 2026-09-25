import {
  getActiveEventForRegistration,
  registerTeam,
} from '../services/registration.service.js';
import { config } from '../config/env.js';

/**
 * GET /api/registration/event
 * Returns safe public details about the currently active registration event.
 * Never exposes database IDs or internal UUIDs.
 * Provides the official WhatsApp group link from server configuration.
 */
export const getActiveEventController = async (req, res, next) => {
  try {
    const activeEvent = await getActiveEventForRegistration();

    res.status(200).json({
      success: true,
      registrationOpen: true,
      event: {
        name: activeEvent.name,
        description: activeEvent.description,
      },
      whatsappGroupLink: config.whatsappGroupLink,
      allowedTeamSizes: [2, 3],
    });
  } catch (error) {
    if (error.statusCode === 400) {
      // Registration is closed
      return res.status(200).json({
        success: false,
        registrationOpen: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * POST /api/registration
 * Public endpoint to register a team freely with mandatory WhatsApp confirmation.
 * Validates payload, processes atomic transaction, and returns safe summary.
 */
export const submitRegistrationController = async (req, res, next) => {
  try {
    const { teamName, college, department } = req.body || {};
    const whatsappGroupJoined =
      req.body?.whatsapp_group_joined !== undefined
        ? req.body.whatsapp_group_joined
        : req.body?.whatsappGroupJoined;

    let members = req.body?.members;

    // Handle members passed as JSON string in form-data or JSON object
    if (typeof members === 'string') {
      try {
        members = JSON.parse(members);
      } catch (e) {
        const err = new Error('Invalid members format. Expected valid JSON array.');
        err.statusCode = 400;
        throw err;
      }
    }

    const summary = await registerTeam({
      teamName,
      college,
      department,
      whatsappGroupJoined,
      members,
    });

    res.status(201).json(summary);
  } catch (error) {
    next(error);
  }
};

