/**
 * Module 8: Admin Leaderboard & Scoring Comprehensive Test Suite
 */

import http from 'http';
import { query, closePool } from '../config/database.js';
import { config } from '../config/env.js';
import app from '../app.js';
import { signToken } from '../services/auth.service.js';

config.email.provider = 'test';
config.nodeEnv = 'test';

let server;
let baseUrl;

const ADMIN_EMAIL = 'admin@round1.tech';
const LEAD_EMAIL = 'lead_lb@test.com';
const MEMBER_EMAIL = 'member_lb@test.com';

let adminCookie;
let leadCookie;
let memberCookie;

let adminUserId;
let leadUserId;
let memberUserId;

let primaryEventId;
let secondaryEventId;

let team1Id;
let team2Id;
let team3Id;
let team4Id;
let foreignTeamId;

let primaryQuestionIds = [];

const apiRequest = async (endpoint, options = {}) => {
  const url = `${baseUrl}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (options.cookie) {
    headers['Cookie'] = options.cookie;
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, headers: res.headers, data };
};

const getErrorMsg = (res) => {
  if (typeof res.data === 'string') return res.data;
  return res.data?.error || res.data?.message || '';
};

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
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
};

const setupDatabase = async () => {
  // Clean prior test artifacts
  await query("DELETE FROM answers WHERE attempt_id IN (SELECT id FROM attempts WHERE event_id IN (SELECT id FROM event WHERE name LIKE '%LB Test%'));");
  await query("DELETE FROM attempts WHERE event_id IN (SELECT id FROM event WHERE name LIKE '%LB Test%');");
  await query("DELETE FROM questions WHERE event_id IN (SELECT id FROM event WHERE name LIKE '%LB Test%');");
  await query("DELETE FROM team_members WHERE event_id IN (SELECT id FROM event WHERE name LIKE '%LB Test%');");
  await query("DELETE FROM teams WHERE event_id IN (SELECT id FROM event WHERE name LIKE '%LB Test%');");
  await query("DELETE FROM event WHERE name LIKE '%LB Test%';");
  await query("DELETE FROM users WHERE email IN ('admin@round1.tech', 'lead_lb@test.com', 'member_lb@test.com');");

  // Create Users
  const adminRes = await query("INSERT INTO users (email, name) VALUES ($1, 'Test Admin') RETURNING id;", [ADMIN_EMAIL]);
  adminUserId = adminRes.rows[0].id;

  const leadRes = await query("INSERT INTO users (email, name) VALUES ($1, 'Test Leader') RETURNING id;", [LEAD_EMAIL]);
  leadUserId = leadRes.rows[0].id;

  const memRes = await query("INSERT INTO users (email, name) VALUES ($1, 'Test Member') RETURNING id;", [MEMBER_EMAIL]);
  memberUserId = memRes.rows[0].id;

  // Sign JWT cookies
  adminCookie = `${config.auth.cookieName}=${signToken({ userId: adminUserId, role: 'ADMIN' })}`;
  leadCookie = `${config.auth.cookieName}=${signToken({ userId: leadUserId, role: 'TEAM_LEAD' })}`;
  memberCookie = `${config.auth.cookieName}=${signToken({ userId: memberUserId, role: 'MEMBER' })}`;

  // Create Primary Event (LIVE, +10 / -5 / -10)
  const ev1 = await query(
    `INSERT INTO event (name, status, correct_marks, wrong_marks, skip_marks)
     VALUES ('LB Test Primary LIVE', 'LIVE', 10, -5, -10)
     RETURNING id;`
  );
  primaryEventId = ev1.rows[0].id;

  // Create 3 questions for primary event
  for (let i = 1; i <= 3; i++) {
    const q = await query(
      `INSERT INTO questions (event_id, question_text, option_a, option_b, option_c, option_d, correct_option, time_limit_seconds, question_order)
       VALUES ($1, $2, 'A', 'B', 'C', 'D', 'A', 30, $3)
       RETURNING id;`,
      [primaryEventId, `Primary Q${i}`, i]
    );
    primaryQuestionIds.push(q.rows[0].id);
  }

  // Create Secondary Event for Cross-Event Testing (LIVE)
  const ev2 = await query(
    `INSERT INTO event (name, status, correct_marks, wrong_marks, skip_marks)
     VALUES ('LB Test Foreign Event', 'READY', 10, -5, -10)
     RETURNING id;`
  );
  secondaryEventId = ev2.rows[0].id;

  // Create Teams for Primary Event:
  // Team 1: Completed, High Score (+20)
  const t1 = await query(
    `INSERT INTO teams (event_id, name, college, department, registration_status, created_at)
     VALUES ($1, 'Alpha Team', 'Alpha College', 'CSE', 'APPROVED', NOW() - INTERVAL '10 hours')
     RETURNING id;`,
    [primaryEventId]
  );
  team1Id = t1.rows[0].id;
  await query(
    "INSERT INTO team_members (team_id, user_id, event_id, role, register_number) VALUES ($1, $2, $3, 'TEAM_LEAD', 'REG-A1');",
    [team1Id, leadUserId, primaryEventId]
  );

  // Team 2: Completed, Tied Score with Team 3 (+10) but Completed Earlier
  const t2 = await query(
    `INSERT INTO teams (event_id, name, college, department, registration_status, created_at)
     VALUES ($1, 'Beta Team', 'Beta College', 'ECE', 'APPROVED', NOW() - INTERVAL '9 hours')
     RETURNING id;`,
    [primaryEventId]
  );
  team2Id = t2.rows[0].id;

  // Team 3: Completed, Tied Score (+10) but Completed Later than Team 2
  const t3 = await query(
    `INSERT INTO teams (event_id, name, college, department, registration_status, created_at)
     VALUES ($1, 'Gamma Team', 'Gamma College', 'IT', 'APPROVED', NOW() - INTERVAL '8 hours')
     RETURNING id;`,
    [primaryEventId]
  );
  team3Id = t3.rows[0].id;

  // Team 4: In-Progress
  const t4 = await query(
    `INSERT INTO teams (event_id, name, college, department, registration_status, created_at)
     VALUES ($1, 'Delta Team', 'Delta College', 'MECH', 'APPROVED', NOW() - INTERVAL '7 hours')
     RETURNING id;`,
    [primaryEventId]
  );
  team4Id = t4.rows[0].id;

  // Team 5: Not Started (Approved)
  await query(
    `INSERT INTO teams (event_id, name, college, department, registration_status, created_at)
     VALUES ($1, 'Epsilon Team', 'Epsilon College', 'CIVIL', 'APPROVED', NOW() - INTERVAL '6 hours')
     RETURNING id;`,
    [primaryEventId]
  );

  // Team 6: Foreign Team (belongs to Secondary Event)
  const tForeign = await query(
    `INSERT INTO teams (event_id, name, college, department, registration_status, created_at)
     VALUES ($1, 'Foreign Team', 'Foreign College', 'AI', 'APPROVED', NOW() - INTERVAL '5 hours')
     RETURNING id;`,
    [secondaryEventId]
  );
  foreignTeamId = tForeign.rows[0].id;

  // Populate Attempts & Answers:

  // Attempt 1 (Team 1): Started 20m ago, Completed 15m ago. Answers: Q1 Correct (+10), Q2 Correct (+10), Q3 Skipped (-10) -> Total = 10
  // Wait, let's give Team 1 (+20): Q1 Correct (+10), Q2 Correct (+10), Q3 Correct (+10) = +30 or Q1 & Q2 correct (+20)
  const att1 = await query(
    `INSERT INTO attempts (team_id, event_id, started_at, completed_at, total_score)
     VALUES ($1, $2, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '15 minutes', 20)
     RETURNING id;`,
    [team1Id, primaryEventId]
  );
  await query(
    `INSERT INTO answers (attempt_id, question_id, event_id, selected_option, status, marks_awarded, answered_at)
     VALUES ($1, $2, $3, 'A', 'correct', 10, NOW() - INTERVAL '19 minutes'),
            ($1, $4, $3, 'A', 'correct', 10, NOW() - INTERVAL '17 minutes'),
            ($1, $5, $3, NULL, 'skipped', 0, NOW() - INTERVAL '15 minutes');`,
    [att1.rows[0].id, primaryQuestionIds[0], primaryEventId, primaryQuestionIds[1], primaryQuestionIds[2]]
  );

  // Attempt 2 (Team 2): Started 15m ago, Completed 10m ago. Score = 10 (Q1 Correct +10, Q2 Skipped 0, Q3 Skipped 0)
  const att2 = await query(
    `INSERT INTO attempts (team_id, event_id, started_at, completed_at, total_score)
     VALUES ($1, $2, NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '10 minutes', 10)
     RETURNING id;`,
    [team2Id, primaryEventId]
  );
  await query(
    `INSERT INTO answers (attempt_id, question_id, event_id, selected_option, status, marks_awarded, answered_at)
     VALUES ($1, $2, $3, 'A', 'correct', 10, NOW() - INTERVAL '14 minutes'),
            ($1, $4, $3, NULL, 'skipped', 0, NOW() - INTERVAL '12 minutes'),
            ($1, $5, $3, NULL, 'skipped', 0, NOW() - INTERVAL '10 minutes');`,
    [att2.rows[0].id, primaryQuestionIds[0], primaryEventId, primaryQuestionIds[1], primaryQuestionIds[2]]
  );

  // Attempt 3 (Team 3): Started 12m ago, Completed 5m ago (Later than Team 2!). Score = 10 (Q1 Correct +10, Q2 Skipped 0, Q3 Skipped 0)
  const att3 = await query(
    `INSERT INTO attempts (team_id, event_id, started_at, completed_at, total_score)
     VALUES ($1, $2, NOW() - INTERVAL '12 minutes', NOW() - INTERVAL '5 minutes', 10)
     RETURNING id;`,
    [team3Id, primaryEventId]
  );
  await query(
    `INSERT INTO answers (attempt_id, question_id, event_id, selected_option, status, marks_awarded, answered_at)
     VALUES ($1, $2, $3, 'A', 'correct', 10, NOW() - INTERVAL '11 minutes'),
            ($1, $4, $3, NULL, 'skipped', 0, NOW() - INTERVAL '8 minutes'),
            ($1, $5, $3, NULL, 'skipped', 0, NOW() - INTERVAL '5 minutes');`,
    [att3.rows[0].id, primaryQuestionIds[0], primaryEventId, primaryQuestionIds[1], primaryQuestionIds[2]]
  );

  // Attempt 4 (Team 4): Started 5m ago, In Progress (completed_at is NULL). Q1 Wrong (-5)
  const att4 = await query(
    `INSERT INTO attempts (team_id, event_id, started_at, completed_at, total_score, current_question_started_at)
     VALUES ($1, $2, NOW() - INTERVAL '5 minutes', NULL, -5, NOW() - INTERVAL '1 minute')
     RETURNING id;`,
    [team4Id, primaryEventId]
  );
  await query(
    `INSERT INTO answers (attempt_id, question_id, event_id, selected_option, status, marks_awarded, answered_at)
     VALUES ($1, $2, $3, 'B', 'wrong', -5, NOW() - INTERVAL '4 minutes');`,
    [att4.rows[0].id, primaryQuestionIds[0], primaryEventId]
  );
};

const runTests = async () => {
  console.log('\n=== Module 8: Admin Leaderboard & Scoring Test Suite ===\n');

  try {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;

    await setupDatabase();

    // =========================================================================
    // SECTION 1: Authorization & Role Verification
    // =========================================================================
    console.log('--- 1. Authorization & Role Verification ---');

    await test('1. Unauthenticated request to /api/admin/leaderboard returns 401 Unauthorized', async () => {
      const res = await apiRequest('/api/admin/leaderboard');
      assert(res.status === 401, `Expected 401, got ${res.status}`);
      assert(getErrorMsg(res).toLowerCase().includes('authentication') || getErrorMsg(res).toLowerCase().includes('token'), 'Expected authentication error');
    });

    await test('2. Participant TEAM_LEAD blocked from /api/admin/leaderboard (403 Forbidden)', async () => {
      const res = await apiRequest('/api/admin/leaderboard', { cookie: leadCookie });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
      assert(getErrorMsg(res).toLowerCase().includes('administrator') || getErrorMsg(res).toLowerCase().includes('forbidden'), 'Expected admin required error');
    });

    await test('3. Normal MEMBER blocked from /api/admin/leaderboard (403 Forbidden)', async () => {
      const res = await apiRequest('/api/admin/leaderboard', { cookie: memberCookie });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    await test('4. Authenticated ADMIN successfully retrieves leaderboard (200 OK)', async () => {
      const res = await apiRequest('/api/admin/leaderboard', { cookie: adminCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.success === true, 'Response must indicate success');
      assert(Array.isArray(res.data.leaderboard), 'Leaderboard must be an array');
    });

    // =========================================================================
    // SECTION 2: Event Resolution & Lifecycle Handling
    // =========================================================================
    console.log('\n--- 2. Strict Event Resolution & Isolation ---');

    await test('5. Auto-resolution selects the single active LIVE event when eventId is omitted', async () => {
      const res = await apiRequest('/api/admin/leaderboard', { cookie: adminCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.event.id === primaryEventId, 'Must resolve primary LIVE event');
      assert(res.data.event.status === 'LIVE', 'Event status must be LIVE');
      assert(res.data.isFinal === false, 'LIVE event must have isFinal = false');
    });

    await test('6. Explicit eventId scopes strictly to that event', async () => {
      const res = await apiRequest(`/api/admin/leaderboard?eventId=${secondaryEventId}`, {
        cookie: adminCookie,
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.event.id === secondaryEventId, 'Must resolve explicit event');
    });

    await test('7. Invalid UUID format for eventId rejected with 400 Bad Request', async () => {
      const res = await apiRequest('/api/admin/leaderboard?eventId=not-a-uuid', {
        cookie: adminCookie,
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(getErrorMsg(res).includes('UUID'), 'Expected UUID validation error');
    });

    await test('8. Nonexistent eventId returns safe 404 Not Found', async () => {
      const res = await apiRequest('/api/admin/leaderboard?eventId=00000000-0000-0000-0000-000000000000', {
        cookie: adminCookie,
      });
      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    await test('9. Cross-event data isolation: foreign teams do not appear on primary leaderboard', async () => {
      const res = await apiRequest(`/api/admin/leaderboard?eventId=${primaryEventId}`, {
        cookie: adminCookie,
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const teamIds = res.data.leaderboard.map((t) => t.teamId);
      assert(!teamIds.includes(foreignTeamId), 'Foreign team must not leak into primary leaderboard');
    });

    await test('10. Multiple LIVE events configuration ambiguity fails safely with 500 error', async () => {
      // Create second LIVE event
      const secondLive = await query(
        "INSERT INTO event (name, status) VALUES ('LB Test Duplicate LIVE', 'LIVE') RETURNING id;"
      );

      const res = await apiRequest('/api/admin/leaderboard', { cookie: adminCookie });
      assert(res.status === 500, `Expected 500 on multiple LIVE events, got ${res.status}`);
      assert(getErrorMsg(res).includes('multiple LIVE events'), 'Expected configuration error message');

      // Cleanup duplicate LIVE event
      await query('DELETE FROM event WHERE id = $1;', [secondLive.rows[0].id]);
    });

    // =========================================================================
    // SECTION 3: Deterministic Ranking & Tie-Breaking
    // =========================================================================
    console.log('\n--- 3. Deterministic Ranking & Tie-Breaking ---');

    await test('11. Primary sort: highest score ranks #1', async () => {
      const res = await apiRequest(`/api/admin/leaderboard?eventId=${primaryEventId}`, {
        cookie: adminCookie,
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);

      const rank1 = res.data.leaderboard.find((t) => t.rank === 1);
      assert(rank1, 'Rank 1 team must exist');
      assert(rank1.teamId === team1Id, 'Alpha Team (+20) must be Rank 1');
      assert(rank1.score === 20, 'Rank 1 score must be 20');
    });

    await test('12. Secondary tie-breaker: earlier completion time (completed_at ASC) breaks score tie', async () => {
      const res = await apiRequest(`/api/admin/leaderboard?eventId=${primaryEventId}`, {
        cookie: adminCookie,
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);

      const rank2 = res.data.leaderboard.find((t) => t.rank === 2);
      const rank3 = res.data.leaderboard.find((t) => t.rank === 3);

      assert(rank2 && rank3, 'Rank 2 and Rank 3 must exist');
      assert(rank2.score === 10 && rank3.score === 10, 'Both teams must be tied at 10 points');

      // Team 2 completed 10 minutes ago, Team 3 completed 5 minutes ago.
      // Team 2 completed earlier, so Team 2 must be Rank 2, and Team 3 must be Rank 3!
      assert(rank2.teamId === team2Id, 'Beta Team (earlier completion) must be Rank 2');
      assert(rank3.teamId === team3Id, 'Gamma Team (later completion) must be Rank 3');
      assert(new Date(rank2.completedAt).getTime() < new Date(rank3.completedAt).getTime(), 'Rank 2 completion must precede Rank 3');
    });

    await test('13. Deterministic reproducibility: multiple leaderboard calls yield identical ranking order', async () => {
      const res1 = await apiRequest(`/api/admin/leaderboard?eventId=${primaryEventId}`, { cookie: adminCookie });
      const res2 = await apiRequest(`/api/admin/leaderboard?eventId=${primaryEventId}`, { cookie: adminCookie });

      const ranks1 = res1.data.leaderboard.map((t) => ({ id: t.teamId, rank: t.rank }));
      const ranks2 = res2.data.leaderboard.map((t) => ({ id: t.teamId, rank: t.rank }));

      assert(JSON.stringify(ranks1) === JSON.stringify(ranks2), 'Rankings must be completely identical across calls');
    });

    // =========================================================================
    // SECTION 4: Completed vs Incomplete Categorization
    // =========================================================================
    console.log('\n--- 4. Completed vs Incomplete Categorization ---');

    await test('14. Completed attempts receive integer ranks (1, 2, 3...)', async () => {
      const res = await apiRequest(`/api/admin/leaderboard?eventId=${primaryEventId}`, { cookie: adminCookie });
      const completed = res.data.leaderboard.filter((t) => t.completionStatus === 'COMPLETED');
      assert(completed.length === 3, `Expected 3 completed teams, got ${completed.length}`);
      assert(completed[0].rank === 1, 'First completed team must have rank 1');
      assert(completed[1].rank === 2, 'Second completed team must have rank 2');
      assert(completed[2].rank === 3, 'Third completed team must have rank 3');
    });

    await test('15. In-Progress teams have rank = null and status = IN_PROGRESS', async () => {
      const res = await apiRequest(`/api/admin/leaderboard?eventId=${primaryEventId}`, { cookie: adminCookie });
      const inProgress = res.data.leaderboard.find((t) => t.teamId === team4Id);
      assert(inProgress, 'Delta Team must be present');
      assert(inProgress.completionStatus === 'IN_PROGRESS', 'Status must be IN_PROGRESS');
      assert(inProgress.rank === null, 'In-progress team must have rank = null');
    });

    await test('16. Not-Started teams have rank = null and status = NOT_STARTED', async () => {
      const res = await apiRequest(`/api/admin/leaderboard?eventId=${primaryEventId}`, { cookie: adminCookie });
      const notStarted = res.data.leaderboard.find((t) => t.teamName === 'Epsilon Team');
      assert(notStarted, 'Epsilon Team must be present');
      assert(notStarted.completionStatus === 'NOT_STARTED', 'Status must be NOT_STARTED');
      assert(notStarted.rank === null, 'Not-started team must have rank = null');
      assert(notStarted.score === 0, 'Not-started team score must be 0');
    });

    await test('17. Summary statistics accurately reflect counts', async () => {
      const res = await apiRequest(`/api/admin/leaderboard?eventId=${primaryEventId}`, { cookie: adminCookie });
      const stats = res.data.stats;
      assert(stats.totalApprovedTeams === 5, `Expected 5 total approved teams, got ${stats.totalApprovedTeams}`);
      assert(stats.completedCount === 3, `Expected 3 completed, got ${stats.completedCount}`);
      assert(stats.inProgressCount === 1, `Expected 1 in-progress, got ${stats.inProgressCount}`);
      assert(stats.notStartedCount === 1, `Expected 1 not-started, got ${stats.notStartedCount}`);
      assert(stats.topScore === 20, `Expected top score 20, got ${stats.topScore}`);
    });

    // =========================================================================
    // SECTION 5: Read-Only Integrity & Score Consistency
    // =========================================================================
    console.log('\n--- 5. Read-Only Integrity & Score Consistency ---');

    await test('18. Reading leaderboard does not alter attempt rows or timestamps (strict read-only)', async () => {
      const before = await query('SELECT id, total_score, updated_at FROM attempts WHERE event_id = $1 ORDER BY id;', [primaryEventId]);

      // Execute leaderboard query
      await apiRequest(`/api/admin/leaderboard?eventId=${primaryEventId}`, { cookie: adminCookie });

      const after = await query('SELECT id, total_score, updated_at FROM attempts WHERE event_id = $1 ORDER BY id;', [primaryEventId]);

      assert(before.rows.length === after.rows.length, 'Row count must be unchanged');
      for (let i = 0; i < before.rows.length; i++) {
        assert(before.rows[i].total_score === after.rows[i].total_score, `Score for attempt ${i} must not change`);
        assert(
          new Date(before.rows[i].updated_at).getTime() === new Date(after.rows[i].updated_at).getTime(),
          `updated_at for attempt ${i} must not be altered`
        );
      }
    });

    await test('19. Score consistency audit: matches attempt score against answers sum without mutation', async () => {
      const res = await apiRequest(`/api/admin/leaderboard?eventId=${primaryEventId}`, { cookie: adminCookie });
      const completed = res.data.leaderboard.filter((t) => t.completionStatus === 'COMPLETED');
      for (const t of completed) {
        assert(t.hasAuditDiscrepancy === false, `Team ${t.teamName} should have no audit discrepancy`);
      }
    });

    // =========================================================================
    // SECTION 6: Lifecycle State Transitions
    // =========================================================================
    console.log('\n--- 6. Event Lifecycle States ---');

    await test('20. READY event returns safe not-started response with empty ranked list', async () => {
      // Secondary event is in READY state
      const res = await apiRequest(`/api/admin/leaderboard?eventId=${secondaryEventId}`, { cookie: adminCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.event.status === 'READY', 'Status must be READY');
      assert(res.data.isFinal === false, 'isFinal must be false');
      assert(res.data.leaderboard.length === 0, 'Leaderboard must be empty');
      assert(res.data.message.includes('not started yet'), 'Must return not started message');
    });

    await test('21. Transition to ENDED freezes standings with isFinal = true', async () => {
      // Transition primary event to ENDED
      await query("UPDATE event SET status = 'ENDED', updated_at = NOW() WHERE id = $1;", [primaryEventId]);

      const res = await apiRequest('/api/admin/leaderboard', { cookie: adminCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.event.status === 'ENDED', 'Status must be ENDED');
      assert(res.data.isFinal === true, 'isFinal must be true on ENDED event');
      assert(res.data.leaderboard.length > 0, 'Standings must be available');
    });

    // =========================================================================
    // SECTION 7: Security & Tampering Resistance
    // =========================================================================
    console.log('\n--- 7. Security & Tampering Resistance ---');

    await test('22. Client cannot supply custom score, rank, or marks via query parameters', async () => {
      const res = await apiRequest(
        `/api/admin/leaderboard?eventId=${primaryEventId}&score=9999&rank=1&marks=500`,
        { cookie: adminCookie }
      );
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const rank1 = res.data.leaderboard.find((t) => t.rank === 1);
      assert(rank1.score === 20, 'Client-supplied score parameter must be ignored');
    });

    await test('23. Zero-attempt event returns clean empty leaderboard without errors', async () => {
      const zeroEv = await query("INSERT INTO event (name, status) VALUES ('LB Test Zero Attempt Event', 'LIVE') RETURNING id;");
      const zeroEvId = zeroEv.rows[0].id;

      const res = await apiRequest(`/api/admin/leaderboard?eventId=${zeroEvId}`, { cookie: adminCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.stats.totalApprovedTeams === 0, 'Total approved teams must be 0');
      assert(res.data.stats.completedCount === 0, 'Completed count must be 0');
      assert(res.data.leaderboard.length === 0, 'Leaderboard must be empty array');

      // Cleanup
      await query('DELETE FROM event WHERE id = $1;', [zeroEvId]);
    });

    // Final cleanup of test records
    await query("DELETE FROM answers WHERE attempt_id IN (SELECT id FROM attempts WHERE event_id IN ($1, $2));", [primaryEventId, secondaryEventId]);
    await query("DELETE FROM attempts WHERE event_id IN ($1, $2);", [primaryEventId, secondaryEventId]);
    await query("DELETE FROM questions WHERE event_id IN ($1, $2);", [primaryEventId, secondaryEventId]);
    await query("DELETE FROM team_members WHERE event_id IN ($1, $2);", [primaryEventId, secondaryEventId]);
    await query("DELETE FROM teams WHERE event_id IN ($1, $2);", [primaryEventId, secondaryEventId]);
    await query("DELETE FROM event WHERE id IN ($1, $2);", [primaryEventId, secondaryEventId]);
    await query("DELETE FROM users WHERE id IN ($1, $2, $3);", [adminUserId, leadUserId, memberUserId]);

    console.log('\n----------------------------------------');
    console.log(`Results: ${passCount} passed, ${failCount} failed`);
    console.log('----------------------------------------\n');

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await closePool();
  }
};

runTests();
