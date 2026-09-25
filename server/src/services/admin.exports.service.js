import { query } from '../config/database.js';
import { resolveLeaderboardEvent, getAdminLeaderboard } from './admin.leaderboard.service.js';

/**
 * UUID v4 validation regex (shared pattern).
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates an optional eventId. Returns trimmed string or undefined.
 * Throws 400 if eventId is supplied but is not a valid UUID.
 *
 * @param {string|undefined} eventId
 * @returns {string|undefined}
 */
export const validateExportEventId = (eventId) => {
  if (!eventId) return undefined;
  const id = String(eventId).trim();
  if (!UUID_REGEX.test(id)) {
    const err = new Error('Invalid event ID format. Must be a valid UUID.');
    err.statusCode = 400;
    throw err;
  }
  return id;
};

/**
 * CSV escaping: wraps a value in double-quotes and escapes any internal double-quotes.
 * Also handles null/undefined safely.
 *
 * @param {any} value
 * @returns {string}
 */
export const csvEscape = (value) => {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  // Wrap in quotes and escape any double-quote characters by doubling them
  return `"${str.replace(/"/g, '""')}"`;
};

/**
 * Converts an array of row arrays into a CSV string with a header row.
 *
 * @param {string[]} headers
 * @param {Array<Array<any>>} rows
 * @returns {string}
 */
export const buildCsv = (headers, rows) => {
  const headerRow = headers.map(csvEscape).join(',');
  const dataRows = rows.map((row) => row.map(csvEscape).join(','));
  return [headerRow, ...dataRows].join('\r\n');
};

/**
 * Builds the leaderboard CSV by reusing Module 8 leaderboard service entirely.
 * No score recalculation. No database mutation. Read-only.
 *
 * Columns: Rank, Team Name, Score, Status, Completed At, Started At
 *
 * @param {string|undefined} eventId
 * @returns {Promise<{ csv: string, filename: string }>}
 */
export const buildLeaderboardCsv = async (eventId) => {
  const resolvedId = validateExportEventId(eventId);

  // Reuse Module 8 service entirely — no separate ranking algorithm
  const result = await getAdminLeaderboard({ eventId: resolvedId });

  const headers = ['Rank', 'Team Name', 'Score', 'Status', 'Completed At', 'Started At'];

  const rows = result.leaderboard.map((entry) => [
    entry.rank !== null ? String(entry.rank) : '',
    entry.teamName,
    String(entry.score),
    entry.completionStatus,
    entry.completedAt ? new Date(entry.completedAt).toISOString() : '',
    entry.startedAt ? new Date(entry.startedAt).toISOString() : '',
  ]);

  const csv = buildCsv(headers, rows);

  // Build a safe filename from the event name
  const safeName = (result.event?.name || 'event')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 50) || 'event';

  const filename = `round1-leaderboard-${safeName}.csv`;

  return { csv, filename, event: result.event };
};

/**
 * Fetches registered team+member data for the export.
 * Uses the same safe event-resolution logic (Module 8's resolveLeaderboardEvent).
 *
 * Returns one row per team member.
 * NEVER exposes: payment_id, payment_proof_path, OTPs, passwords, JWTs, secrets.
 *
 * Columns:
 *   Team Name, Team Registration Status, Team Lead, Member Name, Email,
 *   WhatsApp Phone, College, Department, Register Number, Member Role,
 *   WhatsApp Group Confirmation, Registration Date
 *
 * @param {string|undefined} eventId
 * @returns {Promise<{ csv: string, filename: string }>}
 */
export const buildRegistrationsCsv = async (eventId) => {
  const resolvedId = validateExportEventId(eventId);

  // Resolve the event using the same safe rules as Module 8
  const event = await resolveLeaderboardEvent(resolvedId);

  // Fetch all teams + members for this event.
  // Parameterized query. No payment_id or payment_proof_path selected.
  const sql = `
    SELECT
      t.name             AS team_name,
      t.registration_status,
      t.college,
      t.department,
      t.whatsapp_group_joined,
      t.created_at       AS registration_date,
      -- Lead name via correlated subquery (avoids ambiguous join)
      (
        SELECT u2.name FROM team_members tm2
        JOIN users u2 ON u2.id = tm2.user_id
        WHERE tm2.team_id = t.id AND tm2.role = 'TEAM_LEAD'
        LIMIT 1
      ) AS lead_name,
      u.name             AS member_name,
      u.email            AS member_email,
      u.phone            AS member_phone,
      tm.register_number,
      tm.role            AS member_role
    FROM teams t
    JOIN team_members tm ON tm.team_id = t.id AND tm.event_id = t.event_id
    JOIN users u ON u.id = tm.user_id
    WHERE t.event_id = $1
    ORDER BY t.created_at ASC, t.name ASC, tm.role DESC, u.name ASC;
  `;

  const { rows } = await query(sql, [event.id]);

  const headers = [
    'Team Name',
    'Team Registration Status',
    'Team Lead',
    'Member Name',
    'Email',
    'WhatsApp Phone',
    'College',
    'Department',
    'Register Number',
    'Member Role',
    'WhatsApp Group Confirmation',
    'Registration Date',
  ];

  const dataRows = rows.map((r) => [
    r.team_name,
    r.registration_status,
    r.lead_name || '',
    r.member_name,
    r.member_email,
    r.member_phone || '',
    r.college,
    r.department,
    r.register_number,
    r.member_role,
    r.whatsapp_group_joined ? 'Yes' : 'No',
    r.registration_date ? new Date(r.registration_date).toISOString() : '',
  ]);

  const csv = buildCsv(headers, dataRows);

  const safeName = (event?.name || 'event')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 50) || 'event';

  const filename = `round1-registrations-${safeName}.csv`;

  return { csv, filename, event, totalRows: dataRows.length };
};
