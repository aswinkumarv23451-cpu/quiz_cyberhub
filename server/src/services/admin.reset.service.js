import { getClient } from '../config/database.js';
import { config } from '../config/env.js';

/**
 * UUID v4 validation regex.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mandatory confirmation string for resetting a test event.
 */
export const RESET_CONFIRMATION_STRING = 'RESET ROUND 1';

/**
 * Resets a development/test event by clearing its test participant data
 * and setting event status to READY.
 *
 * Enforces:
 * 1. Strict environment check (blocked in production).
 * 2. Mandatory valid UUID eventId.
 * 3. Exact confirmation string matching 'RESET ROUND 1'.
 * 4. Single ACID transaction with full rollback on error.
 * 5. Scoped deletion: answers, attempts, team_members, teams, and orphaned participant users.
 * 6. Questions, event configuration, admin users, and other events remain 100% untouched.
 *
 * @param {Object} params
 * @param {string} params.eventId
 * @param {string} params.confirmation
 * @returns {Promise<Object>} Audit-safe summary of deleted counts
 */
export const resetTestEventService = async ({ eventId, confirmation }) => {
  // 1. Safety check: Strictly forbidden in production
  if (config.nodeEnv === 'production' || process.env.NODE_ENV === 'production') {
    const err = new Error('Test reset is disabled in production.');
    err.statusCode = 403;
    throw err;
  }

  // 2. Validate eventId
  if (!eventId || typeof eventId !== 'string' || !UUID_REGEX.test(eventId.trim())) {
    const err = new Error('Invalid or missing event ID. Must be a valid UUID.');
    err.statusCode = 400;
    throw err;
  }
  const cleanEventId = eventId.trim();

  // 3. Validate confirmation string
  if (!confirmation || typeof confirmation !== 'string' || confirmation !== RESET_CONFIRMATION_STRING) {
    const err = new Error(`Confirmation string is invalid. Must be exactly "${RESET_CONFIRMATION_STRING}".`);
    err.statusCode = 400;
    throw err;
  }

  // 4. Acquire client for ACID transaction
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Verify event exists
    const eventRes = await client.query(
      'SELECT id, name, status, correct_marks, wrong_marks, skip_marks FROM event WHERE id = $1',
      [cleanEventId]
    );

    if (eventRes.rows.length === 0) {
      const err = new Error(`Event not found with ID: ${cleanEventId}`);
      err.statusCode = 404;
      throw err;
    }

    // Identify participant users who belong to this event and have no memberships in other events.
    // Exclude any admin emails from deletion.
    const adminEmails = (config.auth.adminEmails || [])
      .map((e) => (typeof e === 'string' ? e.toLowerCase().trim() : ''))
      .filter(Boolean);
    const safeAdminList = adminEmails.length > 0 ? adminEmails : ['__no_admin_placeholder__'];

    const userCandidatesRes = await client.query(
      `SELECT DISTINCT tm.user_id
       FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       WHERE tm.event_id = $1
         AND LOWER(u.email) != ALL($2::text[])
         AND NOT EXISTS (
           SELECT 1 FROM team_members other_tm
           WHERE other_tm.user_id = tm.user_id
             AND other_tm.event_id != $1
         );`,
      [cleanEventId, safeAdminList]
    );

    const participantUserIdsToDelete = userCandidatesRes.rows.map((r) => r.user_id);

    // Safe deletion in dependency order, strictly scoped to this event:
    // a. answers
    const answersRes = await client.query(
      'DELETE FROM answers WHERE event_id = $1;',
      [cleanEventId]
    );

    // b. attempts
    const attemptsRes = await client.query(
      'DELETE FROM attempts WHERE event_id = $1;',
      [cleanEventId]
    );

    // c. team_members
    const teamMembersRes = await client.query(
      'DELETE FROM team_members WHERE event_id = $1;',
      [cleanEventId]
    );

    // d. teams
    const teamsRes = await client.query(
      'DELETE FROM teams WHERE event_id = $1;',
      [cleanEventId]
    );

    // e. participant users belonging exclusively to this event
    let deletedUsersCount = 0;
    if (participantUserIdsToDelete.length > 0) {
      const usersRes = await client.query(
        'DELETE FROM users WHERE id = ANY($1::uuid[]);',
        [participantUserIdsToDelete]
      );
      deletedUsersCount = usersRes.rowCount || 0;
    }

    // f. Update event status to READY (preserves name, description, scoring, questions)
    await client.query(
      `UPDATE event
       SET status = 'READY', updated_at = NOW()
       WHERE id = $1;`,
      [cleanEventId]
    );

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Test event reset successfully.',
      eventId: cleanEventId,
      deleted: {
        teams: teamsRes.rowCount || 0,
        teamMembers: teamMembersRes.rowCount || 0,
        attempts: attemptsRes.rowCount || 0,
        answers: answersRes.rowCount || 0,
        participantUsers: deletedUsersCount,
      },
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // Ignore rollback errors to preserve original exception
    }
    throw err;
  } finally {
    client.release();
  }
};
