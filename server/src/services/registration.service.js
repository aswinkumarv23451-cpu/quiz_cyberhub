import { getClient, query } from '../config/database.js';
import {
  normalizeEmail,
  normalizeIndianPhone,
  validateRegisterNumber,
} from '../utils/validation.utils.js';

/**
 * Retrieves the currently active event open for registration.
 *
 * Requirements:
 * - Event must have status = 'READY'
 * - 0 READY events -> Registration closed
 * - 1 READY event -> Active registration event
 * - >1 READY events -> Safe configuration error (fails safely without arbitrary selection)
 *
 * @returns {Promise<{ id: string, name: string, description: string, status: string }>}
 */
export const getActiveEventForRegistration = async () => {
  const sql = `
    SELECT id, name, description, status
    FROM event
    WHERE status = 'READY';
  `;
  const { rows } = await query(sql);

  if (rows.length === 0) {
    const error = new Error('Registration is currently closed.');
    error.statusCode = 400;
    throw error;
  }

  if (rows.length > 1) {
    const error = new Error(
      'System configuration error: multiple events are currently open for registration. Please contact the organizers.'
    );
    error.statusCode = 500;
    throw error;
  }

  return rows[0];
};

/**
 * Validates member details and team structure before database execution.
 *
 * @param {Array<Object>} members
 * @returns {Array<Object>} Validated and normalized members
 */
export const validateMembers = (members) => {
  if (!Array.isArray(members)) {
    const err = new Error('Members list must be an array.');
    err.statusCode = 400;
    throw err;
  }

  // Exactly 2 or 3 members required
  if (members.length < 2 || members.length > 3) {
    const err = new Error('Team must have exactly 2 or 3 members.');
    err.statusCode = 400;
    throw err;
  }

  // Exactly one TEAM_LEAD required
  const leadCount = members.filter((m) => m?.role === 'TEAM_LEAD').length;
  if (leadCount !== 1) {
    const err = new Error('Team must designate exactly one Team Lead.');
    err.statusCode = 400;
    throw err;
  }

  const normalizedMembers = [];
  const emailSet = new Set();
  const regNoSet = new Set();

  for (let i = 0; i < members.length; i++) {
    const m = members[i] || {};
    const memberNum = i + 1;

    // Validate Name
    const name = (m.name || '').trim();
    if (!name || name.length < 2 || name.length > 255) {
      const err = new Error(`Member ${memberNum} has an invalid or missing name.`);
      err.statusCode = 400;
      throw err;
    }

    // Validate & Normalize Email
    const normalizedEmail = normalizeEmail(m.email);
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      const err = new Error(`Member ${memberNum} has an invalid or missing email address.`);
      err.statusCode = 400;
      throw err;
    }

    if (emailSet.has(normalizedEmail)) {
      const err = new Error('All member emails within the team must be unique.');
      err.statusCode = 400;
      throw err;
    }
    emailSet.add(normalizedEmail);

    // Validate & Normalize Phone (WhatsApp)
    const normalizedPhone = normalizeIndianPhone(m.phone);
    if (!normalizedPhone) {
      const err = new Error(
        `Member ${memberNum} (${name}) has an invalid phone number. Please provide a valid 10-digit Indian mobile/WhatsApp number.`
      );
      err.statusCode = 400;
      throw err;
    }

    // Validate Register Number
    const regNo = validateRegisterNumber(m.registerNumber);
    if (!regNo) {
      const err = new Error(
        `Member ${memberNum} (${name}) has an invalid or missing register/roll number.`
      );
      err.statusCode = 400;
      throw err;
    }

    if (regNoSet.has(regNo)) {
      const err = new Error('All member register numbers within the team must be unique.');
      err.statusCode = 400;
      throw err;
    }
    regNoSet.add(regNo);

    // Validate Role
    const role = m.role === 'TEAM_LEAD' ? 'TEAM_LEAD' : 'MEMBER';

    normalizedMembers.push({
      name,
      email: normalizedEmail,
      phone: normalizedPhone,
      registerNumber: regNo,
      role,
    });
  }

  return normalizedMembers;
};

/**
 * Handles complete team registration atomically inside a PostgreSQL transaction.
 * Free registration: Payment is not required.
 * WhatsApp group confirmation is mandatory.
 *
 * @param {Object} params
 * @param {string} params.teamName
 * @param {string} params.college
 * @param {string} params.department
 * @param {boolean|string} params.whatsappGroupJoined
 * @param {Array<Object>} params.members
 * @returns {Promise<Object>} Safe registration summary (NO internal UUIDs)
 */
export const registerTeam = async ({
  teamName,
  college,
  department,
  whatsappGroupJoined,
  members,
}) => {
  // 1. WhatsApp Group confirmation validation (MANDATORY)
  const isWhatsappJoined =
    whatsappGroupJoined === true ||
    whatsappGroupJoined === 'true' ||
    whatsappGroupJoined === 1 ||
    whatsappGroupJoined === '1';

  if (!isWhatsappJoined) {
    const err = new Error(
      'You must confirm that you have joined the official WhatsApp group.'
    );
    err.statusCode = 400;
    throw err;
  }

  // 2. Basic field sanitization
  const cleanTeamName = (teamName || '').trim();
  const cleanCollege = (college || '').trim();
  const cleanDepartment = (department || '').trim();

  if (!cleanTeamName || cleanTeamName.length < 2 || cleanTeamName.length > 255) {
    const err = new Error('Team name must be between 2 and 255 characters.');
    err.statusCode = 400;
    throw err;
  }
  if (!cleanCollege || cleanCollege.length < 2 || cleanCollege.length > 255) {
    const err = new Error('College name must be between 2 and 255 characters.');
    err.statusCode = 400;
    throw err;
  }
  if (!cleanDepartment || cleanDepartment.length < 1 || cleanDepartment.length > 255) {
    const err = new Error('Department must be specified.');
    err.statusCode = 400;
    throw err;
  }

  // 3. Validate members structure
  const validatedMembers = validateMembers(members);

  // 4. Determine active event strictly from server (client cannot choose event_id)
  const activeEvent = await getActiveEventForRegistration();

  // 5. Pre-check: Duplicate team name within this event
  const teamCheckSql = `
    SELECT id FROM teams
    WHERE LOWER(name) = LOWER($1) AND event_id = $2
    LIMIT 1;
  `;
  const teamCheckRes = await query(teamCheckSql, [cleanTeamName, activeEvent.id]);
  if (teamCheckRes.rows.length > 0) {
    const err = new Error('Team name is already registered for this event.');
    err.statusCode = 409;
    throw err;
  }

  // 6. Pre-check: Duplicate member participation in this event (Anti-Enumeration)
  const memberEmails = validatedMembers.map((m) => m.email);
  const memberCheckSql = `
    SELECT tm.id
    FROM team_members tm
    JOIN users u ON u.id = tm.user_id
    WHERE tm.event_id = $1 AND LOWER(u.email) = ANY($2::text[])
    LIMIT 1;
  `;
  const memberCheckRes = await query(memberCheckSql, [activeEvent.id, memberEmails]);
  if (memberCheckRes.rows.length > 0) {
    // Generic safe anti-enumeration message (does not reveal which email matched)
    const err = new Error('One or more members are already registered for this event.');
    err.statusCode = 409;
    throw err;
  }

  // 7. Atomic Database Transaction
  const dbClient = await getClient();

  try {
    await dbClient.query('BEGIN');

    // 7a. Process Users (Existing users: reuse ID without overwriting name or phone)
    const memberUserIds = [];

    for (const member of validatedMembers) {
      // Check if user already exists
      const findUserSql = 'SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1;';
      const findUserRes = await dbClient.query(findUserSql, [member.email]);

      let userId;
      if (findUserRes.rows.length > 0) {
        // Reuse existing user ID — DO NOT overwrite name or phone!
        userId = findUserRes.rows[0].id;
      } else {
        // Create new user
        const insertUserSql = `
          INSERT INTO users (name, email, phone)
          VALUES ($1, $2, $3)
          RETURNING id;
        `;
        const insertUserRes = await dbClient.query(insertUserSql, [
          member.name,
          member.email,
          member.phone,
        ]);
        userId = insertUserRes.rows[0].id;
      }

      memberUserIds.push({
        userId,
        role: member.role,
        registerNumber: member.registerNumber,
      });
    }

    // 7b. Insert Team (registration_status is strictly PENDING, whatsapp_group_joined = true)
    const insertTeamSql = `
      INSERT INTO teams (
        name,
        event_id,
        college,
        department,
        registration_status,
        whatsapp_group_joined
      )
      VALUES ($1, $2, $3, $4, 'PENDING', $5)
      RETURNING id;
    `;
    const insertTeamRes = await dbClient.query(insertTeamSql, [
      cleanTeamName,
      activeEvent.id,
      cleanCollege,
      cleanDepartment,
      true,
    ]);
    const teamId = insertTeamRes.rows[0].id;

    // 7c. Insert Team Members
    for (const m of memberUserIds) {
      const insertMemberSql = `
        INSERT INTO team_members (
          team_id,
          user_id,
          event_id,
          register_number,
          role
        )
        VALUES ($1, $2, $3, $4, $5);
      `;
      await dbClient.query(insertMemberSql, [
        teamId,
        m.userId,
        activeEvent.id,
        m.registerNumber,
        m.role,
      ]);
    }

    // Commit Transaction
    await dbClient.query('COMMIT');

    // 8. Return safe confirmation summary (NO internal UUIDs, NO payment fields)
    return {
      success: true,
      message:
        'Registration submitted successfully. Your registration is pending organizer verification.',
      registrationStatus: 'PENDING',
      teamName: cleanTeamName,
      college: cleanCollege,
      department: cleanDepartment,
      memberCount: validatedMembers.length,
      whatsappGroupJoined: true,
    };
  } catch (dbError) {
    // Rollback transaction
    await dbClient.query('ROLLBACK');

    // Handle concurrent duplicate constraint violations safely
    if (dbError.code === '23505') {
      if (dbError.constraint === 'uq_teams_name_event_id') {
        const err = new Error('Team name is already registered for this event.');
        err.statusCode = 409;
        throw err;
      }
      if (dbError.constraint === 'uq_team_members_user_event') {
        const err = new Error(
          'One or more members are already registered for this event.'
        );
        err.statusCode = 409;
        throw err;
      }
      if (dbError.constraint === 'idx_one_lead_per_team') {
        const err = new Error('Team must have exactly one Team Lead.');
        err.statusCode = 400;
        throw err;
      }
    }

    // Pass through custom error if already set
    if (dbError.statusCode) {
      throw dbError;
    }

    // Generic safe internal error (never leak raw SQL or stack traces)
    const safeError = new Error(
      'Registration could not be completed. Please verify your details and try again.'
    );
    safeError.statusCode = 500;
    throw safeError;
  } finally {
    dbClient.release();
  }
};
