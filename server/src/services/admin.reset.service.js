import { getClient } from '../config/database.js';
import { config } from '../config/env.js';

/**
 * Mandatory confirmation string for resetting a test event.
 */
export const RESET_CONFIRMATION_STRING = 'RESET ROUND 1';

/**
 * Deterministically resolves the current Round 1 event server-side.
 * Never guesses or silently picks an arbitrary event.
 *
 * Rules:
 * 1. Checks for active events with status IN ('READY', 'LIVE'):
 *    - If multiple active events exist -> fail safely (409 Conflict / System configuration error).
 *    - If exactly 1 active event exists -> return it.
 * 2. If 0 active events exist, checks for completed ('ENDED') events:
 *    - If multiple ENDED events exist -> fail safely (409 Conflict / ambiguous target).
 *    - If exactly 1 ENDED event exists -> return it.
 * 3. If no event exists in the database -> fail safely (404 Not Found).
 *
 * Rows are locked with FOR UPDATE to prevent race conditions during reset.
 *
 * @param {import('pg').PoolClient} client - Transaction client
 * @returns {Promise<Object>} The resolved current event record
 */
export const resolveCurrentRound1Event = async (client) => {
  // 1. Query for active events (READY or LIVE)
  const activeRes = await client.query(
    `SELECT id, name, status, correct_marks, wrong_marks, skip_marks
     FROM event
     WHERE status IN ('READY', 'LIVE')
     FOR UPDATE;`
  );

  if (activeRes.rows.length > 1) {
    const err = new Error(
      'System configuration error: multiple active Round 1 events detected. Cannot safely determine target event to reset.'
    );
    err.statusCode = 409;
    throw err;
  }

  if (activeRes.rows.length === 1) {
    return activeRes.rows[0];
  }

  // 2. Fallback to ENDED events if no active event exists
  const endedRes = await client.query(
    `SELECT id, name, status, correct_marks, wrong_marks, skip_marks
     FROM event
     WHERE status = 'ENDED'
     FOR UPDATE;`
  );

  if (endedRes.rows.length > 1) {
    const err = new Error(
      'System configuration error: multiple ENDED events detected with no active event. Cannot safely determine target event to reset.'
    );
    err.statusCode = 409;
    throw err;
  }

  if (endedRes.rows.length === 1) {
    return endedRes.rows[0];
  }

  // 3. No event exists
  const err = new Error('No valid current Round 1 event found.');
  err.statusCode = 404;
  throw err;
};

/**
 * Resets a development/test event by clearing its test participant data
 * and setting event status to READY.
 *
 * Enforces:
 * 1. Strict environment safety check via ALLOW_TEST_RESET flag (safe default: missing = blocked).
 * 2. Exact confirmation string matching 'RESET ROUND 1'.
 * 3. Deterministic server-side current event resolution (client UUID never trusted/required).
 * 4. Single ACID transaction with full rollback on error.
 * 5. Scoped deletion: answers, attempts, team_members, teams, and orphaned participant users.
 * 6. Questions, event configuration, admin users, and other events remain 100% untouched.
 *
 * @param {Object} params
 * @param {string} params.confirmation
 * @returns {Promise<Object>} Audit-safe summary of deleted counts
 */
export const resetTestEventService = async ({ confirmation } = {}) => {
  // 1. Safety check: Controlled strictly via ALLOW_TEST_RESET environment variable.
  // Default is safe: if missing, false, or not explicitly 'true', reset is forbidden (403).
  const isAllowed = config.allowTestReset === true || process.env.ALLOW_TEST_RESET === 'true';
  if (!isAllowed || config.allowTestReset === false || process.env.ALLOW_TEST_RESET === 'false') {
    const err = new Error('Test reset is disabled. ALLOW_TEST_RESET must be set to true.');
    err.statusCode = 403;
    throw err;
  }

  // 2. Validate confirmation string
  if (!confirmation || typeof confirmation !== 'string' || confirmation !== RESET_CONFIRMATION_STRING) {
    const err = new Error(`Confirmation string is invalid. Must be exactly "${RESET_CONFIRMATION_STRING}".`);
    err.statusCode = 400;
    throw err;
  }

  // 3. Acquire client for ACID transaction
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 4. Deterministically resolve current Round 1 event (client UUID never trusted)
    const currentEvent = await resolveCurrentRound1Event(client);
    const cleanEventId = currentEvent.id;

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
