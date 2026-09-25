import { query, getClient } from '../config/database.js';
import { paymentProofStorage } from './storage/paymentProofStorage.js';

// UUID v4 regex for strict input validation before any DB query
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

/**
 * Validates that a string is a valid UUID v4.
 * @param {string} id
 * @returns {boolean}
 */
export const isValidUUID = (id) => {
  return typeof id === 'string' && UUID_REGEX.test(id);
};

/**
 * Retrieves paginated team registrations with optional status and search filters.
 * All queries use parameterized SQL — zero string concatenation.
 *
 * @param {Object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @param {string} [params.status]
 * @param {string} [params.search]
 * @returns {Promise<{ registrations: Array, pagination: Object }>}
 */
export const getRegistrations = async ({ page = 1, limit = DEFAULT_LIMIT, status, search } = {}) => {
  // Validate and sanitize pagination parameters
  const parsedPage = Math.max(1, Math.floor(Number(page)) || 1);
  const parsedLimit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(limit)) || DEFAULT_LIMIT));
  const offset = (parsedPage - 1) * parsedLimit;

  // Validate status filter if provided
  if (status && !VALID_STATUSES.includes(status.toUpperCase())) {
    const err = new Error(`Invalid status filter. Allowed values: ${VALID_STATUSES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  // Build parameterized WHERE clause
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (status) {
    conditions.push(`t.registration_status = $${paramIndex++}`);
    params.push(status.toUpperCase());
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    const searchTerm = `%${search.trim()}%`;
    conditions.push(`(t.name ILIKE $${paramIndex} OR t.college ILIKE $${paramIndex})`);
    params.push(searchTerm);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total matching registrations
  const countSql = `SELECT COUNT(*) AS total FROM teams t ${whereClause};`;
  const countRes = await query(countSql, params);
  const total = parseInt(countRes.rows[0].total, 10);

  // Fetch registrations with team lead info and member count
  const dataSql = `
    SELECT
      t.id,
      t.name AS team_name,
      t.college,
      t.department,
      t.registration_status,
      t.payment_id,
      t.created_at,
      COUNT(tm.id)::int AS member_count,
      lead_user.name AS lead_name,
      lead_user.email AS lead_email
    FROM teams t
    LEFT JOIN team_members tm ON tm.team_id = t.id
    LEFT JOIN team_members lead_tm ON lead_tm.team_id = t.id AND lead_tm.role = 'TEAM_LEAD'
    LEFT JOIN users lead_user ON lead_user.id = lead_tm.user_id
    ${whereClause}
    GROUP BY t.id, t.name, t.college, t.department, t.registration_status,
             t.payment_id, t.created_at, lead_user.name, lead_user.email
    ORDER BY t.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++};
  `;

  const dataParams = [...params, parsedLimit, offset];
  const dataRes = await query(dataSql, dataParams);

  return {
    registrations: dataRes.rows.map((r) => ({
      id: r.id,
      teamName: r.team_name,
      college: r.college,
      department: r.department,
      registrationStatus: r.registration_status,
      paymentId: r.payment_id,
      memberCount: r.member_count,
      leadName: r.lead_name,
      leadEmail: r.lead_email,
      createdAt: r.created_at,
    })),
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
    },
  };
};

/**
 * Returns full detail of a single team registration.
 * Includes all team members with their details.
 * NEVER returns payment_proof_path or filesystem paths.
 *
 * @param {string} teamId - Must be a validated UUID
 * @returns {Promise<Object>}
 */
export const getRegistrationDetail = async (teamId) => {
  if (!isValidUUID(teamId)) {
    const err = new Error('Invalid registration identifier.');
    err.statusCode = 400;
    throw err;
  }

  // Fetch team (never select payment_proof_path)
  const teamSql = `
    SELECT id, name, college, department, registration_status, payment_id, created_at
    FROM teams
    WHERE id = $1
    LIMIT 1;
  `;
  const teamRes = await query(teamSql, [teamId]);

  if (teamRes.rows.length === 0) {
    const err = new Error('Registration not found.');
    err.statusCode = 404;
    throw err;
  }

  const team = teamRes.rows[0];

  // Fetch all members with user details
  const membersSql = `
    SELECT
      u.name,
      u.email,
      u.phone,
      tm.register_number,
      tm.role,
      tm.joined_at
    FROM team_members tm
    JOIN users u ON u.id = tm.user_id
    WHERE tm.team_id = $1
    ORDER BY tm.role DESC, tm.joined_at ASC;
  `;
  const membersRes = await query(membersSql, [teamId]);

  // Check if payment proof file exists (boolean, no path exposed)
  const proofPathSql = `SELECT payment_proof_path FROM teams WHERE id = $1;`;
  const proofRes = await query(proofPathSql, [teamId]);
  const proofPath = proofRes.rows[0]?.payment_proof_path;
  const hasPaymentProof = proofPath ? await paymentProofStorage.exists(proofPath) : false;

  return {
    id: team.id,
    teamName: team.name,
    college: team.college,
    department: team.department,
    registrationStatus: team.registration_status,
    paymentId: team.payment_id,
    hasPaymentProof,
    createdAt: team.created_at,
    members: membersRes.rows.map((m) => ({
      name: m.name,
      email: m.email,
      phone: m.phone,
      registerNumber: m.register_number,
      role: m.role,
      joinedAt: m.joined_at,
    })),
  };
};

/**
 * Returns registration statistics (counts by status).
 *
 * @returns {Promise<Object>}
 */
export const getRegistrationStats = async () => {
  const sql = `
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE registration_status = 'PENDING')::int AS pending,
      COUNT(*) FILTER (WHERE registration_status = 'APPROVED')::int AS approved,
      COUNT(*) FILTER (WHERE registration_status = 'REJECTED')::int AS rejected
    FROM teams;
  `;
  const { rows } = await query(sql);
  return rows[0];
};

/**
 * Approves a registration. Uses a database transaction with SELECT...FOR UPDATE
 * to prevent concurrent state corruption.
 *
 * Validations:
 * - Team must exist
 * - Team must be PENDING (not APPROVED or REJECTED)
 * (Registration is free: payment_id and payment_proof_path are NOT required)
 *
 * @param {string} teamId
 * @returns {Promise<Object>}
 */
export const approveRegistration = async (teamId) => {
  if (!isValidUUID(teamId)) {
    const err = new Error('Invalid registration identifier.');
    err.statusCode = 400;
    throw err;
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Lock the row to prevent concurrent state transitions
    const lockSql = `
      SELECT id, registration_status
      FROM teams
      WHERE id = $1
      FOR UPDATE;
    `;
    const lockRes = await client.query(lockSql, [teamId]);

    if (lockRes.rows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('Registration not found.');
      err.statusCode = 404;
      throw err;
    }

    const team = lockRes.rows[0];

    // State machine: only PENDING → APPROVED
    if (team.registration_status !== 'PENDING') {
      await client.query('ROLLBACK');
      const err = new Error(
        `Cannot approve: registration is already ${team.registration_status}.`
      );
      err.statusCode = 409;
      throw err;
    }

    // Transition: PENDING → APPROVED
    const updateSql = `
      UPDATE teams
      SET registration_status = 'APPROVED'
      WHERE id = $1 AND registration_status = 'PENDING'
      RETURNING id, registration_status;
    `;
    const updateRes = await client.query(updateSql, [teamId]);

    if (updateRes.rows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('Approval failed due to a concurrent state change.');
      err.statusCode = 409;
      throw err;
    }

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Registration approved successfully.',
      registrationStatus: 'APPROVED',
    };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { /* already rolled back */ }
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Rejects a registration. Uses a database transaction with SELECT...FOR UPDATE
 * to prevent concurrent state corruption.
 *
 * State machine: only PENDING → REJECTED.
 * Reject reason is NOT persisted (schema has no reason column).
 *
 * @param {string} teamId
 * @returns {Promise<Object>}
 */
export const rejectRegistration = async (teamId) => {
  if (!isValidUUID(teamId)) {
    const err = new Error('Invalid registration identifier.');
    err.statusCode = 400;
    throw err;
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Lock the row to prevent concurrent state transitions
    const lockSql = `
      SELECT id, registration_status
      FROM teams
      WHERE id = $1
      FOR UPDATE;
    `;
    const lockRes = await client.query(lockSql, [teamId]);

    if (lockRes.rows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('Registration not found.');
      err.statusCode = 404;
      throw err;
    }

    const team = lockRes.rows[0];

    // State machine: only PENDING → REJECTED
    if (team.registration_status !== 'PENDING') {
      await client.query('ROLLBACK');
      const err = new Error(
        `Cannot reject: registration is already ${team.registration_status}.`
      );
      err.statusCode = 409;
      throw err;
    }

    // Transition: PENDING → REJECTED
    const updateSql = `
      UPDATE teams
      SET registration_status = 'REJECTED'
      WHERE id = $1 AND registration_status = 'PENDING'
      RETURNING id, registration_status;
    `;
    const updateRes = await client.query(updateSql, [teamId]);

    if (updateRes.rows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('Rejection failed due to a concurrent state change.');
      err.statusCode = 409;
      throw err;
    }

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Registration rejected.',
      registrationStatus: 'REJECTED',
    };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { /* already rolled back */ }
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Returns a readable stream for a team's payment proof file.
 * Uses the PaymentProofStorage abstraction — never exposes filesystem paths.
 *
 * @param {string} teamId - Must be a validated UUID
 * @returns {Promise<{ stream, filename, contentType }>}
 */
export const getPaymentProofStream = async (teamId) => {
  if (!isValidUUID(teamId)) {
    const err = new Error('Invalid registration identifier.');
    err.statusCode = 400;
    throw err;
  }

  const sql = `SELECT payment_proof_path FROM teams WHERE id = $1 LIMIT 1;`;
  const { rows } = await query(sql, [teamId]);

  if (rows.length === 0) {
    const err = new Error('Registration not found.');
    err.statusCode = 404;
    throw err;
  }

  const proofPath = rows[0].payment_proof_path;
  if (!proofPath) {
    const err = new Error('No payment proof uploaded for this registration.');
    err.statusCode = 404;
    throw err;
  }

  // Delegate to PaymentProofStorage for path-safe stream access
  return paymentProofStorage.getProofReadStream(proofPath);
};
