/**
 * Module 11: Admin CSV Exports — Leaderboard & Registrations Test Suite
 *
 * Tests:
 * --- Leaderboard Export ---
 *  1. Admin can download leaderboard CSV (200, text/csv)
 *  2. Non-admin (TEAM_LEAD) cannot download leaderboard CSV (403)
 *  3. Unauthenticated user cannot download leaderboard CSV (401)
 *  4. CSV headers are correct
 *  5. Ranking exactly matches Module 8 leaderboard ranking
 *  6. Scores exactly match existing stored attempt.total_score
 *  7. No score mutation occurs after download
 *  8. No sensitive fields appear in leaderboard CSV
 *  9. Event isolation: leaderboard CSV scoped strictly to requested event
 *
 * --- Registrations Export ---
 * 10. Admin can download registrations CSV (200, text/csv)
 * 11. Non-admin (TEAM_LEAD) cannot download registrations CSV (403)
 * 12. Unauthenticated user cannot download registrations CSV (401)
 * 13. CSV contains all registered members correctly (one row per member)
 * 14. Team lead / member roles are correctly identified
 * 15. WhatsApp confirmation is exported correctly (Yes/No)
 * 16. Payment fields (payment_id, payment_proof_path) are NOT in the CSV
 * 17. OTP / password / JWT / internal secret fields are NOT in the CSV
 * 18. Event isolation: registrations CSV scoped strictly to requested event
 * 19. CSV escaping: commas, double-quotes, Unicode, and newlines are safe
 * 20. No-data event (0 teams) is handled safely (header-only CSV, 200)
 */

import http from 'http';
import { query, closePool } from '../config/database.js';
import { config } from '../config/env.js';
import app from '../app.js';
import { signToken } from '../services/auth.service.js';

config.email.provider = 'test';
config.nodeEnv = 'test';

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------
let server;
let baseUrl;

const ADMIN_EMAIL = 'admin@round1.tech';
const LEAD_EMAIL  = 'exports_lead@test.com';

let adminUserId;
let leadUserId;

let adminCookie;
let leadCookie;

let primaryEventId;   // LIVE  — has teams/attempts
let emptyEventId;     // READY — no teams at all
let foreignEventId;   // secondary event for isolation tests

let team1Id;          // APPROVED, completed
let team2Id;          // APPROVED, completed (tied score, later)
let team3Id;          // APPROVED, not-started
let foreignTeamId;    // belongs to foreignEventId

let primaryQuestionIds = [];

// ---------------------------------------------------------------------------
// Test runner helpers (consistent with existing test suites)
// ---------------------------------------------------------------------------
let passCount = 0;
let failCount = 0;

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    if (err.stack) console.error(`    Stack: ${err.stack.split('\n').slice(1, 4).join('\n')}`);
    failCount++;
  }
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message || 'Assertion failed');
};

// ---------------------------------------------------------------------------
// HTTP helper — returns raw text (for CSV) plus status + headers
// ---------------------------------------------------------------------------
const apiRaw = async (endpoint, cookieHeader = null) => {
  const url = `${baseUrl}${endpoint}`;
  const headers = {};
  if (cookieHeader) headers['Cookie'] = cookieHeader;

  const res = await fetch(url, { method: 'GET', headers });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
};

// ---------------------------------------------------------------------------
// Parse CSV helpers
// ---------------------------------------------------------------------------

/**
 * Parses RFC 4180 CSV (handles quoted fields, escaped quotes, and newlines inside quotes).
 * Returns array of arrays of string values.
 */
const parseCsv = (csvText) => {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n of \r\n
      }
      currentRow.push(currentField);
      currentField = '';
      if (currentRow.length > 0 && !(currentRow.length === 1 && currentRow[0] === '')) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.length > 0 && !(currentRow.length === 1 && currentRow[0] === '')) {
      rows.push(currentRow);
    }
  }

  return rows;
};

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------
const setupDatabase = async () => {
  // Cleanup prior export-test artifacts
  await query("DELETE FROM answers    WHERE attempt_id IN (SELECT id FROM attempts WHERE event_id IN (SELECT id FROM event WHERE name LIKE '%Export Test%'));");
  await query("DELETE FROM attempts   WHERE event_id IN (SELECT id FROM event WHERE name LIKE '%Export Test%');");
  await query("DELETE FROM questions  WHERE event_id IN (SELECT id FROM event WHERE name LIKE '%Export Test%');");
  await query("DELETE FROM team_members WHERE event_id IN (SELECT id FROM event WHERE name LIKE '%Export Test%');");
  await query("DELETE FROM teams      WHERE event_id IN (SELECT id FROM event WHERE name LIKE '%Export Test%');");
  await query("DELETE FROM event      WHERE name LIKE '%Export Test%';");
  await query("DELETE FROM users      WHERE email IN ($1, $2);", [ADMIN_EMAIL, LEAD_EMAIL]);
  await query("DELETE FROM users      WHERE email LIKE 'exp_%@t.com';");

  // Create users
  const aRes = await query("INSERT INTO users (email, name) VALUES ($1, 'Export Admin') RETURNING id;", [ADMIN_EMAIL]);
  adminUserId = aRes.rows[0].id;

  const lRes = await query("INSERT INTO users (email, name, phone) VALUES ($1, 'Export Lead', '9876540001') RETURNING id;", [LEAD_EMAIL]);
  leadUserId = lRes.rows[0].id;

  // Sign JWT cookies
  adminCookie = `${config.auth.cookieName}=${signToken({ userId: adminUserId, role: 'ADMIN' })}`;
  leadCookie  = `${config.auth.cookieName}=${signToken({ userId: leadUserId, role: 'TEAM_LEAD' })}`;

  // ---- Primary LIVE event ---------------------------------------------------
  const evPrimary = await query(
    `INSERT INTO event (name, status, correct_marks, wrong_marks, skip_marks)
     VALUES ('Export Test Primary', 'LIVE', 10, -5, -10) RETURNING id;`
  );
  primaryEventId = evPrimary.rows[0].id;

  // Questions
  primaryQuestionIds = [];
  for (let i = 1; i <= 2; i++) {
    const q = await query(
      `INSERT INTO questions (event_id, question_text, option_a, option_b, option_c, option_d, correct_option, time_limit_seconds, question_order)
       VALUES ($1, $2, 'A', 'B', 'C', 'D', 'A', 30, $3) RETURNING id;`,
      [primaryEventId, `Export Q${i}`, i]
    );
    primaryQuestionIds.push(q.rows[0].id);
  }

  // Team 1: APPROVED, Completed — score 20
  const t1u1 = await query("INSERT INTO users (email, name, phone) VALUES ('exp_lead1@t.com', 'Alpha Lead', '9876540010') RETURNING id;");
  const t1u2 = await query("INSERT INTO users (email, name, phone) VALUES ('exp_mem1@t.com', 'Alpha Member', '9876540011') RETURNING id;");
  const t1 = await query(
    `INSERT INTO teams (event_id, name, college, department, registration_status, whatsapp_group_joined, created_at)
     VALUES ($1, 'Alpha Exporters', 'Alpha College', 'CSE', 'APPROVED', true, NOW() - INTERVAL '3 hours') RETURNING id;`,
    [primaryEventId]
  );
  team1Id = t1.rows[0].id;
  await query("INSERT INTO team_members (team_id, user_id, event_id, role, register_number) VALUES ($1,$2,$3,'TEAM_LEAD','EX001');",
    [team1Id, t1u1.rows[0].id, primaryEventId]);
  await query("INSERT INTO team_members (team_id, user_id, event_id, role, register_number) VALUES ($1,$2,$3,'MEMBER','EX002');",
    [team1Id, t1u2.rows[0].id, primaryEventId]);

  const att1 = await query(
    `INSERT INTO attempts (team_id, event_id, started_at, completed_at, total_score)
     VALUES ($1, $2, NOW() - INTERVAL '90 minutes', NOW() - INTERVAL '60 minutes', 20) RETURNING id;`,
    [team1Id, primaryEventId]
  );
  await query(
    `INSERT INTO answers (attempt_id, question_id, event_id, selected_option, status, marks_awarded, answered_at)
     VALUES ($1, $2, $3, 'A', 'correct', 10, NOW() - INTERVAL '85 minutes'),
            ($1, $4, $3, 'A', 'correct', 10, NOW() - INTERVAL '75 minutes');`,
    [att1.rows[0].id, primaryQuestionIds[0], primaryEventId, primaryQuestionIds[1]]
  );

  // Team 2: APPROVED, Completed — score 10 (completed later than team1)
  const t2u1 = await query("INSERT INTO users (email, name, phone) VALUES ('exp_lead2@t.com', 'Beta Lead', '9876540020') RETURNING id;");
  const t2u2 = await query("INSERT INTO users (email, name, phone) VALUES ('exp_mem2@t.com', 'Béta Mömbér «unicode»', '9876540021') RETURNING id;");
  const t2 = await query(
    `INSERT INTO teams (event_id, name, college, department, registration_status, whatsapp_group_joined, created_at)
     VALUES ($1, 'Beta, "Exporters"', 'Beta College', 'ECE', 'APPROVED', true, NOW() - INTERVAL '2 hours') RETURNING id;`,
    [primaryEventId]
  );
  team2Id = t2.rows[0].id;
  await query("INSERT INTO team_members (team_id, user_id, event_id, role, register_number) VALUES ($1,$2,$3,'TEAM_LEAD','EX003');",
    [team2Id, t2u1.rows[0].id, primaryEventId]);
  await query("INSERT INTO team_members (team_id, user_id, event_id, role, register_number) VALUES ($1,$2,$3,'MEMBER','EX004');",
    [team2Id, t2u2.rows[0].id, primaryEventId]);

  const att2 = await query(
    `INSERT INTO attempts (team_id, event_id, started_at, completed_at, total_score)
     VALUES ($1, $2, NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '30 minutes', 10) RETURNING id;`,
    [team2Id, primaryEventId]
  );
  await query(
    `INSERT INTO answers (attempt_id, question_id, event_id, selected_option, status, marks_awarded, answered_at)
     VALUES ($1, $2, $3, 'A', 'correct', 10, NOW() - INTERVAL '44 minutes'),
            ($1, $4, $3, NULL, 'skipped', 0, NOW() - INTERVAL '30 minutes');`,
    [att2.rows[0].id, primaryQuestionIds[0], primaryEventId, primaryQuestionIds[1]]
  );

  // Team 3: APPROVED, Not-Started — no attempt
  const t3u1 = await query("INSERT INTO users (email, name, phone) VALUES ('exp_lead3@t.com', 'Gamma Lead', '9876540030') RETURNING id;");
  const t3u2 = await query("INSERT INTO users (email, name, phone) VALUES ('exp_mem3@t.com', 'Gamma Member', '9876540031') RETURNING id;");
  const t3 = await query(
    `INSERT INTO teams (event_id, name, college, department, registration_status, whatsapp_group_joined, created_at)
     VALUES ($1, 'Team With "Quotes, Commas"\nNewline', 'Gamma College', 'IT', 'PENDING', false, NOW() - INTERVAL '1 hour') RETURNING id;`,
    [primaryEventId]
  );
  team3Id = t3.rows[0].id;
  await query("INSERT INTO team_members (team_id, user_id, event_id, role, register_number) VALUES ($1,$2,$3,'TEAM_LEAD','EX005');",
    [team3Id, t3u1.rows[0].id, primaryEventId]);
  await query("INSERT INTO team_members (team_id, user_id, event_id, role, register_number) VALUES ($1,$2,$3,'MEMBER','EX006');",
    [team3Id, t3u2.rows[0].id, primaryEventId]);

  // ---- Empty READY event (no teams) ----------------------------------------
  const evEmpty = await query(
    `INSERT INTO event (name, status) VALUES ('Export Test Empty', 'READY') RETURNING id;`
  );
  emptyEventId = evEmpty.rows[0].id;

  // ---- Foreign READY event (for isolation tests) ----------------------------
  const evForeign = await query(
    `INSERT INTO event (name, status) VALUES ('Export Test Foreign', 'READY') RETURNING id;`
  );
  foreignEventId = evForeign.rows[0].id;

  const tFu1 = await query("INSERT INTO users (email, name, phone) VALUES ('exp_foreign@t.com', 'Foreign Lead', '9876540040') RETURNING id;");
  const tForeign = await query(
    `INSERT INTO teams (event_id, name, college, department, registration_status, whatsapp_group_joined)
     VALUES ($1, 'Foreign Team', 'Foreign College', 'AI', 'APPROVED', true) RETURNING id;`,
    [foreignEventId]
  );
  foreignTeamId = tForeign.rows[0].id;
  await query("INSERT INTO team_members (team_id, user_id, event_id, role, register_number) VALUES ($1,$2,$3,'TEAM_LEAD','EX099');",
    [foreignTeamId, tFu1.rows[0].id, foreignEventId]);
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
const runTests = async () => {
  console.log('\n=== Module 11: Admin CSV Exports Test Suite ===\n');

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  try {
    await setupDatabase();

    // =========================================================================
    // LEADERBOARD EXPORT
    // =========================================================================
    console.log('--- Leaderboard CSV Export ---');

    // -------------------------------------------------------------------------
    // Test 1: Admin can download leaderboard CSV
    // -------------------------------------------------------------------------
    await test('1. Admin can download leaderboard CSV (200, text/csv)', async () => {
      const res = await apiRaw(`/api/admin/exports/leaderboard.csv?eventId=${primaryEventId}`, adminCookie);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const ct = res.headers.get('content-type') || '';
      assert(ct.startsWith('text/csv'), `Expected text/csv, got: ${ct}`);
      const cd = res.headers.get('content-disposition') || '';
      assert(cd.includes('attachment'), 'Expected attachment disposition');
      assert(cd.includes('.csv'), 'Expected .csv in filename');
      assert(res.text.length > 0, 'Expected non-empty CSV body');
    });

    // -------------------------------------------------------------------------
    // Test 2: Non-admin (TEAM_LEAD) cannot download leaderboard CSV
    // -------------------------------------------------------------------------
    await test('2. Non-admin (TEAM_LEAD) cannot download leaderboard CSV (403)', async () => {
      const res = await apiRaw(`/api/admin/exports/leaderboard.csv?eventId=${primaryEventId}`, leadCookie);
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    // -------------------------------------------------------------------------
    // Test 3: Unauthenticated user cannot download leaderboard CSV
    // -------------------------------------------------------------------------
    await test('3. Unauthenticated user cannot download leaderboard CSV (401)', async () => {
      const res = await apiRaw(`/api/admin/exports/leaderboard.csv?eventId=${primaryEventId}`);
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    // -------------------------------------------------------------------------
    // Test 4: CSV headers are correct
    // -------------------------------------------------------------------------
    await test('4. Leaderboard CSV headers are correct', async () => {
      const res = await apiRaw(`/api/admin/exports/leaderboard.csv?eventId=${primaryEventId}`, adminCookie);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const rows = parseCsv(res.text);
      assert(rows.length >= 1, 'CSV must have at least a header row');
      const headers = rows[0];
      assert(headers[0] === 'Rank',         `Header[0] must be "Rank", got "${headers[0]}"`);
      assert(headers[1] === 'Team Name',    `Header[1] must be "Team Name", got "${headers[1]}"`);
      assert(headers[2] === 'Score',        `Header[2] must be "Score", got "${headers[2]}"`);
      assert(headers[3] === 'Status',       `Header[3] must be "Status", got "${headers[3]}"`);
      assert(headers[4] === 'Completed At', `Header[4] must be "Completed At", got "${headers[4]}"`);
      assert(headers[5] === 'Started At',   `Header[5] must be "Started At", got "${headers[5]}"`);
      assert(headers.length === 6,          `Expected exactly 6 columns, got ${headers.length}`);
    });

    // -------------------------------------------------------------------------
    // Test 5: Ranking exactly matches Module 8 ordering
    // -------------------------------------------------------------------------
    await test('5. Ranking exactly matches Module 8 leaderboard ranking', async () => {
      const res = await apiRaw(`/api/admin/exports/leaderboard.csv?eventId=${primaryEventId}`, adminCookie);
      const rows = parseCsv(res.text);
      const dataRows = rows.slice(1); // skip header

      // Completed teams should be first, ranked 1-based
      const completed = dataRows.filter((r) => r[3] === 'COMPLETED');
      assert(completed.length >= 2, `Expected at least 2 completed rows, got ${completed.length}`);

      // Rank 1 must have highest score
      assert(completed[0][0] === '1', `First completed row rank must be 1, got "${completed[0][0]}"`);
      assert(Number(completed[0][2]) >= Number(completed[1][2]),
        `Rank 1 score (${completed[0][2]}) must be >= Rank 2 score (${completed[1][2]})`);

      // Alpha Exporters (score 20) should be rank 1
      assert(completed[0][1] === 'Alpha Exporters',
        `Rank 1 team must be "Alpha Exporters", got "${completed[0][1]}"`);

      // Beta Exporters (score 10) should be rank 2
      assert(completed[1][1].startsWith('Beta'),
        `Rank 2 team must start with "Beta", got "${completed[1][1]}"`);

      // Incomplete teams have empty rank
      const incomplete = dataRows.filter((r) => r[3] !== 'COMPLETED');
      incomplete.forEach((r) => {
        assert(r[0] === '', `Non-completed row rank must be empty, got "${r[0]}"`);
      });
    });

    // -------------------------------------------------------------------------
    // Test 6: Scores exactly match stored attempt.total_score (no recalculation)
    // -------------------------------------------------------------------------
    await test('6. Scores exactly match stored attempt.total_score', async () => {
      // Verify from DB
      const dbAttempts = await query(
        `SELECT t.name, att.total_score
         FROM attempts att
         JOIN teams t ON t.id = att.team_id
         WHERE att.event_id = $1
         ORDER BY att.total_score DESC;`,
        [primaryEventId]
      );

      const res = await apiRaw(`/api/admin/exports/leaderboard.csv?eventId=${primaryEventId}`, adminCookie);
      const rows = parseCsv(res.text).slice(1);

      // Build a lookup of team name → score in CSV
      const csvScores = {};
      rows.forEach((r) => {
        if (r[1]) csvScores[r[1]] = r[2];
      });

      for (const dbRow of dbAttempts.rows) {
        const csvScore = csvScores[dbRow.name];
        if (csvScore !== undefined) {
          assert(
            Number(csvScore) === Number(dbRow.total_score),
            `Score mismatch for "${dbRow.name}": CSV=${csvScore}, DB=${dbRow.total_score}`
          );
        }
      }
    });

    // -------------------------------------------------------------------------
    // Test 7: No score mutation occurs after download
    // -------------------------------------------------------------------------
    await test('7. No score mutation occurs after CSV download', async () => {
      // Read scores before
      const before = await query(
        'SELECT id, total_score FROM attempts WHERE event_id = $1 ORDER BY id;',
        [primaryEventId]
      );

      await apiRaw(`/api/admin/exports/leaderboard.csv?eventId=${primaryEventId}`, adminCookie);

      const after = await query(
        'SELECT id, total_score FROM attempts WHERE event_id = $1 ORDER BY id;',
        [primaryEventId]
      );

      assert(before.rows.length === after.rows.length, 'Attempt count must not change');
      for (let i = 0; i < before.rows.length; i++) {
        assert(
          String(before.rows[i].total_score) === String(after.rows[i].total_score),
          `Score mutated for attempt ${before.rows[i].id}: ${before.rows[i].total_score} → ${after.rows[i].total_score}`
        );
      }
    });

    // -------------------------------------------------------------------------
    // Test 8: No sensitive fields appear in leaderboard CSV
    // -------------------------------------------------------------------------
    await test('8. No sensitive fields appear in leaderboard CSV', async () => {
      const res = await apiRaw(`/api/admin/exports/leaderboard.csv?eventId=${primaryEventId}`, adminCookie);
      const body = res.text.toLowerCase();

      const forbidden = ['email', 'phone', 'otp', 'password', 'jwt', 'token', 'payment', 'secret', 'cookie'];
      for (const f of forbidden) {
        assert(!body.includes(f), `Forbidden field "${f}" found in leaderboard CSV`);
      }
    });

    // -------------------------------------------------------------------------
    // Test 9: Event isolation — leaderboard CSV scoped to requested event
    // -------------------------------------------------------------------------
    await test('9. Event isolation: leaderboard scoped to requested event', async () => {
      // Request primary event — Foreign Team must NOT appear
      const primary = await apiRaw(`/api/admin/exports/leaderboard.csv?eventId=${primaryEventId}`, adminCookie);
      assert(!primary.text.includes('Foreign Team'), 'Foreign Team must not appear in primary event export');

      // Request foreign event — Alpha/Beta/Gamma must NOT appear
      const foreign = await apiRaw(`/api/admin/exports/leaderboard.csv?eventId=${foreignEventId}`, adminCookie);
      assert(!foreign.text.includes('Alpha Exporters'), 'Alpha Exporters must not appear in foreign event export');
    });

    // =========================================================================
    // REGISTRATIONS EXPORT
    // =========================================================================
    console.log('\n--- Registrations CSV Export ---');

    // -------------------------------------------------------------------------
    // Test 10: Admin can download registrations CSV
    // -------------------------------------------------------------------------
    await test('10. Admin can download registrations CSV (200, text/csv)', async () => {
      const res = await apiRaw(`/api/admin/exports/registrations.csv?eventId=${primaryEventId}`, adminCookie);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const ct = res.headers.get('content-type') || '';
      assert(ct.startsWith('text/csv'), `Expected text/csv, got: ${ct}`);
      const cd = res.headers.get('content-disposition') || '';
      assert(cd.includes('attachment'), 'Expected attachment disposition');
      assert(res.text.length > 0, 'Expected non-empty CSV body');
    });

    // -------------------------------------------------------------------------
    // Test 11: Non-admin cannot download registrations CSV
    // -------------------------------------------------------------------------
    await test('11. Non-admin (TEAM_LEAD) cannot download registrations CSV (403)', async () => {
      const res = await apiRaw(`/api/admin/exports/registrations.csv?eventId=${primaryEventId}`, leadCookie);
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    // -------------------------------------------------------------------------
    // Test 12: Unauthenticated user cannot download registrations CSV
    // -------------------------------------------------------------------------
    await test('12. Unauthenticated user cannot download registrations CSV (401)', async () => {
      const res = await apiRaw(`/api/admin/exports/registrations.csv?eventId=${primaryEventId}`);
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    // -------------------------------------------------------------------------
    // Test 13: CSV contains all registered members (one row per member)
    // -------------------------------------------------------------------------
    await test('13. CSV contains all registered members correctly (one row per member)', async () => {
      const res = await apiRaw(`/api/admin/exports/registrations.csv?eventId=${primaryEventId}`, adminCookie);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const rows = parseCsv(res.text);
      assert(rows.length >= 1, 'Must have at least header row');

      // 3 teams × 2 members = 6 member rows
      const dataRows = rows.slice(1);
      assert(dataRows.length === 6, `Expected 6 member rows, got ${dataRows.length}`);

      // Check all known members are present
      const names = dataRows.map((r) => r[3]); // "Member Name" is index 3
      assert(names.includes('Alpha Lead'),   'Alpha Lead must be in export');
      assert(names.includes('Alpha Member'), 'Alpha Member must be in export');
      assert(names.includes('Beta Lead'),    'Beta Lead must be in export');
    });

    // -------------------------------------------------------------------------
    // Test 14: Team lead / member roles are correctly identified
    // -------------------------------------------------------------------------
    await test('14. Team lead / member roles are correctly identified', async () => {
      const res = await apiRaw(`/api/admin/exports/registrations.csv?eventId=${primaryEventId}`, adminCookie);
      const rows = parseCsv(res.text).slice(1);

      // Column 9 = "Member Role"
      const roles = rows.map((r) => r[9]);
      assert(roles.includes('TEAM_LEAD'), 'At least one TEAM_LEAD must be present');
      assert(roles.includes('MEMBER'),    'At least one MEMBER must be present');

      // Each team must have exactly one TEAM_LEAD
      const leadsByTeam = {};
      rows.forEach((r) => {
        const team = r[0]; // "Team Name"
        const role = r[9]; // "Member Role"
        if (role === 'TEAM_LEAD') leadsByTeam[team] = (leadsByTeam[team] || 0) + 1;
      });
      for (const [team, count] of Object.entries(leadsByTeam)) {
        assert(count === 1, `Team "${team}" must have exactly 1 TEAM_LEAD, got ${count}`);
      }
    });

    // -------------------------------------------------------------------------
    // Test 15: WhatsApp confirmation is exported correctly
    // -------------------------------------------------------------------------
    await test('15. WhatsApp confirmation exported correctly (Yes/No)', async () => {
      const res = await apiRaw(`/api/admin/exports/registrations.csv?eventId=${primaryEventId}`, adminCookie);
      const rows = parseCsv(res.text).slice(1);

      // Column 10 = "WhatsApp Group Confirmation"
      // Team 1 & 2 joined (true → Yes), Team 3 did not (false → No)
      const alpha = rows.filter((r) => r[0] === 'Alpha Exporters');
      alpha.forEach((r) => {
        assert(r[10] === 'Yes', `Alpha Exporters members should have WhatsApp=Yes, got "${r[10]}"`);
      });

      const gamma = rows.filter((r) => r[0].startsWith('Team With'));
      gamma.forEach((r) => {
        assert(r[10] === 'No', `Gamma-equivalent team should have WhatsApp=No, got "${r[10]}"`);
      });
    });

    // -------------------------------------------------------------------------
    // Test 16: Payment fields NOT exported
    // -------------------------------------------------------------------------
    await test('16. Payment fields (payment_id, payment_proof_path) are NOT in the CSV', async () => {
      const res = await apiRaw(`/api/admin/exports/registrations.csv?eventId=${primaryEventId}`, adminCookie);
      const body = res.text.toLowerCase();

      assert(!body.includes('payment_id'),         'payment_id must NOT appear in CSV');
      assert(!body.includes('payment_proof'),       'payment_proof must NOT appear in CSV');
      assert(!body.includes('proof_path'),          'proof_path must NOT appear in CSV');
      assert(!body.includes('payment'),             'payment column heading must NOT appear in CSV');

      // Verify headers
      const headers = parseCsv(res.text)[0];
      const hasPaymentHeader = headers.some((h) => h.toLowerCase().includes('payment'));
      assert(!hasPaymentHeader, 'No payment-related column header must exist in registrations CSV');
    });

    // -------------------------------------------------------------------------
    // Test 17: OTP / password / JWT / secrets NOT in CSV
    // -------------------------------------------------------------------------
    await test('17. OTP / password / JWT / secrets are NOT in the CSV', async () => {
      const res = await apiRaw(`/api/admin/exports/registrations.csv?eventId=${primaryEventId}`, adminCookie);
      const body = res.text.toLowerCase();

      const forbidden = ['otp', 'password', 'jwt', 'token', 'secret', 'cookie', 'hash'];
      for (const f of forbidden) {
        assert(!body.includes(f), `Forbidden field "${f}" found in registrations CSV`);
      }
    });

    // -------------------------------------------------------------------------
    // Test 18: Event isolation — registrations CSV scoped to requested event
    // -------------------------------------------------------------------------
    await test('18. Event isolation: registrations scoped to requested event', async () => {
      const primary = await apiRaw(`/api/admin/exports/registrations.csv?eventId=${primaryEventId}`, adminCookie);
      assert(!primary.text.includes('Foreign Team'), 'Foreign Team must not appear in primary export');

      const foreign = await apiRaw(`/api/admin/exports/registrations.csv?eventId=${foreignEventId}`, adminCookie);
      assert(!foreign.text.includes('Alpha Exporters'), 'Alpha Exporters must not appear in foreign export');
      assert(foreign.text.includes('Foreign Team'), 'Foreign Team must appear in foreign event export');
    });

    // -------------------------------------------------------------------------
    // Test 19: CSV escaping — commas, double-quotes, Unicode, newlines
    // -------------------------------------------------------------------------
    await test('19. CSV escaping: commas, double-quotes, Unicode, newlines are safe', async () => {
      const res = await apiRaw(`/api/admin/exports/registrations.csv?eventId=${primaryEventId}`, adminCookie);
      assert(res.status === 200, `Expected 200, got ${res.status}`);

      const rows = parseCsv(res.text);
      const allTeamNames = rows.slice(1).map((r) => r[0]);

      // Team 2 name was: Beta, "Exporters" — should be recovered correctly
      assert(
        allTeamNames.some((n) => n === 'Beta, "Exporters"'),
        `Comma and quote in team name must be round-tripped safely. Got: ${allTeamNames.join(' | ')}`
      );

      // Team 3 has newline in name — should appear as a single parsed field
      assert(
        allTeamNames.some((n) => n.startsWith('Team With')),
        `Team name with newline must be present and parseable. Got: ${allTeamNames.join(' | ')}`
      );

      // Unicode member name (Béta Mömbér «unicode»)
      const allMemberNames = rows.slice(1).map((r) => r[3]);
      assert(
        allMemberNames.some((n) => n.includes('Béta') || n.includes('unicode')),
        `Unicode name must be preserved. Got: ${allMemberNames.join(' | ')}`
      );
    });

    // -------------------------------------------------------------------------
    // Test 20: No-data event (0 teams) handled safely — header-only CSV, 200 OK
    // -------------------------------------------------------------------------
    await test('20. No-data event (0 teams) handled safely (header-only CSV, 200)', async () => {
      const res = await apiRaw(`/api/admin/exports/registrations.csv?eventId=${emptyEventId}`, adminCookie);
      assert(res.status === 200, `Expected 200 for empty event, got ${res.status}`);

      const ct = res.headers.get('content-type') || '';
      assert(ct.startsWith('text/csv'), `Expected text/csv, got: ${ct}`);

      const rows = parseCsv(res.text);
      // Should have exactly 1 row (the header row) and no data rows
      assert(rows.length === 1, `Expected 1 header row for empty event, got ${rows.length} rows`);
    });

  } finally {
    // ---- Cleanup ----
    await query("DELETE FROM answers    WHERE attempt_id IN (SELECT id FROM attempts WHERE event_id IN (SELECT id FROM event WHERE name LIKE '%Export Test%'));");
    await query("DELETE FROM attempts   WHERE event_id IN (SELECT id FROM event WHERE name LIKE '%Export Test%');");
    await query("DELETE FROM questions  WHERE event_id IN (SELECT id FROM event WHERE name LIKE '%Export Test%');");
    await query("DELETE FROM team_members WHERE event_id IN (SELECT id FROM event WHERE name LIKE '%Export Test%');");
    await query("DELETE FROM teams      WHERE event_id IN (SELECT id FROM event WHERE name LIKE '%Export Test%');");
    await query("DELETE FROM event      WHERE name LIKE '%Export Test%';");
    await query("DELETE FROM users      WHERE email IN ($1, $2);", [ADMIN_EMAIL, LEAD_EMAIL]);
    await query("DELETE FROM users      WHERE email LIKE 'exp_%@t.com';");

    if (server) await new Promise((resolve) => server.close(resolve));
    await closePool();
  }

  console.log('\n----------------------------------------');
  console.log(`Results: ${passCount} passed, ${failCount} failed`);
  console.log('----------------------------------------\n');

  if (failCount > 0) process.exit(1);
};

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
