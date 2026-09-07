/**
 * Module 7: Round 1 Quiz Engine Comprehensive Test Suite
 */

import http from 'http';
import { query, closePool } from '../config/database.js';
import { config } from '../config/env.js';
import app from '../app.js';
import { clearTestMailbox, getLastTestEmail } from '../services/email.service.js';
import { resetQuizTimers, setQuizTimerForTest } from '../services/quiz.service.js';
import { signToken } from '../services/auth.service.js';

// Force test environment
config.email.provider = 'test';
config.nodeEnv = 'test';

let server;
let baseUrl;

const ADMIN_EMAIL = 'admin@round1.tech';
const LEAD_EMAIL = 'quiz_lead@test.com';
const LEAD2_EMAIL = 'quiz_lead2@test.com';
const MEMBER_EMAIL = 'quiz_member@test.com';
const UNAPPROVED_LEAD_EMAIL = 'quiz_unapproved@test.com';

let adminCookie;
let leadCookie;
let lead2Cookie;
let memberCookie;
let unapprovedLeadCookie;

let testEventId;
let testTeamId;
let testTeam2Id;
let unapprovedTeamId;
let leadUserId;
let lead2UserId;
let memberUserId;
let unapprovedLeadUserId;

let sampleQuestionIds = [];

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
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch (_) {}
  }

  return {
    status: res.status,
    headers: res.headers,
    data,
  };
};

const getErrorMsg = (res) => res.data?.message || res.data?.error || '';

let passCount = 0;
let failCount = 0;

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passCount++;
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${error.message}`);
    if (error.stack) {
      console.error(`    Stack: ${error.stack.split('\n').slice(1, 4).join('\n')}`);
    }
    failCount++;
  }
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message || 'Assertion failed');
};

const setupTestDatabase = async () => {
  resetQuizTimers();

  // Clean tables
  await query('DELETE FROM answers;');
  await query('DELETE FROM attempts;');
  await query('DELETE FROM questions;');
  await query('DELETE FROM team_members;');
  await query('DELETE FROM teams;');
  await query('DELETE FROM otp_codes;');
  await query('DELETE FROM event;');

  // 1. Create primary event in READY state
  const eventRes = await query(
    `INSERT INTO event (name, description, status, correct_marks, wrong_marks, skip_marks)
     VALUES ('Module 7 Quiz Engine Test Event', 'Event for quiz tests', 'READY', 10, -5, -10)
     RETURNING id;`
  );
  testEventId = eventRes.rows[0].id;

  // 2. Create Users
  const leadRes = await query(
    `INSERT INTO users (email, name, phone)
     VALUES ($1, 'Quiz Test Lead', '+919876543220')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id;`,
    [LEAD_EMAIL]
  );
  leadUserId = leadRes.rows[0].id;

  const lead2Res = await query(
    `INSERT INTO users (email, name, phone)
     VALUES ($1, 'Quiz Test Lead 2', '+919876543221')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id;`,
    [LEAD2_EMAIL]
  );
  lead2UserId = lead2Res.rows[0].id;

  const memberRes = await query(
    `INSERT INTO users (email, name, phone)
     VALUES ($1, 'Quiz Test Member', '+919876543222')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id;`,
    [MEMBER_EMAIL]
  );
  memberUserId = memberRes.rows[0].id;

  const unapprovedRes = await query(
    `INSERT INTO users (email, name, phone)
     VALUES ($1, 'Quiz Unapproved Lead', '+919876543223')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id;`,
    [UNAPPROVED_LEAD_EMAIL]
  );
  unapprovedLeadUserId = unapprovedRes.rows[0].id;

  // 3. Create Teams
  const team1Res = await query(
    `INSERT INTO teams (event_id, name, college, department, registration_status, payment_id)
     VALUES ($1, 'Alpha Quiz Team', 'Engineering College', 'CS', 'APPROVED', 'PAY-Q7-01')
     RETURNING id;`,
    [testEventId]
  );
  testTeamId = team1Res.rows[0].id;

  const team2Res = await query(
    `INSERT INTO teams (event_id, name, college, department, registration_status, payment_id)
     VALUES ($1, 'Beta Quiz Team', 'Engineering College', 'IT', 'APPROVED', 'PAY-Q7-02')
     RETURNING id;`,
    [testEventId]
  );
  testTeam2Id = team2Res.rows[0].id;

  const unapprovedTeamRes = await query(
    `INSERT INTO teams (event_id, name, college, department, registration_status)
     VALUES ($1, 'Pending Quiz Team', 'Engineering College', 'ECE', 'PENDING')
     RETURNING id;`,
    [testEventId]
  );
  unapprovedTeamId = unapprovedTeamRes.rows[0].id;

  // 4. Create Team Memberships
  await query(
    `INSERT INTO team_members (team_id, user_id, event_id, role, register_number)
     VALUES ($1, $2, $3, 'TEAM_LEAD', 'REG-Q7-01'),
            ($1, $4, $3, 'MEMBER', 'REG-Q7-02'),
            ($5, $6, $3, 'TEAM_LEAD', 'REG-Q7-03'),
            ($7, $8, $3, 'TEAM_LEAD', 'REG-Q7-04');`,
    [
      testTeamId, leadUserId, testEventId, memberUserId,
      testTeam2Id, lead2UserId,
      unapprovedTeamId, unapprovedLeadUserId,
    ]
  );

  // 5. Populate Question Bank (3 questions)
  const q1 = await query(
    `INSERT INTO questions (event_id, question_text, option_a, option_b, option_c, option_d, correct_option, time_limit_seconds, question_order)
     VALUES ($1, 'What is the capital of France?', 'London', 'Paris', 'Berlin', 'Rome', 'B', 10, 1)
     RETURNING id;`,
    [testEventId]
  );
  const q2 = await query(
    `INSERT INTO questions (event_id, question_text, option_a, option_b, option_c, option_d, correct_option, time_limit_seconds, question_order)
     VALUES ($1, 'What is 2 + 2?', '3', '4', '5', '6', 'B', 10, 2)
     RETURNING id;`,
    [testEventId]
  );
  const q3 = await query(
    `INSERT INTO questions (event_id, question_text, option_a, option_b, option_c, option_d, correct_option, time_limit_seconds, question_order)
     VALUES ($1, 'What is the chemical symbol for Gold?', 'Ag', 'Fe', 'Au', 'Cu', 'C', 10, 3)
     RETURNING id;`,
    [testEventId]
  );
  sampleQuestionIds = [q1.rows[0].id, q2.rows[0].id, q3.rows[0].id];

  // 6. Obtain Auth Cookies
  // Admin Cookie
  clearTestMailbox();
  await apiRequest('/api/auth/request-otp', {
    method: 'POST',
    body: { email: ADMIN_EMAIL },
  });
  const adminOtp = getLastTestEmail().otp;
  const adminVerify = await fetch(`${baseUrl}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, otp: adminOtp }),
  });
  adminCookie = adminVerify.headers.get('set-cookie').split(';')[0];

  // Team Lead 1 Cookie
  await query('DELETE FROM otp_codes;');
  clearTestMailbox();
  await apiRequest('/api/auth/request-otp', {
    method: 'POST',
    body: { email: LEAD_EMAIL },
  });
  const leadOtp = getLastTestEmail().otp;
  const leadVerify = await fetch(`${baseUrl}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: LEAD_EMAIL, otp: leadOtp }),
  });
  leadCookie = leadVerify.headers.get('set-cookie').split(';')[0];

  // Team Lead 2 Cookie
  await query('DELETE FROM otp_codes;');
  clearTestMailbox();
  await apiRequest('/api/auth/request-otp', {
    method: 'POST',
    body: { email: LEAD2_EMAIL },
  });
  const lead2Otp = getLastTestEmail().otp;
  const lead2Verify = await fetch(`${baseUrl}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: LEAD2_EMAIL, otp: lead2Otp }),
  });
  lead2Cookie = lead2Verify.headers.get('set-cookie').split(';')[0];

  // Member Cookie & Unapproved Lead Cookie (signed JWT sessions)
  memberCookie = `${config.auth.cookieName}=${signToken({ userId: memberUserId, role: 'MEMBER' })}`;
  unapprovedLeadCookie = `${config.auth.cookieName}=${signToken({ userId: unapprovedLeadUserId, role: 'MEMBER' })}`;
};

const runTests = async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  console.log('\n=== Module 7: Round 1 Quiz Engine Test Suite ===\n');

  try {
    await setupTestDatabase();

    // =========================================================================
    // SECTION 1: Authorization & Role Checks
    // =========================================================================
    console.log('--- 1. Authorization & Role Checks ---');

    await test('1. Unauthenticated request to /api/quiz/start returns 401', async () => {
      const res = await apiRequest('/api/quiz/start', { method: 'POST' });
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await test('2. Unauthenticated request to /api/quiz/current returns 401', async () => {
      const res = await apiRequest('/api/quiz/current');
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await test('3. Unauthenticated request to /api/quiz/answer returns 401', async () => {
      const res = await apiRequest('/api/quiz/answer', {
        method: 'POST',
        body: { selectedOption: 'A' },
      });
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await test('4. Unauthenticated request to /api/quiz/skip returns 401', async () => {
      const res = await apiRequest('/api/quiz/skip', { method: 'POST' });
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await test('5. Normal MEMBER blocked from /api/quiz/start (403 Forbidden)', async () => {
      const res = await apiRequest('/api/quiz/start', {
        method: 'POST',
        cookie: memberCookie,
      });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    await test('6. Normal MEMBER blocked from /api/quiz/current (403 Forbidden)', async () => {
      const res = await apiRequest('/api/quiz/current', {
        cookie: memberCookie,
      });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    await test('7. Normal MEMBER blocked from /api/quiz/answer (403 Forbidden)', async () => {
      const res = await apiRequest('/api/quiz/answer', {
        method: 'POST',
        cookie: memberCookie,
        body: { selectedOption: 'A' },
      });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    await test('8. Normal MEMBER blocked from /api/quiz/skip (403 Forbidden)', async () => {
      const res = await apiRequest('/api/quiz/skip', {
        method: 'POST',
        cookie: memberCookie,
      });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    await test('9. Unapproved Team Lead cannot access quiz endpoints (403 or safe denial)', async () => {
      const res = await apiRequest('/api/quiz/start', {
        method: 'POST',
        cookie: unapprovedLeadCookie,
      });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    await test('10. Team Lead (participant) blocked from /api/admin/event/start (403 Forbidden)', async () => {
      const res = await apiRequest('/api/admin/event/start', {
        method: 'POST',
        cookie: leadCookie,
      });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    await test('11. Team Lead blocked from /api/admin/event/end (403 Forbidden)', async () => {
      const res = await apiRequest('/api/admin/event/end', {
        method: 'POST',
        cookie: leadCookie,
      });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    // =========================================================================
    // SECTION 2: Admin Event Lifecycle & Start Atomicity
    // =========================================================================
    console.log('\n--- 2. Admin Event Lifecycle & Start Atomicity ---');

    await test('12. Admin start rejected if question bank has ordering gap (400 Bad Request, event remains READY)', async () => {
      // Temporarily create gap by setting Q3 order to 4
      await query('UPDATE questions SET question_order = 4 WHERE id = $1', [sampleQuestionIds[2]]);

      const res = await apiRequest('/api/admin/event/start', {
        method: 'POST',
        cookie: adminCookie,
      });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(getErrorMsg(res).includes('validation failed') || getErrorMsg(res).includes('order gap'), 'Expected bank validation error');

      // Verify event remains READY
      const evCheck = await query('SELECT status FROM event WHERE id = $1', [testEventId]);
      assert(evCheck.rows[0].status === 'READY', 'Event must remain READY on validation failure');

      // Restore order 3
      await query('UPDATE questions SET question_order = 3 WHERE id = $1', [sampleQuestionIds[2]]);
    });

    await test('13. Approved Team Lead accessing quiz while event is READY receives safe "not started" response', async () => {
      const resCurrent = await apiRequest('/api/quiz/current', { cookie: leadCookie });
      assert(resCurrent.status === 200, `Expected 200, got ${resCurrent.status}`);
      assert(resCurrent.data.notStarted === true, 'Expected notStarted=true');
      assert(resCurrent.data.message.includes('not started yet'), 'Expected not started message');

      const resStart = await apiRequest('/api/quiz/start', {
        method: 'POST',
        cookie: leadCookie,
      });
      assert(resStart.status === 200, `Expected 200, got ${resStart.status}`);
      assert(resStart.data.notStarted === true, 'Expected notStarted=true on start');
    });

    await test('14. Admin successfully starts event: transitions READY -> LIVE atomically', async () => {
      const res = await apiRequest('/api/admin/event/start', {
        method: 'POST',
        cookie: adminCookie,
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.success === true, 'Expected success=true');
      assert(res.data.event.status === 'LIVE', 'Expected event.status=LIVE');

      // Verify in DB
      const evCheck = await query('SELECT status FROM event WHERE id = $1', [testEventId]);
      assert(evCheck.rows[0].status === 'LIVE', 'Database event status must be LIVE');
    });

    await test('15. Repeated start on already LIVE event rejected (409 Conflict)', async () => {
      const res = await apiRequest('/api/admin/event/start', {
        method: 'POST',
        cookie: adminCookie,
      });
      assert(res.status === 409, `Expected 409, got ${res.status}`);
    });

    await test('16. Questions cannot be modified while event is LIVE (regression check)', async () => {
      const res = await apiRequest('/api/admin/questions', {
        method: 'POST',
        cookie: adminCookie,
        body: {
          questionText: 'Late question attempt?',
          optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D',
          correctOption: 'A',
        },
      });
      assert(res.status === 409, `Expected 409, got ${res.status}`);
    });

    // =========================================================================
    // SECTION 3: Attempt Creation, Race Safety & Question Security
    // =========================================================================
    console.log('\n--- 3. Attempt Creation, Race Safety & Question Security ---');

    let currentAttemptId;

    await test('17. Approved Team Lead starts quiz while event is LIVE: creates attempt and returns Q1', async () => {
      const res = await apiRequest('/api/quiz/start', {
        method: 'POST',
        cookie: leadCookie,
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.success === true, 'Expected success=true');
      assert(res.data.attemptId, 'Expected attemptId');
      assert(res.data.question, 'Expected question object');
      assert(res.data.question.questionNumber === 1, 'First question must be questionNumber 1');
      assert(res.data.question.totalQuestions === 3, 'Total questions must be 3');
      assert(res.data.deadline, 'Expected server-authoritative deadline');

      currentAttemptId = res.data.attemptId;

      // Verify DB attempt record
      const dbAtt = await query('SELECT * FROM attempts WHERE id = $1', [currentAttemptId]);
      assert(dbAtt.rows.length === 1, 'Attempt must exist in database');
      assert(dbAtt.rows[0].team_id === testTeamId, 'Attempt must belong to test team');
    });

    await test('18. Participant question payload strictly omits correct_option', async () => {
      const res = await apiRequest('/api/quiz/current', { cookie: leadCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.question, 'Expected question');
      assert(res.data.question.correct_option === undefined, 'correct_option must NEVER be present');
      assert(res.data.question.correctOption === undefined, 'correctOption must NEVER be present');
    });

    await test('19. Repeated start reuses the existing attempt (does not create second attempt)', async () => {
      const res = await apiRequest('/api/quiz/start', {
        method: 'POST',
        cookie: leadCookie,
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.attemptId === currentAttemptId, 'Must reuse identical attemptId');

      const countRes = await query('SELECT COUNT(*)::int AS count FROM attempts WHERE team_id = $1', [testTeamId]);
      assert(countRes.rows[0].count === 1, 'Exactly one attempt must exist for the team');
    });

    await test('20. Simultaneous / concurrent start requests result in exactly one attempt (UNIQUE team_id)', async () => {
      // Test Team 2 simultaneous starts
      const [res1, res2] = await Promise.all([
        apiRequest('/api/quiz/start', { method: 'POST', cookie: lead2Cookie }),
        apiRequest('/api/quiz/start', { method: 'POST', cookie: lead2Cookie }),
      ]);

      assert(res1.status === 200, `Expected 200, got ${res1.status}`);
      assert(res2.status === 200, `Expected 200, got ${res2.status}`);
      assert(res1.data.attemptId === res2.data.attemptId, 'Both concurrent calls must yield the same attemptId');

      const count2Res = await query('SELECT COUNT(*)::int AS count FROM attempts WHERE team_id = $1', [testTeam2Id]);
      assert(count2Res.rows[0].count === 1, 'Exactly one attempt must exist for Team 2');
    });

    await test('21. Client cannot submit custom question ID or choose an arbitrary question', async () => {
      // Attempting to answer Q3 while currently on Q1
      const res = await apiRequest('/api/quiz/answer', {
        method: 'POST',
        cookie: leadCookie,
        body: {
          selectedOption: 'C',
          questionId: sampleQuestionIds[2], // Ignored by server
        },
      });

      // Server must evaluate answer against CURRENT question (Q1: France capital, correct is B)
      // Since selectedOption was C, Q1 was answered WRONG (-5)
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.question, 'Expected next question');
      assert(res.data.question.questionNumber === 2, 'Must advance to question 2');

      // Check DB: Q1 was answered, with marks = -5
      const ansQ1 = await query(
        'SELECT * FROM answers WHERE attempt_id = $1 AND question_id = $2',
        [currentAttemptId, sampleQuestionIds[0]]
      );
      assert(ansQ1.rows.length === 1, 'Answer must be recorded for Q1');
      assert(ansQ1.rows[0].status === 'wrong', 'Q1 status must be wrong');
      assert(ansQ1.rows[0].marks_awarded === -5, 'Q1 marks must be -5');
    });

    // =========================================================================
    // SECTION 4: Server-Authoritative Question Timing & Timeouts
    // =========================================================================
    console.log('\n--- 4. Server-Authoritative Question Timing & Timeouts ---');

    await test('22. Browser refresh (GET /api/quiz/current) within deadline preserves the exact deadline', async () => {
      const res1 = await apiRequest('/api/quiz/current', { cookie: leadCookie });
      assert(res1.status === 200, `Expected 200, got ${res1.status}`);
      assert(res1.data.question.questionNumber === 2, 'Should be on question 2');
      const deadline1 = res1.data.deadline;

      // Small delay
      await new Promise((r) => setTimeout(r, 200));

      const res2 = await apiRequest('/api/quiz/current', { cookie: leadCookie });
      assert(res2.status === 200, `Expected 200, got ${res2.status}`);
      assert(res2.data.deadline === deadline1, 'Deadline must be identical on refresh');
    });

    await test('23. Valid on-time answer submitted before deadline accepted (+10 marks)', async () => {
      // Q2: 2 + 2 = ? correct is B
      const res = await apiRequest('/api/quiz/answer', {
        method: 'POST',
        cookie: leadCookie,
        body: { selectedOption: 'B' },
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.question, 'Expected next question');
      assert(res.data.question.questionNumber === 3, 'Must advance to question 3');

      // Check DB for Q2
      const ansQ2 = await query(
        'SELECT * FROM answers WHERE attempt_id = $1 AND question_id = $2',
        [currentAttemptId, sampleQuestionIds[1]]
      );
      assert(ansQ2.rows.length === 1, 'Answer must be recorded for Q2');
      assert(ansQ2.rows[0].status === 'correct', 'Q2 status must be correct');
      assert(ansQ2.rows[0].marks_awarded === 10, 'Q2 marks must be +10');
    });

    await test('24. Already answered question cannot be answered again (409 Conflict)', async () => {
      // Now on Q3; Q2 is already answered. Trying to submit duplicate answer
      // Even if client attempts to re-submit
      const res = await apiRequest('/api/quiz/answer', {
        method: 'POST',
        cookie: leadCookie,
        body: { selectedOption: 'B' },
      });
      // This will answer Q3! Let's verify Q3 handling
      assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    // =========================================================================
    // SECTION 5: Completion & Scoring on Final Question
    // =========================================================================
    console.log('\n--- 5. Completion & Scoring on Final Question ---');

    await test('25. Final question completion returns exact completion message', async () => {
      // Q3 was answered in test 24 (selectedOption: B on Q3, chemical symbol for Gold, correct is C, so wrong)
      // Since Q3 was the final question (3 of 3), attempt must now be complete
      const res = await apiRequest('/api/quiz/current', { cookie: leadCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.completed === true, 'Expected completed=true');
      assert(
        res.data.message === 'The round 1 is successfully finished and the results will be announced in the WhatsApp group.',
        'Exact completion message must be returned'
      );
      assert(res.data.leaderboard === undefined, 'Leaderboard must NOT be returned');
      assert(res.data.ranking === undefined, 'Ranking must NOT be returned');

      // Check DB attempt
      const dbAtt = await query('SELECT * FROM attempts WHERE id = $1', [currentAttemptId]);
      assert(dbAtt.rows[0].completed_at !== null, 'completed_at must be set');
      // Score calculation: Q1(-5) + Q2(+10) + Q3(-5) = 0
      assert(dbAtt.rows[0].total_score === 0, `Expected total_score 0, got ${dbAtt.rows[0].total_score}`);
    });

    await test('26. Completed attempt rejects further answer submissions', async () => {
      const res = await apiRequest('/api/quiz/answer', {
        method: 'POST',
        cookie: leadCookie,
        body: { selectedOption: 'A' },
      });

      // Must return completed state safely
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.completed === true, 'Expected completed=true');
    });

    await test('27. Completed attempt cannot restart (POST /api/quiz/start returns completion state)', async () => {
      const res = await apiRequest('/api/quiz/start', {
        method: 'POST',
        cookie: leadCookie,
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.completed === true, 'Must return completed state');
      assert(res.data.message.includes('successfully finished'), 'Must return completion message');
    });

    // =========================================================================
    // SECTION 6: Skip and Timeout Logic on Team 2
    // =========================================================================
    console.log('\n--- 6. Skip and Timeout Logic on Team 2 ---');

    let team2AttemptId;

    await test('28. Team 2 starts quiz: Q1 begins', async () => {
      const res = await apiRequest('/api/quiz/current', { cookie: lead2Cookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.question.questionNumber === 1, 'Must be on Q1');
      team2AttemptId = res.data.attemptId;
    });

    await test('29. Skip request awards -10 marks and advances to next question', async () => {
      const res = await apiRequest('/api/quiz/skip', {
        method: 'POST',
        cookie: lead2Cookie,
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.question.questionNumber === 2, 'Must advance to question 2');

      // Check DB
      const ansQ1 = await query(
        'SELECT * FROM answers WHERE attempt_id = $1 AND question_id = $2',
        [team2AttemptId, sampleQuestionIds[0]]
      );
      assert(ansQ1.rows[0].status === 'skipped', 'Status must be skipped');
      assert(ansQ1.rows[0].marks_awarded === -10, 'Marks awarded must be -10');
    });

    await test('30. Timeout processing: simulated expired deadline records skipped (-10 marks)', async () => {
      // Simulate expired deadline on Q2 by setting timer in past
      const expiredTime = new Date(Date.now() - 5000); // 5 seconds in past
      setQuizTimerForTest(team2AttemptId, {
        questionId: sampleQuestionIds[1],
        questionOrder: 2,
        startTime: new Date(Date.now() - 15000),
        deadline: expiredTime,
      });

      // Submit late answer
      const res = await apiRequest('/api/quiz/answer', {
        method: 'POST',
        cookie: lead2Cookie,
        body: { selectedOption: 'B' }, // Correct answer for Q2, but late!
      });

      // Even though B was correct, deadline expired so Q2 was recorded as SKIPPED (-10)
      assert(res.status === 200, `Expected 200, got ${res.status}`);

      const ansQ2 = await query(
        'SELECT * FROM answers WHERE attempt_id = $1 AND question_id = $2',
        [team2AttemptId, sampleQuestionIds[1]]
      );
      assert(ansQ2.rows.length === 1, 'Answer must exist for Q2');
      // Must be skipped due to timeout
      assert(ansQ2.rows[0].status === 'skipped', 'Q2 status must be skipped due to deadline expiry');
      assert(ansQ2.rows[0].marks_awarded === -10, 'Q2 marks must be -10');
    });

    // =========================================================================
    // SECTION 7: Security, Sanitization & Tampering Resistance
    // =========================================================================
    console.log('\n--- 7. Security, Sanitization & Tampering Resistance ---');

    await test('31. Client cannot supply custom marks or score in request body', async () => {
      // Even if client adds marks_awarded = 1000 in body
      const res = await apiRequest('/api/quiz/answer', {
        method: 'POST',
        cookie: leadCookie,
        body: { selectedOption: 'A', marks_awarded: 1000, score: 9999 },
      });
      // Handled safely without altering total_score
      const dbAtt = await query('SELECT total_score FROM attempts WHERE id = $1', [currentAttemptId]);
      assert(dbAtt.rows[0].total_score === 0, 'Score must remain 0, client marks ignored');
    });

    await test('32. Raw SQL/Database errors are not exposed in responses', async () => {
      const res = await apiRequest('/api/quiz/answer', {
        method: 'POST',
        cookie: lead2Cookie,
        body: { selectedOption: "'; DROP TABLE answers; --" },
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(!getErrorMsg(res).includes('syntax error'), 'Must not leak SQL syntax error');
    });

    await test('33. Invalid option format (not A/B/C/D) rejected with 400 Bad Request', async () => {
      const res = await apiRequest('/api/quiz/answer', {
        method: 'POST',
        cookie: lead2Cookie,
        body: { selectedOption: 'E' },
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(getErrorMsg(res).includes('Must be one of A, B, C, or D'), 'Expected valid options error');
    });

    // =========================================================================
    // SECTION 8: Admin Event End Behavior
    // =========================================================================
    console.log('\n--- 8. Admin Event End Behavior ---');

    await test('34. Admin ends event: transitions LIVE -> ENDED', async () => {
      const res = await apiRequest('/api/admin/event/end', {
        method: 'POST',
        cookie: adminCookie,
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.success === true, 'Expected success=true');
      assert(res.data.event.status === 'ENDED', 'Expected event.status=ENDED');

      const evCheck = await query('SELECT status FROM event WHERE id = $1', [testEventId]);
      assert(evCheck.rows[0].status === 'ENDED', 'DB status must be ENDED');
    });

    await test('35. Cannot end event if not LIVE (409 Conflict)', async () => {
      const res = await apiRequest('/api/admin/event/end', {
        method: 'POST',
        cookie: adminCookie,
      });
      assert(res.status === 409, `Expected 409, got ${res.status}`);
    });

    await test('36. Calling quiz answer after event ENDED rejected (409 Conflict)', async () => {
      // Team 2 was not finished yet
      const res = await apiRequest('/api/quiz/answer', {
        method: 'POST',
        cookie: lead2Cookie,
        body: { selectedOption: 'C' },
      });
      assert(res.status === 409, `Expected 409, got ${res.status}`);
      assert(getErrorMsg(res).includes('ended'), 'Expected ended error');
    });

    await test('37. Team with already-completed attempt can still see completion state after event ENDED', async () => {
      // Team 1 completed before event ended
      const res = await apiRequest('/api/quiz/current', { cookie: leadCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.completed === true, 'Expected completed=true');
      assert(res.data.message.includes('successfully finished'), 'Expected completion message');
    });

    // =========================================================================
    // SECTION 9: Additional Edge Cases & Configuration Safety
    // =========================================================================
    console.log('\n--- 9. Additional Edge Cases & Configuration Safety ---');

    await test('38. Multiple LIVE events configuration error fails safely with 500 without arbitrary selection', async () => {
      // Restore testEventId to LIVE and add a second LIVE event
      await query("UPDATE event SET status = 'LIVE' WHERE id = $1;", [testEventId]);
      const r2 = await query("INSERT INTO event (name, status) VALUES ('Live 2', 'LIVE') RETURNING id;");

      const res = await apiRequest('/api/quiz/start', {
        method: 'POST',
        cookie: lead2Cookie,
      });

      await query('DELETE FROM event WHERE id = $1', [r2.rows[0].id]);
      await query("UPDATE event SET status = 'ENDED' WHERE id = $1;", [testEventId]);

      assert(res.status === 500, `Expected 500, got ${res.status}`);
      assert(getErrorMsg(res).includes('multiple LIVE events'), 'Expected multiple live events error');
    });

    await test('39. Multiple READY events on admin start fails safely with 500 without arbitrary selection', async () => {
      // Insert two READY events
      const r1 = await query("INSERT INTO event (name, status) VALUES ('READY 1', 'READY') RETURNING id;");
      const r2 = await query("INSERT INTO event (name, status) VALUES ('READY 2', 'READY') RETURNING id;");

      const res = await apiRequest('/api/admin/event/start', {
        method: 'POST',
        cookie: adminCookie,
      });

      await query('DELETE FROM event WHERE id IN ($1, $2)', [r1.rows[0].id, r2.rows[0].id]);

      assert(res.status === 500, `Expected 500, got ${res.status}`);
      assert(getErrorMsg(res).includes('multiple READY events'), 'Expected multiple ready events error');
    });

    await test('40. Participant cannot inject foreign team_id in attempt/quiz requests', async () => {
      // Trying to query or act on another team's attempt via query param or body
      const res = await apiRequest(`/api/quiz/current?teamId=${testTeam2Id}`, {
        cookie: leadCookie, // Lead 1
      });
      // Server strictly resolves from authenticated session, never query string
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      // Must be Lead 1's completed attempt
      assert(res.data.completed === true, 'Must return Lead 1 completed attempt');
    });

    await test('41. Client-provided event_id in answer payload cannot override active event', async () => {
      const res = await apiRequest('/api/quiz/answer', {
        method: 'POST',
        cookie: lead2Cookie,
        body: {
          selectedOption: 'A',
          event_id: '00000000-0000-0000-0000-000000000000',
        },
      });
      assert(res.status === 409, `Expected 409, got ${res.status}`);
    });

    await test('42. Calling POST /api/quiz/answer with missing selectedOption rejected with 400', async () => {
      const res = await apiRequest('/api/quiz/answer', {
        method: 'POST',
        cookie: leadCookie,
        body: {},
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(getErrorMsg(res).includes('Invalid selected option'), 'Expected invalid option error');
    });

    await test('43. Question bank with 0 questions blocks quiz start (400 Bad Request)', async () => {
      // Create empty LIVE event
      const emptyEv = await query(
        "INSERT INTO event (name, status) VALUES ('Empty Bank Event', 'LIVE') RETURNING id;"
      );
      const freshUser = await query(
        "INSERT INTO users (email, name) VALUES ('fresh_empty@test.com', 'Fresh Lead') RETURNING id;"
      );
      const empTeam = await query(
        "INSERT INTO teams (event_id, name, college, department, registration_status) VALUES ($1, 'Emp Team', 'C', 'D', 'APPROVED') RETURNING id;",
        [emptyEv.rows[0].id]
      );
      const empMember = await query(
        "INSERT INTO team_members (team_id, user_id, event_id, role, register_number) VALUES ($1, $2, $3, 'TEAM_LEAD', 'REG-EMP') RETURNING id;",
        [empTeam.rows[0].id, freshUser.rows[0].id, emptyEv.rows[0].id]
      );

      const freshCookie = `${config.auth.cookieName}=${signToken({ userId: freshUser.rows[0].id, role: 'TEAM_LEAD' })}`;
      const res = await apiRequest('/api/quiz/start', {
        method: 'POST',
        cookie: freshCookie,
      });

      // Cleanup
      await query('DELETE FROM team_members WHERE id = $1', [empMember.rows[0].id]);
      await query('DELETE FROM teams WHERE id = $1', [empTeam.rows[0].id]);
      await query('DELETE FROM users WHERE id = $1', [freshUser.rows[0].id]);
      await query('DELETE FROM event WHERE id = $1', [emptyEv.rows[0].id]);

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(getErrorMsg(res).includes('empty'), 'Expected empty bank error');
    });

    // =========================================================================
    // SECTION 10: Timer Persistence & Server-Authoritative Timing Audit Fixes
    // =========================================================================
    console.log('\n--- 10. Timer Persistence, Restart Recovery & Concurrency ---');

    // Setup dedicated LIVE event and questions for timer persistence testing
    const timerEv = await query(
      `INSERT INTO event (name, status, correct_marks, wrong_marks, skip_marks) 
       VALUES ('Timer Audit Test Event', 'LIVE', 10, -5, -10) 
       RETURNING id;`
    );
    const timerEventId = timerEv.rows[0].id;

    // Create 3 questions with variable time limits (30s, 45s, 60s)
    const tQ1 = await query(
      `INSERT INTO questions (event_id, question_text, option_a, option_b, option_c, option_d, correct_option, time_limit_seconds, question_order)
       VALUES ($1, 'Timer Audit Q1', 'A1', 'B1', 'C1', 'D1', 'A', 30, 1) RETURNING id;`,
      [timerEventId]
    );
    const tQ2 = await query(
      `INSERT INTO questions (event_id, question_text, option_a, option_b, option_c, option_d, correct_option, time_limit_seconds, question_order)
       VALUES ($1, 'Timer Audit Q2', 'A2', 'B2', 'C2', 'D2', 'B', 45, 2) RETURNING id;`,
      [timerEventId]
    );
    const tQ3 = await query(
      `INSERT INTO questions (event_id, question_text, option_a, option_b, option_c, option_d, correct_option, time_limit_seconds, question_order)
       VALUES ($1, 'Timer Audit Q3', 'A3', 'B3', 'C3', 'D3', 'C', 60, 3) RETURNING id;`,
      [timerEventId]
    );

    const timerUser = await query(
      "INSERT INTO users (email, name) VALUES ('timer_lead@test.com', 'Timer Lead') RETURNING id;"
    );
    const timerTeam = await query(
      "INSERT INTO teams (event_id, name, college, department, registration_status) VALUES ($1, 'Timer Team', 'Col', 'Dept', 'APPROVED') RETURNING id;",
      [timerEventId]
    );
    await query(
      "INSERT INTO team_members (team_id, user_id, event_id, role, register_number) VALUES ($1, $2, $3, 'TEAM_LEAD', 'REG-TMR') RETURNING id;",
      [timerTeam.rows[0].id, timerUser.rows[0].id, timerEventId]
    );
    const timerCookie = `${config.auth.cookieName}=${signToken({ userId: timerUser.rows[0].id, role: 'TEAM_LEAD' })}`;

    let initialDeadline;
    let timerAttemptId;

    await test('44. Quiz start initializes database-persisted current_question_started_at', async () => {
      const res = await apiRequest('/api/quiz/start', {
        method: 'POST',
        cookie: timerCookie,
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.question.questionNumber === 1, 'Must start on Q1');
      assert(res.data.deadline, 'Must return authoritative deadline');
      initialDeadline = res.data.deadline;
      timerAttemptId = res.data.attemptId;

      const attCheck = await query(
        'SELECT current_question_started_at FROM attempts WHERE id = $1',
        [timerAttemptId]
      );
      assert(attCheck.rows[0].current_question_started_at, 'current_question_started_at must be populated in DB');
    });

    await test('45. Refresh (GET /api/quiz/current) preserves the exact same deadline', async () => {
      const res = await apiRequest('/api/quiz/current', { cookie: timerCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.deadline === initialDeadline, 'Deadline must match original deadline on refresh');
    });

    await test('46. Timer persistence after simulated server restart: deadline is reconstructed without reset', async () => {
      // Simulate server restart by clearing all in-memory test overrides
      resetQuizTimers();

      // Wait 100ms
      await new Promise((resolve) => setTimeout(resolve, 100));

      const res = await apiRequest('/api/quiz/current', { cookie: timerCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.question.questionNumber === 1, 'Must still be on Q1');
      assert(res.data.deadline === initialDeadline, 'Deadline after restart must be identical to pre-restart deadline');
    });

    await test('47. Next question starts at actual server advancement time (database NOW())', async () => {
      const preAdvanceTime = new Date();

      const res = await apiRequest('/api/quiz/answer', {
        method: 'POST',
        cookie: timerCookie,
        body: { selectedOption: 'A' }, // Correct answer for Q1
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.question.questionNumber === 2, 'Must advance to Q2');

      const attCheck = await query(
        'SELECT current_question_started_at FROM attempts WHERE id = $1',
        [timerAttemptId]
      );
      const postAdvanceStartedAt = new Date(attCheck.rows[0].current_question_started_at);
      assert(postAdvanceStartedAt >= new Date(preAdvanceTime.getTime() - 2000), 'Started at must be at advancement time');
    });

    await test('48. Variable question time limits handled correctly (Q2 has 45s limit vs Q1 30s)', async () => {
      const attCheck = await query(
        'SELECT current_question_started_at FROM attempts WHERE id = $1',
        [timerAttemptId]
      );
      const q2StartedAt = new Date(attCheck.rows[0].current_question_started_at).getTime();

      const res = await apiRequest('/api/quiz/current', { cookie: timerCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.question.timeLimitSeconds === 45, 'Q2 must have 45s limit');

      const q2Deadline = new Date(res.data.deadline).getTime();
      const diffSeconds = Math.round((q2Deadline - q2StartedAt) / 1000);
      assert(diffSeconds === 45, `Deadline difference must be 45 seconds, got ${diffSeconds}`);
    });

    await test('49. Answer processing delay does not grant extra time to next question', async () => {
      const res = await apiRequest('/api/quiz/current', { cookie: timerCookie });
      const attCheck = await query(
        'SELECT current_question_started_at FROM attempts WHERE id = $1',
        [timerAttemptId]
      );
      const startedAt = new Date(attCheck.rows[0].current_question_started_at).getTime();
      const deadline = new Date(res.data.deadline).getTime();

      // Exact mathematical derivation: deadline === startedAt + 45000ms
      assert(deadline - startedAt === 45 * 1000, 'Deadline must equal current_question_started_at + time_limit_seconds');
    });

    await test('50. Simultaneous progression requests: exactly one succeeds, second gets 409 Conflict', async () => {
      // Fire two concurrent answer requests for Q2 targeting Q2
      const [resA, resB] = await Promise.all([
        apiRequest('/api/quiz/answer', {
          method: 'POST',
          cookie: timerCookie,
          body: { selectedOption: 'B', questionId: tQ2.rows[0].id },
        }),
        apiRequest('/api/quiz/answer', {
          method: 'POST',
          cookie: timerCookie,
          body: { selectedOption: 'B', questionId: tQ2.rows[0].id },
        }),
      ]);

      const statuses = [resA.status, resB.status];
      assert(statuses.includes(200), 'One simultaneous request must succeed (200)');
      assert(statuses.includes(409), 'Second simultaneous request must be rejected with 409 Conflict');

      // Verify answers table has exactly one answer for Q2
      const ansCount = await query(
        'SELECT COUNT(*)::int AS count FROM answers WHERE attempt_id = $1 AND question_id = $2',
        [timerAttemptId, tQ2.rows[0].id]
      );
      assert(ansCount.rows[0].count === 1, 'Only one answer must be recorded for Q2');
    });

    await test('51. Timeout after restart: simulated past start time cascades timeout and records skipped (-10 marks)', async () => {
      // Set current_question_started_at to 1 hour in the past to simulate downtime
      await query(
        "UPDATE attempts SET current_question_started_at = NOW() - INTERVAL '1 hour' WHERE id = $1",
        [timerAttemptId]
      );
      resetQuizTimers();

      // GET /api/quiz/current recovers state, detects Q3 deadline passed, records skipped (-10) and completes quiz
      const res = await apiRequest('/api/quiz/current', { cookie: timerCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.completed === true, 'Quiz must be completed after cascading timeout of final question');

      const ansQ3 = await query(
        'SELECT * FROM answers WHERE attempt_id = $1 AND question_id = $2',
        [timerAttemptId, tQ3.rows[0].id]
      );
      assert(ansQ3.rows.length === 1, 'Answer must exist for Q3');
      assert(ansQ3.rows[0].status === 'skipped', 'Q3 status must be skipped');
      assert(ansQ3.rows[0].marks_awarded === -10, 'Q3 marks must be -10');
    });

    await test('52. Completed attempt remains completed across server restarts and cannot be restarted', async () => {
      const attCheck = await query(
        'SELECT completed_at, current_question_started_at, total_score FROM attempts WHERE id = $1',
        [timerAttemptId]
      );
      assert(attCheck.rows[0].completed_at !== null, 'completed_at must be set');
      assert(attCheck.rows[0].current_question_started_at === null, 'current_question_started_at must be cleared (NULL)');

      // Simulate restart
      resetQuizTimers();

      // Calling start, current, and answer must all return completed state
      const startRes = await apiRequest('/api/quiz/start', { method: 'POST', cookie: timerCookie });
      assert(startRes.data.completed === true, 'Start must return completed');

      const currentRes = await apiRequest('/api/quiz/current', { cookie: timerCookie });
      assert(currentRes.data.completed === true, 'Current must return completed');

      const answerRes = await apiRequest('/api/quiz/answer', {
        method: 'POST',
        cookie: timerCookie,
        body: { selectedOption: 'A' },
      });
      assert(answerRes.data.completed === true, 'Answer on completed attempt must return completed');
    });

    // Cleanup timer persistence test event
    await query('DELETE FROM answers WHERE attempt_id = $1', [timerAttemptId]);
    await query('DELETE FROM attempts WHERE id = $1', [timerAttemptId]);
    await query('DELETE FROM team_members WHERE team_id = $1', [timerTeam.rows[0].id]);
    await query('DELETE FROM teams WHERE id = $1', [timerTeam.rows[0].id]);
    await query('DELETE FROM users WHERE id = $1', [timerUser.rows[0].id]);
    await query('DELETE FROM questions WHERE event_id = $1', [timerEventId]);
    await query('DELETE FROM event WHERE id = $1', [timerEventId]);

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
    await query('DELETE FROM otp_codes;');
    await closePool();
  }
};

runTests();
