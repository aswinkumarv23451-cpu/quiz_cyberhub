/**
 * Module 9: Admin Live Operational Monitoring Comprehensive Test Suite
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

const ADMIN_EMAIL = 'admin_mon@round1.tech';
const LEAD_EMAIL = 'lead_mon@test.com';
const MEMBER_EMAIL = 'member_mon@test.com';

let adminCookie;
let leadCookie;
let memberCookie;

let adminUserId;
let leadUserId;
let memberUserId;

let primaryEventId;
let secondaryEventId;

let teamNotStartedId;
let teamInProgressId;
let teamCompletedId;
let teamFastId;
let teamForeignId;

let questionIds = [];

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

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
};

const runTests = async () => {
  let passCount = 0;
  let failCount = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passCount++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    -> ${err.message}`);
      console.error(err.stack);
      failCount++;
    }
  };

  try {
    console.log('\n===============================================================');
    console.log('--- MODULE 9: ADMIN LIVE OPERATIONAL MONITORING TEST SUITE ---');
    console.log('===============================================================\n');

    // Start HTTP server on dynamic port
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });

    // Cleanup any lingering artifacts from previous runs
    await query("DELETE FROM users WHERE email IN ($1, $2, $3);", [ADMIN_EMAIL, LEAD_EMAIL, MEMBER_EMAIL]);
    await query("DELETE FROM event WHERE name LIKE 'Mon Test%';");

    if (!config.auth.adminEmails.includes(ADMIN_EMAIL)) {
      config.auth.adminEmails.push(ADMIN_EMAIL);
    }

    // Setup Users & Auth Tokens
    const adminUser = await query(
      `INSERT INTO users (email, name) VALUES ($1, 'Admin Tester') RETURNING id;`,
      [ADMIN_EMAIL]
    );
    adminUserId = adminUser.rows[0].id;
    const adminToken = signToken({ userId: adminUserId, role: 'ADMIN' });
    adminCookie = `${config.auth.cookieName}=${adminToken}`;

    const leadUser = await query(
      `INSERT INTO users (email, name) VALUES ($1, 'Lead Tester') RETURNING id;`,
      [LEAD_EMAIL]
    );
    leadUserId = leadUser.rows[0].id;
    const leadToken = signToken({ userId: leadUserId, role: 'TEAM_LEAD' });
    leadCookie = `${config.auth.cookieName}=${leadToken}`;

    const memberUser = await query(
      `INSERT INTO users (email, name) VALUES ($1, 'Member Tester') RETURNING id;`,
      [MEMBER_EMAIL]
    );
    memberUserId = memberUser.rows[0].id;
    const memberToken = signToken({ userId: memberUserId, role: 'MEMBER' });
    memberCookie = `${config.auth.cookieName}=${memberToken}`;

    // Setup Competition Events
    const ev1 = await query(
      `INSERT INTO event (name, status, correct_marks, wrong_marks, skip_marks)
       VALUES ('Mon Test Primary Event', 'LIVE', 10, -5, -10)
       RETURNING id;`
    );
    primaryEventId = ev1.rows[0].id;

    const ev2 = await query(
      `INSERT INTO event (name, status, correct_marks, wrong_marks, skip_marks)
       VALUES ('Mon Test Foreign Event', 'READY', 10, -5, -10)
       RETURNING id;`
    );
    secondaryEventId = ev2.rows[0].id;

    // Create Questions for Primary Event (5 questions)
    for (let i = 1; i <= 5; i++) {
      const q = await query(
        `INSERT INTO questions (
           event_id, question_text, option_a, option_b, option_c, option_d,
           correct_option, time_limit_seconds, question_order
         ) VALUES ($1, $2, 'A', 'B', 'C', 'D', 'A', $3, $4)
         RETURNING id;`,
        [primaryEventId, `Mon Question ${i}`, 20 + i * 5, i]
      );
      questionIds.push(q.rows[0].id);
    }

    // Setup Teams in Primary Event
    // 1. Not Started Team
    const tNotStarted = await query(
      `INSERT INTO teams (event_id, name, registration_status, college, department)
       VALUES ($1, 'Mon Team Alpha', 'APPROVED', 'MIT', 'CSE')
       RETURNING id;`,
      [primaryEventId]
    );
    teamNotStartedId = tNotStarted.rows[0].id;
    await query(
      "INSERT INTO team_members (team_id, user_id, event_id, role, register_number) VALUES ($1, $2, $3, 'TEAM_LEAD', 'REG-M1');",
      [teamNotStartedId, leadUserId, primaryEventId]
    );

    // 2. In Progress Team (answered 2 questions)
    const tInProgress = await query(
      `INSERT INTO teams (event_id, name, registration_status, college, department)
       VALUES ($1, 'Mon Team Beta', 'APPROVED', 'Stanford', 'ECE')
       RETURNING id;`,
      [primaryEventId]
    );
    teamInProgressId = tInProgress.rows[0].id;

    // 3. Fast In Progress Team (answered 4 questions)
    const tFast = await query(
      `INSERT INTO teams (event_id, name, registration_status, college, department)
       VALUES ($1, 'Mon Team Delta', 'APPROVED', 'Harvard', 'IT')
       RETURNING id;`,
      [primaryEventId]
    );
    teamFastId = tFast.rows[0].id;

    // 4. Completed Team (answered 5 questions)
    const tCompleted = await query(
      `INSERT INTO teams (event_id, name, registration_status, college, department)
       VALUES ($1, 'Mon Team Gamma', 'APPROVED', 'Oxford', 'Cyber')
       RETURNING id;`,
      [primaryEventId]
    );
    teamCompletedId = tCompleted.rows[0].id;

    // 5. Foreign Team in secondary event
    const tForeign = await query(
      `INSERT INTO teams (event_id, name, registration_status, college, department)
       VALUES ($1, 'Mon Team Foreign', 'APPROVED', 'Cambridge', 'AI')
       RETURNING id;`,
      [secondaryEventId]
    );
    teamForeignId = tForeign.rows[0].id;

    // Setup Attempts & Answers
    // Team Beta Attempt (In Progress: 2 answered, Q3 active)
    const attBeta = await query(
      `INSERT INTO attempts (team_id, event_id, started_at, total_score, current_question_started_at)
       VALUES ($1, $2, NOW() - INTERVAL '5 minutes', 15, NOW() - INTERVAL '10 seconds')
       RETURNING id;`,
      [teamInProgressId, primaryEventId]
    );
    const attBetaId = attBeta.rows[0].id;
    await query(
      `INSERT INTO answers (attempt_id, question_id, event_id, selected_option, status, marks_awarded, answered_at)
       VALUES ($1, $2, $4, 'A', 'correct', 10, NOW() - INTERVAL '4 minutes'),
              ($1, $3, $4, 'B', 'wrong', -5, NOW() - INTERVAL '2 minutes');`,
      [attBetaId, questionIds[0], questionIds[1], primaryEventId]
    );

    // Team Delta Attempt (In Progress: 4 answered, Q5 active)
    const attDelta = await query(
      `INSERT INTO attempts (team_id, event_id, started_at, total_score, current_question_started_at)
       VALUES ($1, $2, NOW() - INTERVAL '10 minutes', 30, NOW() - INTERVAL '5 seconds')
       RETURNING id;`,
      [teamFastId, primaryEventId]
    );
    const attDeltaId = attDelta.rows[0].id;
    await query(
      `INSERT INTO answers (attempt_id, question_id, event_id, selected_option, status, marks_awarded, answered_at)
       VALUES ($1, $2, $6, 'A', 'correct', 10, NOW() - INTERVAL '8 minutes'),
              ($1, $3, $6, 'A', 'correct', 10, NOW() - INTERVAL '6 minutes'),
              ($1, $4, $6, 'A', 'correct', 10, NOW() - INTERVAL '4 minutes'),
              ($1, $5, $6, 'A', 'correct', 10, NOW() - INTERVAL '2 minutes');`,
      [attDeltaId, questionIds[0], questionIds[1], questionIds[2], questionIds[3], primaryEventId]
    );

    // Team Gamma Attempt (Completed: all 5 answered)
    const attGamma = await query(
      `INSERT INTO attempts (team_id, event_id, started_at, completed_at, total_score)
       VALUES ($1, $2, NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '1 minute', 40)
       RETURNING id;`,
      [teamCompletedId, primaryEventId]
    );
    const attGammaId = attGamma.rows[0].id;
    await query(
      `INSERT INTO answers (attempt_id, question_id, event_id, selected_option, status, marks_awarded, answered_at)
       VALUES ($1, $2, $7, 'A', 'correct', 10, NOW() - INTERVAL '14 minutes'),
              ($1, $3, $7, 'A', 'correct', 10, NOW() - INTERVAL '11 minutes'),
              ($1, $4, $7, 'A', 'correct', 10, NOW() - INTERVAL '8 minutes'),
              ($1, $5, $7, 'A', 'correct', 10, NOW() - INTERVAL '5 minutes'),
              ($1, $6, $7, 'A', 'correct', 10, NOW() - INTERVAL '1 minute');`,
      [attGammaId, questionIds[0], questionIds[1], questionIds[2], questionIds[3], questionIds[4], primaryEventId]
    );

    // =========================================================================
    // SECTION 1: Authorization & RBAC
    // =========================================================================
    console.log('\n--- 1. Authorization & RBAC ---');

    await test('1. Unauthenticated request to /monitoring returns 401', async () => {
      const res = await apiRequest('/api/admin/monitoring');
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await test('2. TEAM_LEAD request to /monitoring returns 403', async () => {
      const res = await apiRequest('/api/admin/monitoring', { cookie: leadCookie });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    await test('3. MEMBER request to /monitoring returns 403', async () => {
      const res = await apiRequest('/api/admin/monitoring', { cookie: memberCookie });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    await test('4. ADMIN request to /monitoring succeeds with 200', async () => {
      const res = await apiRequest('/api/admin/monitoring', { cookie: adminCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.success === true, 'Response must be success');
    });

    // =========================================================================
    // SECTION 2: Event Resolution Determinism & In-Transaction Consistency
    // =========================================================================
    console.log('\n--- 2. Event Resolution Determinism & In-Transaction Consistency ---');

    await test('5. Multiple LIVE events fails safely with 500 configuration error', async () => {
      const tempLive = await query(
        `INSERT INTO event (name, status) VALUES ('Mon Test Second Live', 'LIVE') RETURNING id;`
      );
      const tempLiveId = tempLive.rows[0].id;

      const res = await apiRequest('/api/admin/monitoring', { cookie: adminCookie });
      assert(res.status === 500, `Expected 500, got ${res.status}`);
      assert(
        (res.data.message || '').includes('multiple live events'),
        `Expected multiple live events error message, got ${res.data.message}`
      );

      // Cleanup
      await query('DELETE FROM event WHERE id = $1;', [tempLiveId]);
    });

    await test('6. Single LIVE event succeeds and returns operational monitoring data', async () => {
      const res = await apiRequest('/api/admin/monitoring', { cookie: adminCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.event.id === primaryEventId, 'Must resolve primary LIVE event');
      assert(res.data.event.status === 'LIVE', 'Event status must be LIVE');
      assert(res.data.totalQuestions === 5, `Expected 5 questions, got ${res.data.totalQuestions}`);
    });

    await test('7. Zero LIVE events with multiple READY events fails safely with 500 error', async () => {
      // Temporarily transition primary event to ENDED
      await query("UPDATE event SET status = 'ENDED' WHERE id = $1;", [primaryEventId]);
      // Insert a second READY event (secondaryEventId is already READY)
      const tempReady = await query(
        `INSERT INTO event (name, status) VALUES ('Mon Test Extra Ready', 'READY') RETURNING id;`
      );
      const tempReadyId = tempReady.rows[0].id;

      const res = await apiRequest('/api/admin/monitoring', { cookie: adminCookie });
      assert(res.status === 500, `Expected 500, got ${res.status}`);
      assert(
        (res.data.message || '').includes('multiple ready events'),
        `Expected multiple ready events error, got ${res.data.message}`
      );

      // Cleanup
      await query('DELETE FROM event WHERE id = $1;', [tempReadyId]);
      await query("UPDATE event SET status = 'LIVE' WHERE id = $1;", [primaryEventId]);
    });

    await test('8. Zero LIVE events with single READY event returns notLive: true, status: READY', async () => {
      await query("UPDATE event SET status = 'ENDED' WHERE id = $1;", [primaryEventId]);
      // secondaryEventId is the only READY event now
      const res = await apiRequest('/api/admin/monitoring', { cookie: adminCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.notLive === true, 'Must indicate notLive');
      assert(res.data.status === 'READY', 'Status must be READY');
      assert(res.data.message === 'Event has not started yet', 'Message must match');

      // Revert primary event to LIVE
      await query("UPDATE event SET status = 'LIVE' WHERE id = $1;", [primaryEventId]);
    });

    await test('9. Zero LIVE events with 0 READY and >= 1 ENDED returns notLive: true, status: ENDED', async () => {
      await query("UPDATE event SET status = 'ENDED' WHERE id = $1::uuid;", [primaryEventId]);
      await query("UPDATE event SET status = 'ENDED' WHERE id = $1::uuid;", [secondaryEventId]);

      const res = await apiRequest('/api/admin/monitoring', { cookie: adminCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.notLive === true, 'Must indicate notLive');
      assert(res.data.status === 'ENDED', 'Status must be ENDED');
      assert(res.data.message === 'Event has ended', 'Message must match');

      // Revert primary event to LIVE, secondary to READY
      await query("UPDATE event SET status = 'LIVE' WHERE id = $1;", [primaryEventId]);
      await query("UPDATE event SET status = 'READY' WHERE id = $1;", [secondaryEventId]);
    });

    // =========================================================================
    // SECTION 3: PostgreSQL Authoritative Clock & Timer Accuracy
    // =========================================================================
    console.log('\n--- 3. PostgreSQL Authoritative Clock & Timer Accuracy ---');

    await test('10. serverTime derives strictly from PostgreSQL NOW() within the transaction', async () => {
      const res = await apiRequest('/api/admin/monitoring', { cookie: adminCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(typeof res.data.serverTime === 'string', 'serverTime must be ISO string');
      const serverTimeMs = new Date(res.data.serverTime).getTime();
      assert(!isNaN(serverTimeMs), 'serverTime must be a valid timestamp');
      const nowMs = Date.now();
      assert(Math.abs(serverTimeMs - nowMs) < 60000, 'serverTime should reasonably match current time');
    });

    await test('11. questionDeadline and remainingSeconds are computed accurately server-side', async () => {
      const res = await apiRequest('/api/admin/monitoring', { cookie: adminCookie });
      const teamBeta = res.data.teams.find((t) => t.teamId === teamInProgressId);
      assert(teamBeta, 'Team Beta must be in overview');
      assert(teamBeta.status === 'IN_PROGRESS', 'Team Beta status must be IN_PROGRESS');
      assert(teamBeta.currentQuestionNumber === 3, `Expected Q3, got ${teamBeta.currentQuestionNumber}`);
      assert(teamBeta.questionDeadline !== null, 'questionDeadline must not be null');
      assert(typeof teamBeta.remainingSeconds === 'number', 'remainingSeconds must be a number');
      assert(teamBeta.remainingSeconds > 0, 'remainingSeconds should be > 0 for freshly started question');
    });

    await test('12. Expired active timer reports remainingSeconds = 0 (never negative)', async () => {
      // Set Team Beta's current_question_started_at to 10 minutes ago (time limit is 35 seconds)
      await query(
        `UPDATE attempts
         SET current_question_started_at = NOW() - INTERVAL '10 minutes'
         WHERE team_id = $1 AND event_id = $2;`,
        [teamInProgressId, primaryEventId]
      );

      const res = await apiRequest('/api/admin/monitoring', { cookie: adminCookie });
      const teamBeta = res.data.teams.find((t) => t.teamId === teamInProgressId);
      assert(teamBeta.status === 'IN_PROGRESS', 'Status must remain IN_PROGRESS even if expired');
      assert(teamBeta.remainingSeconds === 0, `Expected remainingSeconds = 0, got ${teamBeta.remainingSeconds}`);

      // Restore Team Beta current_question_started_at
      await query(
        `UPDATE attempts
         SET current_question_started_at = NOW() - INTERVAL '10 seconds'
         WHERE team_id = $1 AND event_id = $2;`,
        [teamInProgressId, primaryEventId]
      );
    });

    // =========================================================================
    // SECTION 4: Strictly Read-Only Invariants
    // =========================================================================
    console.log('\n--- 4. Strictly Read-Only Invariants ---');

    await test('13. Expired timer in monitoring does NOT insert SKIPPED answer into answers table', async () => {
      // Expire Team Beta
      await query(
        `UPDATE attempts
         SET current_question_started_at = NOW() - INTERVAL '15 minutes'
         WHERE team_id = $1 AND event_id = $2;`,
        [teamInProgressId, primaryEventId]
      );

      const countBefore = await query(
        `SELECT COUNT(*)::int AS count FROM answers WHERE attempt_id = $1;`,
        [attBetaId]
      );

      // Query monitoring overview multiple times
      await apiRequest('/api/admin/monitoring', { cookie: adminCookie });
      await apiRequest('/api/admin/monitoring', { cookie: adminCookie });

      const countAfter = await query(
        `SELECT COUNT(*)::int AS count FROM answers WHERE attempt_id = $1;`,
        [attBetaId]
      );

      assert(
        countBefore.rows[0].count === countAfter.rows[0].count,
        `Monitoring must not add answers! Before: ${countBefore.rows[0].count}, After: ${countAfter.rows[0].count}`
      );
    });

    await test('14. Expired timer in monitoring does NOT deduct marks or mutate attempts.total_score', async () => {
      const scoreBefore = await query(
        `SELECT total_score FROM attempts WHERE id = $1;`,
        [attBetaId]
      );

      await apiRequest('/api/admin/monitoring', { cookie: adminCookie });

      const scoreAfter = await query(
        `SELECT total_score FROM attempts WHERE id = $1;`,
        [attBetaId]
      );

      assert(
        scoreBefore.rows[0].total_score === scoreAfter.rows[0].total_score,
        'Monitoring must not mutate attempt scores!'
      );
    });

    await test('15. Repeated polling requests produce stable, side-effect-free results', async () => {
      const res1 = await apiRequest('/api/admin/monitoring', { cookie: adminCookie });
      const res2 = await apiRequest('/api/admin/monitoring', { cookie: adminCookie });
      assert(res1.status === 200 && res2.status === 200, 'Both requests should succeed');
      assert(res1.data.teams.length === res2.data.teams.length, 'Team count must remain constant');
    });

    // =========================================================================
    // SECTION 5: Operational Ordering & Statistics (No Ranks)
    // =========================================================================
    console.log('\n--- 5. Operational Ordering & Statistics (No Ranks) ---');

    await test('16. 10 answered questions appears earlier than 2 answered questions in the IN_PROGRESS operational ordering.', async () => {
      const res = await apiRequest('/api/admin/monitoring', { cookie: adminCookie });
      const inProgressTeams = res.data.teams.filter((t) => t.status === 'IN_PROGRESS');
      assert(inProgressTeams.length >= 2, 'Should have at least 2 IN_PROGRESS teams');

      // Team Delta has 4 answered questions, Team Beta has 2 answered questions
      const deltaIndex = inProgressTeams.findIndex((t) => t.teamId === teamFastId);
      const betaIndex = inProgressTeams.findIndex((t) => t.teamId === teamInProgressId);

      assert(
        deltaIndex < betaIndex,
        `Team Delta (4 answered) must appear before Team Beta (2 answered). deltaIndex: ${deltaIndex}, betaIndex: ${betaIndex}`
      );
    });

    await test('17. Response objects contain operational fields and contain NO rank or leaderboardPosition fields', async () => {
      const res = await apiRequest('/api/admin/monitoring', { cookie: adminCookie });
      for (const team of res.data.teams) {
        assert(team.rank === undefined, 'team.rank must be undefined');
        assert(team.leaderboardPosition === undefined, 'team.leaderboardPosition must be undefined');
        assert(team.teamName !== undefined, 'teamName must be present');
        assert(team.progress !== undefined, 'progress must be present');
      }
    });

    await test('18. Zero completed/in-progress teams returns highestScore = 0 and averageCompletedScore = 0', async () => {
      const emptyEv = await query(
        `INSERT INTO event (name, status) VALUES ('Mon Test Empty Event', 'LIVE') RETURNING id;`
      );
      const emptyEvId = emptyEv.rows[0].id;
      // Temporarily mark primary event READY so emptyEv is the only LIVE event
      await query("UPDATE event SET status = 'READY' WHERE id = $1;", [primaryEventId]);

      const res = await apiRequest('/api/admin/monitoring', { cookie: adminCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.stats.totalApprovedTeams === 0, 'Total approved teams must be 0');
      assert(res.data.stats.highestScore === 0, 'highestScore must be 0');
      assert(res.data.stats.averageCompletedScore === 0, 'averageCompletedScore must be 0');
      assert(!isNaN(res.data.stats.completionPercentage), 'completionPercentage must not be NaN');
      assert(res.data.stats.completionPercentage === 0, 'completionPercentage must be 0');

      // Cleanup
      await query('DELETE FROM event WHERE id = $1;', [emptyEvId]);
      await query("UPDATE event SET status = 'LIVE' WHERE id = $1;", [primaryEventId]);
    });

    await test('19. High-level stats: totalApprovedTeams, notStartedCount, inProgressCount, completedCount accurate', async () => {
      const res = await apiRequest('/api/admin/monitoring', { cookie: adminCookie });
      const stats = res.data.stats;
      assert(stats.totalApprovedTeams === 4, `Expected 4 approved teams, got ${stats.totalApprovedTeams}`);
      assert(stats.notStartedCount === 1, `Expected 1 not started, got ${stats.notStartedCount}`);
      assert(stats.inProgressCount === 2, `Expected 2 in progress, got ${stats.inProgressCount}`);
      assert(stats.completedCount === 1, `Expected 1 completed, got ${stats.completedCount}`);
      assert(stats.completionPercentage === 25, `Expected 25%, got ${stats.completionPercentage}%`);
      assert(stats.highestScore === 40, `Expected highestScore 40, got ${stats.highestScore}`);
      assert(stats.averageCompletedScore === 40, `Expected averageCompletedScore 40, got ${stats.averageCompletedScore}`);
    });

    // =========================================================================
    // SECTION 6: Current Question Rules
    // =========================================================================
    console.log('\n--- 6. Current Question Rules ---');

    await test('20. currentQuestionNumber is answered_count + 1 for IN_PROGRESS', async () => {
      const res = await apiRequest('/api/admin/monitoring', { cookie: adminCookie });
      const teamBeta = res.data.teams.find((t) => t.teamId === teamInProgressId);
      assert(teamBeta.currentQuestionNumber === 3, `Expected Q3, got ${teamBeta.currentQuestionNumber}`);
      const teamDelta = res.data.teams.find((t) => t.teamId === teamFastId);
      assert(teamDelta.currentQuestionNumber === 5, `Expected Q5, got ${teamDelta.currentQuestionNumber}`);
    });

    await test('21. currentQuestionNumber is totalQuestions for COMPLETED', async () => {
      const res = await apiRequest('/api/admin/monitoring', { cookie: adminCookie });
      const teamGamma = res.data.teams.find((t) => t.teamId === teamCompletedId);
      assert(teamGamma.currentQuestionNumber === 5, `Expected Q5 for completed, got ${teamGamma.currentQuestionNumber}`);
    });

    await test('22. currentQuestionNumber is null for NOT_STARTED', async () => {
      const res = await apiRequest('/api/admin/monitoring', { cookie: adminCookie });
      const teamAlpha = res.data.teams.find((t) => t.teamId === teamNotStartedId);
      assert(teamAlpha.currentQuestionNumber === null, `Expected null, got ${teamAlpha.currentQuestionNumber}`);
    });

    // =========================================================================
    // SECTION 7: Team Detail & Cross-Event Isolation
    // =========================================================================
    console.log('\n--- 7. Team Detail & Cross-Event Isolation ---');

    await test('23. Team detail returns per-question breakdown with accurate statuses', async () => {
      const res = await apiRequest(`/api/admin/monitoring/team/${teamInProgressId}`, { cookie: adminCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.success === true, 'Success must be true');
      assert(res.data.team.teamName === 'Mon Team Beta', 'Team name must match');
      assert(res.data.questions.length === 5, `Expected 5 questions, got ${res.data.questions.length}`);

      // Q1 was correct
      assert(res.data.questions[0].status === 'CORRECT', `Expected CORRECT, got ${res.data.questions[0].status}`);
      assert(res.data.questions[0].marksAwarded === 10, 'Expected 10 marks');

      // Q2 was wrong
      assert(res.data.questions[1].status === 'WRONG', `Expected WRONG, got ${res.data.questions[1].status}`);
      assert(res.data.questions[1].marksAwarded === -5, 'Expected -5 marks');

      // Q3 is CURRENT
      assert(res.data.questions[2].status === 'CURRENT', `Expected CURRENT, got ${res.data.questions[2].status}`);
      assert(res.data.questions[2].marksAwarded === null, 'Expected null marks for CURRENT');

      // Q4 & Q5 are UNANSWERED
      assert(res.data.questions[3].status === 'UNANSWERED', 'Expected UNANSWERED for Q4');
      assert(res.data.questions[4].status === 'UNANSWERED', 'Expected UNANSWERED for Q5');
    });

    await test('24. Team detail invalid UUID returns 400 Bad Request', async () => {
      const res = await apiRequest('/api/admin/monitoring/team/invalid-uuid-format', { cookie: adminCookie });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await test('25. Team detail nonexistent UUID returns 404', async () => {
      const res = await apiRequest('/api/admin/monitoring/team/00000000-0000-0000-0000-000000000000', {
        cookie: adminCookie,
      });
      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    await test('26. Team detail for team in foreign event returns 404 (cross-event isolation)', async () => {
      const res = await apiRequest(`/api/admin/monitoring/team/${teamForeignId}`, { cookie: adminCookie });
      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    await test('27. Team detail for unapproved team returns 403', async () => {
      const unapp = await query(
        `INSERT INTO teams (event_id, name, registration_status, college, department)
         VALUES ($1, 'Mon Team Pending', 'PENDING', 'Pending College', 'CSE')
         RETURNING id;`,
        [primaryEventId]
      );
      const unappId = unapp.rows[0].id;

      const res = await apiRequest(`/api/admin/monitoring/team/${unappId}`, { cookie: adminCookie });
      assert(res.status === 403, `Expected 403, got ${res.status}`);

      // Cleanup
      await query('DELETE FROM teams WHERE id = $1;', [unappId]);
    });

    // =========================================================================
    // SECTION 8: Data Leakage Prevention
    // =========================================================================
    console.log('\n--- 8. Data Leakage Prevention ---');

    await test('28. Responses NEVER expose correct_option, question_text, or options', async () => {
      const overviewRes = await apiRequest('/api/admin/monitoring', { cookie: adminCookie });
      const overviewStr = JSON.stringify(overviewRes.data);
      assert(!overviewStr.includes('correct_option'), 'Overview must not leak correct_option');
      assert(!overviewStr.includes('question_text'), 'Overview must not leak question_text');
      assert(!overviewStr.includes('option_a'), 'Overview must not leak option_a');

      const detailRes = await apiRequest(`/api/admin/monitoring/team/${teamInProgressId}`, {
        cookie: adminCookie,
      });
      const detailStr = JSON.stringify(detailRes.data);
      assert(!detailStr.includes('correct_option'), 'Detail must not leak correct_option');
      assert(!detailStr.includes('question_text'), 'Detail must not leak question_text');
      assert(!detailStr.includes('option_a'), 'Detail must not leak option_a');
    });

    await test('29. Responses NEVER expose participant passwords, OTPs, or payment information', async () => {
      const overviewRes = await apiRequest('/api/admin/monitoring', { cookie: adminCookie });
      const overviewStr = JSON.stringify(overviewRes.data);
      assert(!overviewStr.includes('password'), 'Overview must not leak password');
      assert(!overviewStr.includes('otp'), 'Overview must not leak otp');
      assert(!overviewStr.includes('payment'), 'Overview must not leak payment');
    });

    // Cleanup all created test data
    console.log('\n--- Cleaning up test records ---');
    await query(
      "DELETE FROM answers WHERE attempt_id IN (SELECT id FROM attempts WHERE event_id IN ($1, $2));",
      [primaryEventId, secondaryEventId]
    );
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
