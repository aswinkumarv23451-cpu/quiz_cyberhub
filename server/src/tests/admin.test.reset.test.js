/**
 * Module 12: Safe Admin Test Reset — Test Suite
 *
 * Verifies all 23 minimum test requirements:
 *  1. Admin can reset a development/test event with exact confirmation.
 *  2. Unauthenticated user cannot reset (401).
 *  3. Non-admin cannot reset (403).
 *  4. Production environment rejects reset (403).
 *  5. Invalid UUID is rejected (400).
 *  6. Missing eventId is rejected (400).
 *  7. Wrong confirmation is rejected (400).
 *  8. Missing confirmation is rejected (400).
 *  9. Non-existent event is rejected (404).
 * 10. Only selected event data is deleted.
 * 11. Other events remain untouched.
 * 12. Questions remain untouched.
 * 13. Admin users remain untouched.
 * 14. Event remains with same name/description/scoring.
 * 15. Event status becomes READY.
 * 16. Teams are deleted.
 * 17. Team members are deleted.
 * 18. Attempts are deleted.
 * 19. Answers are deleted.
 * 20. Participant users belonging only to the reset event are deleted safely.
 * 21. Transaction rolls back if reset fails midway.
 * 22. Successful response contains counts only, not participant PII/secrets.
 * 23. Reset cannot affect unrelated database tables.
 */

import http from 'http';
import { query, closePool, getClient } from '../config/database.js';
import { config } from '../config/env.js';
import app from '../app.js';
import { signToken } from '../services/auth.service.js';
import { resetTestEventService } from '../services/admin.reset.service.js';

config.email.provider = 'test';
config.nodeEnv = 'test';

// ---------------------------------------------------------------------------
// Shared State & Test Runner Helpers
// ---------------------------------------------------------------------------
let server;
let baseUrl;

const ADMIN_EMAIL = 'admin@round1.tech';
const LEAD_EMAIL = 'reset_lead@test.com';

let adminUserId;
let leadUserId;
let adminCookie;
let leadCookie;

let primaryEventId;
let foreignEventId;

let primaryQuestionIds = [];
let foreignQuestionIds = [];

let sharedUserId; // member of BOTH primary and foreign event

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

const apiJson = async (endpoint, options = {}, cookieHeader = null) => {
  const url = `${baseUrl}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (cookieHeader) headers['Cookie'] = cookieHeader;

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

// ---------------------------------------------------------------------------
// Setup & Teardown
// ---------------------------------------------------------------------------
const cleanDatabase = async () => {
  await query("DELETE FROM answers WHERE attempt_id IN (SELECT id FROM attempts WHERE event_id IN (SELECT id FROM event WHERE name LIKE '%Reset Module 12%'));");
  await query("DELETE FROM attempts WHERE event_id IN (SELECT id FROM event WHERE name LIKE '%Reset Module 12%');");
  await query("DELETE FROM questions WHERE event_id IN (SELECT id FROM event WHERE name LIKE '%Reset Module 12%');");
  await query("DELETE FROM team_members WHERE event_id IN (SELECT id FROM event WHERE name LIKE '%Reset Module 12%');");
  await query("DELETE FROM teams WHERE event_id IN (SELECT id FROM event WHERE name LIKE '%Reset Module 12%');");
  await query("DELETE FROM event WHERE name LIKE '%Reset Module 12%';");
  await query("DELETE FROM users WHERE email IN ($1, $2);", [ADMIN_EMAIL, LEAD_EMAIL]);
  await query("DELETE FROM users WHERE email LIKE 'reset_%@t.com';");
};

const populateDatabase = async () => {
  await cleanDatabase();

  // Admin user
  const aRes = await query("INSERT INTO users (email, name) VALUES ($1, 'Reset Admin') RETURNING id;", [ADMIN_EMAIL]);
  adminUserId = aRes.rows[0].id;
  adminCookie = `${config.auth.cookieName}=${signToken({ userId: adminUserId, role: 'ADMIN' })}`;

  // Lead / non-admin user
  const lRes = await query("INSERT INTO users (email, name, phone) VALUES ($1, 'Reset Lead User', '9999900001') RETURNING id;", [LEAD_EMAIL]);
  leadUserId = lRes.rows[0].id;
  leadCookie = `${config.auth.cookieName}=${signToken({ userId: leadUserId, role: 'TEAM_LEAD' })}`;

  // Shared user (belongs to both primary and foreign events)
  const sRes = await query("INSERT INTO users (email, name, phone) VALUES ('reset_shared@t.com', 'Shared Member', '9999900002') RETURNING id;");
  sharedUserId = sRes.rows[0].id;

  // Primary Event (to be reset) - starts as LIVE
  const ev1 = await query(
    `INSERT INTO event (name, description, status, correct_marks, wrong_marks, skip_marks)
     VALUES ('Reset Module 12 Primary', 'Event for test reset', 'LIVE', 15, -4, -8) RETURNING id;`
  );
  primaryEventId = ev1.rows[0].id;

  // Primary Event Questions (2 questions)
  primaryQuestionIds = [];
  for (let i = 1; i <= 2; i++) {
    const q = await query(
      `INSERT INTO questions (event_id, question_text, option_a, option_b, option_c, option_d, correct_option, time_limit_seconds, question_order)
       VALUES ($1, $2, 'A', 'B', 'C', 'D', 'A', 30, $3) RETURNING id;`,
      [primaryEventId, `Primary Q${i}`, i]
    );
    primaryQuestionIds.push(q.rows[0].id);
  }

  // Primary Event Teams:
  // Team 1: has attempts & answers
  const p1u = await query("INSERT INTO users (email, name, phone) VALUES ('reset_p1@t.com', 'Primary Member 1', '9999900010') RETURNING id;");
  const t1 = await query(
    `INSERT INTO teams (event_id, name, college, department, registration_status, whatsapp_group_joined)
     VALUES ($1, 'Primary Team Alpha', 'Alpha College', 'CSE', 'APPROVED', true) RETURNING id;`,
    [primaryEventId]
  );
  const team1Id = t1.rows[0].id;
  await query("INSERT INTO team_members (team_id, user_id, event_id, role, register_number) VALUES ($1,$2,$3,'TEAM_LEAD','R001');",
    [team1Id, p1u.rows[0].id, primaryEventId]);
  await query("INSERT INTO team_members (team_id, user_id, event_id, role, register_number) VALUES ($1,$2,$3,'MEMBER','R002');",
    [team1Id, sharedUserId, primaryEventId]);

  const att1 = await query(
    `INSERT INTO attempts (team_id, event_id, started_at, completed_at, total_score)
     VALUES ($1, $2, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '10 minutes', 15) RETURNING id;`,
    [team1Id, primaryEventId]
  );
  await query(
    `INSERT INTO answers (attempt_id, question_id, event_id, selected_option, status, marks_awarded, answered_at)
     VALUES ($1, $2, $3, 'A', 'correct', 15, NOW() - INTERVAL '20 minutes');`,
    [att1.rows[0].id, primaryQuestionIds[0], primaryEventId]
  );

  // Team 2: no attempts
  const p2u = await query("INSERT INTO users (email, name, phone) VALUES ('reset_p2@t.com', 'Primary Member 2', '9999900020') RETURNING id;");
  const t2 = await query(
    `INSERT INTO teams (event_id, name, college, department, registration_status, whatsapp_group_joined)
     VALUES ($1, 'Primary Team Beta', 'Beta College', 'ECE', 'PENDING', false) RETURNING id;`,
    [primaryEventId]
  );
  const team2Id = t2.rows[0].id;
  await query("INSERT INTO team_members (team_id, user_id, event_id, role, register_number) VALUES ($1,$2,$3,'TEAM_LEAD','R003');",
    [team2Id, p2u.rows[0].id, primaryEventId]);

  // Foreign Event (must remain untouched!)
  const ev2 = await query(
    `INSERT INTO event (name, description, status, correct_marks, wrong_marks, skip_marks)
     VALUES ('Reset Module 12 Foreign', 'Foreign untouched event', 'LIVE', 10, -5, -10) RETURNING id;`
  );
  foreignEventId = ev2.rows[0].id;

  const fq = await query(
    `INSERT INTO questions (event_id, question_text, option_a, option_b, option_c, option_d, correct_option, time_limit_seconds, question_order)
     VALUES ($1, 'Foreign Q1', 'A', 'B', 'C', 'D', 'B', 45, 1) RETURNING id;`,
    [foreignEventId]
  );
  foreignQuestionIds = [fq.rows[0].id];

  const f1u = await query("INSERT INTO users (email, name, phone) VALUES ('reset_foreign@t.com', 'Foreign Member', '9999900099') RETURNING id;");
  const tf = await query(
    `INSERT INTO teams (event_id, name, college, department, registration_status, whatsapp_group_joined)
     VALUES ($1, 'Foreign Team Omega', 'Omega Tech', 'IT', 'APPROVED', true) RETURNING id;`,
    [foreignEventId]
  );
  const foreignTeamId = tf.rows[0].id;
  await query("INSERT INTO team_members (team_id, user_id, event_id, role, register_number) VALUES ($1,$2,$3,'TEAM_LEAD','F001');",
    [foreignTeamId, f1u.rows[0].id, foreignEventId]);
  await query("INSERT INTO team_members (team_id, user_id, event_id, role, register_number) VALUES ($1,$2,$3,'MEMBER','F002');",
    [foreignTeamId, sharedUserId, foreignEventId]);

  const attForeign = await query(
    `INSERT INTO attempts (team_id, event_id, started_at, completed_at, total_score)
     VALUES ($1, $2, NOW() - INTERVAL '10 minutes', NULL, 0) RETURNING id;`,
    [foreignTeamId, foreignEventId]
  );
  await query(
    `INSERT INTO answers (attempt_id, question_id, event_id, selected_option, status, marks_awarded, answered_at)
     VALUES ($1, $2, $3, 'B', 'correct', 10, NOW() - INTERVAL '5 minutes');`,
    [attForeign.rows[0].id, foreignQuestionIds[0], foreignEventId]
  );
};

// ---------------------------------------------------------------------------
// Run Test Suite
// ---------------------------------------------------------------------------
const run = async () => {
  console.log('\n=== Module 12: Safe Admin Test Reset Test Suite ===\n');

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  try {
    await populateDatabase();

    // -------------------------------------------------------------------------
    // Test 2: Unauthenticated user cannot reset
    // -------------------------------------------------------------------------
    await test('2. Unauthenticated user cannot reset (401)', async () => {
      const res = await apiJson('/api/admin/test-reset', {
        method: 'POST',
        body: JSON.stringify({ eventId: primaryEventId, confirmation: 'RESET ROUND 1' }),
      });
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    // -------------------------------------------------------------------------
    // Test 3: Non-admin cannot reset
    // -------------------------------------------------------------------------
    await test('3. Non-admin (TEAM_LEAD) cannot reset (403)', async () => {
      const res = await apiJson(
        '/api/admin/test-reset',
        {
          method: 'POST',
          body: JSON.stringify({ eventId: primaryEventId, confirmation: 'RESET ROUND 1' }),
        },
        leadCookie
      );
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    // -------------------------------------------------------------------------
    // Test 4: Production environment rejects reset
    // -------------------------------------------------------------------------
    await test('4. Production environment rejects reset (403)', async () => {
      const origEnv = config.nodeEnv;
      config.nodeEnv = 'production';
      try {
        const res = await apiJson(
          '/api/admin/test-reset',
          {
            method: 'POST',
            body: JSON.stringify({ eventId: primaryEventId, confirmation: 'RESET ROUND 1' }),
          },
          adminCookie
        );
        assert(res.status === 403, `Expected 403 in production, got ${res.status}`);
        assert(
          res.data?.message === 'Test reset is disabled in production.',
          `Expected disabled in production message, got: ${res.data?.message}`
        );
      } finally {
        config.nodeEnv = origEnv;
      }
    });

    // -------------------------------------------------------------------------
    // Test 5: Invalid UUID is rejected
    // -------------------------------------------------------------------------
    await test('5. Invalid UUID format is rejected (400)', async () => {
      const res = await apiJson(
        '/api/admin/test-reset',
        {
          method: 'POST',
          body: JSON.stringify({ eventId: 'not-a-valid-uuid', confirmation: 'RESET ROUND 1' }),
        },
        adminCookie
      );
      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    // -------------------------------------------------------------------------
    // Test 6: Missing eventId is rejected
    // -------------------------------------------------------------------------
    await test('6. Missing eventId is rejected (400)', async () => {
      const res = await apiJson(
        '/api/admin/test-reset',
        {
          method: 'POST',
          body: JSON.stringify({ confirmation: 'RESET ROUND 1' }),
        },
        adminCookie
      );
      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    // -------------------------------------------------------------------------
    // Test 7: Wrong confirmation is rejected
    // -------------------------------------------------------------------------
    await test('7. Wrong confirmation string is rejected (400)', async () => {
      const wrongValues = ['reset round 1', 'RESET', 'YES', 'RESET ROUND 2', 'RESET ROUND 1 '];
      for (const val of wrongValues) {
        const res = await apiJson(
          '/api/admin/test-reset',
          {
            method: 'POST',
            body: JSON.stringify({ eventId: primaryEventId, confirmation: val }),
          },
          adminCookie
        );
        assert(res.status === 400, `Expected 400 for wrong confirmation "${val}", got ${res.status}`);
      }
    });

    // -------------------------------------------------------------------------
    // Test 8: Missing confirmation is rejected
    // -------------------------------------------------------------------------
    await test('8. Missing confirmation is rejected (400)', async () => {
      const res = await apiJson(
        '/api/admin/test-reset',
        {
          method: 'POST',
          body: JSON.stringify({ eventId: primaryEventId }),
        },
        adminCookie
      );
      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    // -------------------------------------------------------------------------
    // Test 9: Non-existent event is rejected
    // -------------------------------------------------------------------------
    await test('9. Non-existent event is rejected (404)', async () => {
      const res = await apiJson(
        '/api/admin/test-reset',
        {
          method: 'POST',
          body: JSON.stringify({
            eventId: 'a0000000-0000-0000-0000-000000000000',
            confirmation: 'RESET ROUND 1',
          }),
        },
        adminCookie
      );
      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    // -------------------------------------------------------------------------
    // Test 1: Admin can reset a development/test event with exact confirmation
    // -------------------------------------------------------------------------
    let resetResultData;
    await test('1. Admin can reset development/test event with exact confirmation (200)', async () => {
      const res = await apiJson(
        '/api/admin/test-reset',
        {
          method: 'POST',
          body: JSON.stringify({ eventId: primaryEventId, confirmation: 'RESET ROUND 1' }),
        },
        adminCookie
      );
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data?.success === true, 'Expected success: true');
      assert(res.data?.eventId === primaryEventId, 'Returned eventId must match');
      resetResultData = res.data;
    });

    // -------------------------------------------------------------------------
    // Test 10: Only selected event data is deleted
    // -------------------------------------------------------------------------
    await test('10. Only selected event data is deleted', async () => {
      const ptCount = await query('SELECT count(*) FROM teams WHERE event_id = $1;', [primaryEventId]);
      assert(parseInt(ptCount.rows[0].count, 10) === 0, 'Primary event teams must be 0');

      const ftCount = await query('SELECT count(*) FROM teams WHERE event_id = $1;', [foreignEventId]);
      assert(parseInt(ftCount.rows[0].count, 10) === 1, 'Foreign event teams must remain 1');
    });

    // -------------------------------------------------------------------------
    // Test 11: Other events remain untouched
    // -------------------------------------------------------------------------
    await test('11. Other events remain untouched', async () => {
      const fe = await query('SELECT * FROM event WHERE id = $1;', [foreignEventId]);
      assert(fe.rows.length === 1, 'Foreign event must exist');
      assert(fe.rows[0].status === 'LIVE', `Foreign event status must remain LIVE, got ${fe.rows[0].status}`);

      const fa = await query('SELECT count(*) FROM attempts WHERE event_id = $1;', [foreignEventId]);
      assert(parseInt(fa.rows[0].count, 10) === 1, 'Foreign event attempts must remain intact');

      const fans = await query('SELECT count(*) FROM answers WHERE event_id = $1;', [foreignEventId]);
      assert(parseInt(fans.rows[0].count, 10) === 1, 'Foreign event answers must remain intact');
    });

    // -------------------------------------------------------------------------
    // Test 12: Questions remain untouched
    // -------------------------------------------------------------------------
    await test('12. Questions remain untouched for reset event', async () => {
      const qRes = await query('SELECT count(*) FROM questions WHERE event_id = $1;', [primaryEventId]);
      assert(parseInt(qRes.rows[0].count, 10) === 2, `Expected 2 questions preserved, got ${qRes.rows[0].count}`);
    });

    // -------------------------------------------------------------------------
    // Test 13: Admin users remain untouched
    // -------------------------------------------------------------------------
    await test('13. Admin users remain untouched', async () => {
      const a = await query('SELECT * FROM users WHERE email = $1;', [ADMIN_EMAIL]);
      assert(a.rows.length === 1, 'Admin user must still exist');
    });

    // -------------------------------------------------------------------------
    // Test 14: Event remains with same name/description/scoring
    // -------------------------------------------------------------------------
    await test('14. Event remains with same name, description, and scoring', async () => {
      const pe = await query('SELECT * FROM event WHERE id = $1;', [primaryEventId]);
      assert(pe.rows.length === 1, 'Primary event must still exist');
      assert(pe.rows[0].name === 'Reset Module 12 Primary', 'Event name must be preserved');
      assert(pe.rows[0].description === 'Event for test reset', 'Event description must be preserved');
      assert(pe.rows[0].correct_marks === 15, 'correct_marks must be preserved');
      assert(pe.rows[0].wrong_marks === -4, 'wrong_marks must be preserved');
      assert(pe.rows[0].skip_marks === -8, 'skip_marks must be preserved');
    });

    // -------------------------------------------------------------------------
    // Test 15: Event status becomes READY
    // -------------------------------------------------------------------------
    await test('15. Event status becomes READY', async () => {
      const pe = await query('SELECT status FROM event WHERE id = $1;', [primaryEventId]);
      assert(pe.rows[0].status === 'READY', `Expected status READY, got ${pe.rows[0].status}`);
    });

    // -------------------------------------------------------------------------
    // Test 16: Teams are deleted
    // -------------------------------------------------------------------------
    await test('16. Teams are deleted for the reset event', async () => {
      const t = await query('SELECT count(*) FROM teams WHERE event_id = $1;', [primaryEventId]);
      assert(parseInt(t.rows[0].count, 10) === 0, 'Teams count must be 0');
    });

    // -------------------------------------------------------------------------
    // Test 17: Team members are deleted
    // -------------------------------------------------------------------------
    await test('17. Team members are deleted for the reset event', async () => {
      const tm = await query('SELECT count(*) FROM team_members WHERE event_id = $1;', [primaryEventId]);
      assert(parseInt(tm.rows[0].count, 10) === 0, 'Team members count must be 0');
    });

    // -------------------------------------------------------------------------
    // Test 18: Attempts are deleted
    // -------------------------------------------------------------------------
    await test('18. Attempts are deleted for the reset event', async () => {
      const att = await query('SELECT count(*) FROM attempts WHERE event_id = $1;', [primaryEventId]);
      assert(parseInt(att.rows[0].count, 10) === 0, 'Attempts count must be 0');
    });

    // -------------------------------------------------------------------------
    // Test 19: Answers are deleted
    // -------------------------------------------------------------------------
    await test('19. Answers are deleted for the reset event', async () => {
      const ans = await query('SELECT count(*) FROM answers WHERE event_id = $1;', [primaryEventId]);
      assert(parseInt(ans.rows[0].count, 10) === 0, 'Answers count must be 0');
    });

    // -------------------------------------------------------------------------
    // Test 20: Participant users belonging only to reset event are deleted safely
    // -------------------------------------------------------------------------
    await test('20. Participant users belonging only to reset event deleted; multi-event user preserved', async () => {
      // p1 and p2 should have been deleted (they only belonged to primary event)
      const u1 = await query("SELECT * FROM users WHERE email = 'reset_p1@t.com';");
      assert(u1.rows.length === 0, 'reset_p1@t.com must be deleted');
      const u2 = await query("SELECT * FROM users WHERE email = 'reset_p2@t.com';");
      assert(u2.rows.length === 0, 'reset_p2@t.com must be deleted');

      // Shared user belongs to foreign event too, must NOT be deleted!
      const s = await query("SELECT * FROM users WHERE email = 'reset_shared@t.com';");
      assert(s.rows.length === 1, 'reset_shared@t.com must NOT be deleted');

      // Foreign member must NOT be deleted
      const f = await query("SELECT * FROM users WHERE email = 'reset_foreign@t.com';");
      assert(f.rows.length === 1, 'reset_foreign@t.com must NOT be deleted');
    });

    // -------------------------------------------------------------------------
    // Test 21: Transaction rolls back if reset fails midway
    // -------------------------------------------------------------------------
    await test('21. Transaction rolls back if reset fails midway (leaves DB unchanged)', async () => {
      // Re-populate foreign event with fresh team & attempt to test rollback on it
      const client = await getClient();
      try {
        // Create a temporary table or trigger on answers to force an error on delete,
        // or test rollback using an invalid operation midway.
        // Let's create an explicit BEFORE DELETE trigger on answers that raises an exception:
        await client.query(`
          CREATE OR REPLACE FUNCTION fail_trigger() RETURNS TRIGGER AS $$
          BEGIN
            RAISE EXCEPTION 'Simulated mid-transaction failure';
          END;
          $$ LANGUAGE plpgsql;
        `);
        await client.query(`
          CREATE TRIGGER trg_test_fail_answers
          BEFORE DELETE ON answers
          FOR EACH ROW EXECUTE FUNCTION fail_trigger();
        `);

        // Capture state before reset call
        const beforeTeams = await client.query('SELECT count(*) FROM teams WHERE event_id = $1;', [foreignEventId]);
        const beforeEvent = await client.query('SELECT status FROM event WHERE id = $1;', [foreignEventId]);

        let threw = false;
        try {
          await resetTestEventService({
            eventId: foreignEventId,
            confirmation: 'RESET ROUND 1',
          });
        } catch (err) {
          threw = true;
          assert(err.message.includes('Simulated mid-transaction failure'), `Expected simulated error, got: ${err.message}`);
        }
        assert(threw, 'Expected resetTestEventService to throw an error');

        // Check that foreign event was rolled back completely
        const afterTeams = await client.query('SELECT count(*) FROM teams WHERE event_id = $1;', [foreignEventId]);
        assert(
          beforeTeams.rows[0].count === afterTeams.rows[0].count,
          'Teams count must remain unchanged after rollback'
        );

        const afterEvent = await client.query('SELECT status FROM event WHERE id = $1;', [foreignEventId]);
        assert(
          afterEvent.rows[0].status === beforeEvent.rows[0].status,
          `Event status must remain ${beforeEvent.rows[0].status} after rollback, got ${afterEvent.rows[0].status}`
        );
      } finally {
        // Drop temporary test trigger
        await client.query('DROP TRIGGER IF EXISTS trg_test_fail_answers ON answers;');
        await client.query('DROP FUNCTION IF EXISTS fail_trigger;');
        client.release();
      }
    });

    // -------------------------------------------------------------------------
    // Test 22: Successful response contains counts only, not participant PII/secrets
    // -------------------------------------------------------------------------
    await test('22. Successful response contains counts only, not participant PII/secrets', async () => {
      assert(resetResultData, 'resetResultData must be available from Test 1');
      assert(typeof resetResultData.deleted === 'object', 'Must have deleted object');
      assert(typeof resetResultData.deleted.teams === 'number', 'deleted.teams must be a number');
      assert(typeof resetResultData.deleted.teamMembers === 'number', 'deleted.teamMembers must be a number');
      assert(typeof resetResultData.deleted.attempts === 'number', 'deleted.attempts must be a number');
      assert(typeof resetResultData.deleted.answers === 'number', 'deleted.answers must be a number');
      assert(typeof resetResultData.deleted.participantUsers === 'number', 'deleted.participantUsers must be a number');

      const jsonStr = JSON.stringify(resetResultData).toLowerCase();
      const forbidden = ['email', 'password', 'token', 'jwt', 'otp', 'secret', 'phone'];
      for (const term of forbidden) {
        assert(!jsonStr.includes(`"${term}"`), `Forbidden PII/secret field "${term}" found in reset response`);
      }
    });

    // -------------------------------------------------------------------------
    // Test 23: Reset cannot affect unrelated database tables
    // -------------------------------------------------------------------------
    await test('23. Reset cannot affect unrelated database tables', async () => {
      // Questions table row count for foreign event
      const fq = await query('SELECT count(*) FROM questions WHERE event_id = $1;', [foreignEventId]);
      assert(parseInt(fq.rows[0].count, 10) === 1, 'Foreign questions must remain unaffected');

      // Users table has admin
      const a = await query('SELECT count(*) FROM users WHERE email = $1;', [ADMIN_EMAIL]);
      assert(parseInt(a.rows[0].count, 10) === 1, 'Admin in users table must remain unaffected');
    });

  } finally {
    await cleanDatabase();
    if (server) await new Promise((resolve) => server.close(resolve));
    await closePool();
  }

  console.log('\n----------------------------------------');
  console.log(`Results: ${passCount} passed, ${failCount} failed`);
  console.log('----------------------------------------\n');

  if (failCount > 0) process.exit(1);
};

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
