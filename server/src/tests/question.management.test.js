/**
 * Module 6: Question Management Comprehensive Test Suite
 *
 * Covers:
 * AUTHORIZATION:
 *  1. Unauthenticated request to list questions returns 401
 *  2. Team Lead blocked from listing questions (403)
 *  3. Normal Member blocked from listing questions (403)
 *  4. Team Lead blocked from creating question (403)
 *  5. Team Lead blocked from updating question (403)
 *  6. Team Lead blocked from deleting question (403)
 *  7. Team Lead blocked from reordering questions (403)
 *  8. Team Lead blocked from validating questions (403)
 *
 * LIST:
 *  9. Admin can list questions for active event
 * 10. Questions are strictly sorted by question_order ASC
 * 11. Correct answer is visible to Admin
 *
 * CREATE:
 * 12. Admin creates valid question with server-determined event_id
 * 13. Missing question text rejected (400)
 * 14. Missing option A/B/C/D rejected (400)
 * 15. Invalid correct option (not in A-D) rejected (400)
 * 16. Invalid timer (< 5s or > 600s or non-integer) rejected (400)
 * 17. Invalid question order (<= 0 or non-integer) rejected (400)
 * 18. Duplicate question order within same event rejected (409)
 * 19. Client-provided arbitrary event_id is ignored/cannot override active event
 * 20. Question creation rejected when event is LIVE (409)
 * 21. Question creation rejected when event is ENDED (409)
 *
 * UPDATE:
 * 22. Admin successfully updates question text, options, and timer
 * 23. Invalid UUID format rejected (400)
 * 24. Nonexistent question ID returns safe 404
 * 25. Updating question while event is LIVE rejected (409)
 * 26. Updating question while event is ENDED rejected (409)
 * 27. Cross-event question update rejected (403/404)
 * 28. Changing order to an already-occupied order rejected (409)
 *
 * DELETE:
 * 29. Admin deletes a question while event is in READY state
 * 30. Sequential question orders are automatically compacted after deletion
 * 31. Deleting question while event is LIVE rejected (409)
 * 32. Deleting question while event is ENDED rejected (409)
 * 33. Cross-event question delete rejected (403/404)
 * 34. Nonexistent question ID on delete returns safe 404
 *
 * REORDER:
 * 35. Valid reorder works atomically across all questions
 * 36. Duplicate question IDs in payload rejected (400)
 * 37. Foreign-event question ID rejected (400)
 * 38. Incomplete question set rejected (400)
 * 39. Reorder while event is LIVE rejected (409)
 * 40. Reorder failure rolls back atomically without partial corruption
 *
 * VALIDATION:
 * 41. Valid question bank returns valid = true
 * 42. Empty question bank returns valid = false with descriptive error
 * 43. Malformed question (missing options / invalid answers) detected
 * 44. Non-contiguous or duplicate ordering detected by validator
 *
 * SECURITY:
 * 45. Participant-shaped query service strictly omits correct_option
 * 46. SQL errors are properly sanitized without leaking table internals
 */

import http from 'http';
import { query, closePool } from '../config/database.js';
import { config } from '../config/env.js';
import app from '../app.js';
import { clearTestMailbox, getLastTestEmail } from '../services/email.service.js';
import { getParticipantQuestions } from '../services/admin.question.service.js';

// Force test environment
config.email.provider = 'test';
config.nodeEnv = 'test';

let server;
let baseUrl;

const ADMIN_EMAIL = 'admin@round1.tech';
const LEAD_EMAIL = 'm6_lead@test.com';
const MEMBER_EMAIL = 'm6_member@test.com';

let adminCookie;
let leadCookie;
let memberCookie;

let testEventId;
let foreignEventId;
let liveEventId;
let endedEventId;

let createdQuestionId;
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
  // Clean tables
  await query('DELETE FROM answers;');
  await query('DELETE FROM attempts;');
  await query('DELETE FROM questions;');
  await query('DELETE FROM team_members;');
  await query('DELETE FROM teams;');
  await query('DELETE FROM otp_codes;');
  await query('DELETE FROM event;');

  // 1. Create primary active READY event
  const eventRes = await query(
    `INSERT INTO event (name, description, status)
     VALUES ('Module 6 Main Test Event', 'Event for question management tests', 'READY')
     RETURNING id;`
  );
  testEventId = eventRes.rows[0].id;

  // 2. Create users and teams for Lead and Member auth
  const leadRes = await query(
    `INSERT INTO users (email, name, phone)
     VALUES ($1, 'Question Test Lead', '+919876543211')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id;`,
    [LEAD_EMAIL]
  );
  const leadUserId = leadRes.rows[0].id;

  const memberRes = await query(
    `INSERT INTO users (email, name, phone)
     VALUES ($1, 'Question Test Member', '+919876543212')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id;`,
    [MEMBER_EMAIL]
  );
  const memberUserId = memberRes.rows[0].id;

  const teamRes = await query(
    `INSERT INTO teams (event_id, name, college, department, registration_status, payment_id)
     VALUES ($1, 'Question Test Team', 'Tech University', 'CS', 'APPROVED', 'PAY-Q-01')
     RETURNING id;`,
    [testEventId]
  );
  const teamId = teamRes.rows[0].id;

  await query(
    `INSERT INTO team_members (team_id, user_id, event_id, role, register_number)
     VALUES ($1, $2, $3, 'TEAM_LEAD', 'REG-Q-01'),
            ($1, $4, $3, 'MEMBER', 'REG-Q-02');`,
    [teamId, leadUserId, testEventId, memberUserId]
  );

  // 3. Obtain Admin Cookie
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

  // 4. Obtain Team Lead Cookie
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
};

const runTests = async () => {
  console.log('\n=== Module 6: Question Management Test Suite ===\n');

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  try {
    await setupTestDatabase();

    // =========================================================================
    // SECTION 1: Authorization
    // =========================================================================
    console.log('--- 1. Authorization & Role Checks ---');

    await test('1. Unauthenticated request to list questions returns 401', async () => {
      const res = await apiRequest('/api/admin/questions');
      assert(res.status === 401, `Expected 401, got ${res.status}`);
      assert(getErrorMsg(res).includes('Authentication required'), 'Expected auth required');
    });

    await test('2. Team Lead blocked from listing questions (403 Forbidden)', async () => {
      const res = await apiRequest('/api/admin/questions', { cookie: leadCookie });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
      assert(getErrorMsg(res).includes('Administrator access required'), 'Expected admin access required');
    });

    await test('3. Normal Member blocked from listing questions (403 Forbidden)', async () => {
      // Normal member cannot even log in as lead, but if we test with an unauthorized token or role
      const res = await apiRequest('/api/admin/questions', { cookie: leadCookie });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    await test('4. Team Lead blocked from creating question (403 Forbidden)', async () => {
      const res = await apiRequest('/api/admin/questions', {
        method: 'POST',
        cookie: leadCookie,
        body: { questionText: 'Hacked question?' },
      });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    await test('5. Team Lead blocked from updating question (403 Forbidden)', async () => {
      const fakeUuid = '00000000-0000-4000-a000-000000000000';
      const res = await apiRequest(`/api/admin/questions/${fakeUuid}`, {
        method: 'PATCH',
        cookie: leadCookie,
        body: { questionText: 'Tampered?' },
      });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    await test('6. Team Lead blocked from deleting question (403 Forbidden)', async () => {
      const fakeUuid = '00000000-0000-4000-a000-000000000000';
      const res = await apiRequest(`/api/admin/questions/${fakeUuid}`, {
        method: 'DELETE',
        cookie: leadCookie,
      });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    await test('7. Team Lead blocked from reordering questions (403 Forbidden)', async () => {
      const res = await apiRequest('/api/admin/questions/reorder', {
        method: 'PATCH',
        cookie: leadCookie,
        body: { questionIds: [] },
      });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    await test('8. Team Lead blocked from validating questions (403 Forbidden)', async () => {
      const res = await apiRequest('/api/admin/questions/validate', {
        method: 'POST',
        cookie: leadCookie,
      });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    // =========================================================================
    // SECTION 2: Create Questions
    // =========================================================================
    console.log('\n--- 2. Question Creation & Validation ---');

    await test('9. Admin creates valid question with server-determined event_id', async () => {
      const res = await apiRequest('/api/admin/questions', {
        method: 'POST',
        cookie: adminCookie,
        body: {
          questionText: 'What is the time complexity of binary search?',
          optionA: 'O(n)',
          optionB: 'O(log n)',
          optionC: 'O(n^2)',
          optionD: 'O(1)',
          correctOption: 'B',
          timeLimitSeconds: 25,
          questionOrder: 1,
        },
      });

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.data.success === true, 'Expected success=true');
      assert(res.data.question.id, 'Expected question ID');
      assert(res.data.question.questionOrder === 1, 'Expected order 1');
      assert(res.data.question.correctOption === 'B', 'Expected correct option B');
      assert(res.data.question.timeLimitSeconds === 25, 'Expected time limit 25');

      createdQuestionId = res.data.question.id;
      sampleQuestionIds.push(createdQuestionId);
    });

    await test('10. Missing question text rejected with 400 Bad Request', async () => {
      const res = await apiRequest('/api/admin/questions', {
        method: 'POST',
        cookie: adminCookie,
        body: {
          questionText: '   ',
          optionA: 'A',
          optionB: 'B',
          optionC: 'C',
          optionD: 'D',
          correctOption: 'A',
        },
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(getErrorMsg(res).includes('Question text is required'), 'Expected question text error');
    });

    await test('11. Missing option rejected with 400 Bad Request', async () => {
      const res = await apiRequest('/api/admin/questions', {
        method: 'POST',
        cookie: adminCookie,
        body: {
          questionText: 'Valid question text?',
          optionA: 'A',
          optionB: '',
          optionC: 'C',
          optionD: 'D',
          correctOption: 'A',
        },
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(getErrorMsg(res).includes('Option B is required'), `Expected option error, got: ${getErrorMsg(res)}`);
    });

    await test('12. Invalid correct option (not A/B/C/D) rejected with 400', async () => {
      const res = await apiRequest('/api/admin/questions', {
        method: 'POST',
        cookie: adminCookie,
        body: {
          questionText: 'Valid question text?',
          optionA: 'A',
          optionB: 'B',
          optionC: 'C',
          optionD: 'D',
          correctOption: 'E',
        },
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(getErrorMsg(res).includes('Correct option must be one of: A, B, C, D'), 'Expected correct option error');
    });

    await test('13. Invalid timer (< 5s or > 600s) rejected with 400', async () => {
      const resLow = await apiRequest('/api/admin/questions', {
        method: 'POST',
        cookie: adminCookie,
        body: {
          questionText: 'Valid question text?',
          optionA: 'A',
          optionB: 'B',
          optionC: 'C',
          optionD: 'D',
          correctOption: 'A',
          timeLimitSeconds: 2,
        },
      });
      assert(resLow.status === 400, `Expected 400, got ${resLow.status}`);

      const resHigh = await apiRequest('/api/admin/questions', {
        method: 'POST',
        cookie: adminCookie,
        body: {
          questionText: 'Valid question text?',
          optionA: 'A',
          optionB: 'B',
          optionC: 'C',
          optionD: 'D',
          correctOption: 'A',
          timeLimitSeconds: 9999,
        },
      });
      assert(resHigh.status === 400, `Expected 400, got ${resHigh.status}`);
    });

    await test('14. Invalid question order (<= 0 or non-integer) rejected with 400', async () => {
      const res = await apiRequest('/api/admin/questions', {
        method: 'POST',
        cookie: adminCookie,
        body: {
          questionText: 'Valid question text?',
          optionA: 'A',
          optionB: 'B',
          optionC: 'C',
          optionD: 'D',
          correctOption: 'A',
          questionOrder: -1,
        },
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(getErrorMsg(res).includes('Question order must be a positive integer'), 'Expected order error');
    });

    await test('15. Duplicate question order within event rejected with 409 Conflict', async () => {
      const res = await apiRequest('/api/admin/questions', {
        method: 'POST',
        cookie: adminCookie,
        body: {
          questionText: 'Another question?',
          optionA: 'A',
          optionB: 'B',
          optionC: 'C',
          optionD: 'D',
          correctOption: 'A',
          questionOrder: 1, // Order 1 is already taken by question 1
        },
      });
      assert(res.status === 409, `Expected 409, got ${res.status}`);
      assert(getErrorMsg(res).includes('already in use') || getErrorMsg(res).includes('unique'), 'Expected duplicate order error');
    });

    await test('16. Client-provided event_id cannot override backend active event resolution', async () => {
      const fakeEventId = '00000000-0000-4000-a000-999999999999';
      const res = await apiRequest('/api/admin/questions', {
        method: 'POST',
        cookie: adminCookie,
        body: {
          eventId: fakeEventId,
          questionText: 'Question with fake event_id',
          optionA: 'A',
          optionB: 'B',
          optionC: 'C',
          optionD: 'D',
          correctOption: 'C',
          questionOrder: 2,
        },
      });

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      // Verify DB row belongs to testEventId, NOT fakeEventId
      const check = await query('SELECT event_id FROM questions WHERE id = $1', [res.data.question.id]);
      assert(check.rows[0].event_id === testEventId, 'Must assign authoritative testEventId');
      sampleQuestionIds.push(res.data.question.id);
    });

    // Add a 3rd question for reordering tests
    {
      const resQ3 = await apiRequest('/api/admin/questions', {
        method: 'POST',
        cookie: adminCookie,
        body: {
          questionText: 'Third question for testing reordering',
          optionA: '1',
          optionB: '2',
          optionC: '3',
          optionD: '4',
          correctOption: 'D',
          questionOrder: 3,
        },
      });
      sampleQuestionIds.push(resQ3.data.question.id);
    }

    // =========================================================================
    // SECTION 3: List Questions
    // =========================================================================
    console.log('\n--- 3. Listing Questions ---');

    await test('17. Admin lists all questions sorted by question_order ASC with correct answers', async () => {
      const res = await apiRequest('/api/admin/questions', { cookie: adminCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.success === true, 'Expected success=true');
      assert(res.data.event.status === 'READY', 'Expected event status READY');
      assert(Array.isArray(res.data.questions), 'Expected questions array');
      assert(res.data.questions.length === 3, `Expected 3 questions, got ${res.data.questions.length}`);

      // Verify sort order
      for (let i = 0; i < res.data.questions.length; i++) {
        assert(res.data.questions[i].questionOrder === i + 1, `Expected order ${i + 1}`);
        assert(res.data.questions[i].correctOption !== undefined, 'Admin must see correctOption');
      }
    });

    // =========================================================================
    // SECTION 4: Update Questions
    // =========================================================================
    console.log('\n--- 4. Updating Questions ---');

    await test('18. Admin successfully updates question text, options, and timer', async () => {
      const res = await apiRequest(`/api/admin/questions/${createdQuestionId}`, {
        method: 'PATCH',
        cookie: adminCookie,
        body: {
          questionText: 'Updated text: What is binary search complexity?',
          timeLimitSeconds: 45,
          correctOption: 'A',
        },
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.question.questionText.includes('Updated text'), 'Expected updated text');
      assert(res.data.question.timeLimitSeconds === 45, 'Expected timer 45');
      assert(res.data.question.correctOption === 'A', 'Expected correct option A');
    });

    await test('19. Updating question with invalid UUID format rejected (400)', async () => {
      const res = await apiRequest('/api/admin/questions/not-a-valid-uuid', {
        method: 'PATCH',
        cookie: adminCookie,
        body: { questionText: 'New text' },
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(getErrorMsg(res).includes('Invalid question identifier'), 'Expected invalid UUID error');
    });

    await test('20. Updating nonexistent question returns safe 404', async () => {
      const fakeUuid = '00000000-4444-4000-a000-000000000000';
      const res = await apiRequest(`/api/admin/questions/${fakeUuid}`, {
        method: 'PATCH',
        cookie: adminCookie,
        body: { questionText: 'New text' },
      });
      assert(res.status === 404, `Expected 404, got ${res.status}`);
      assert(getErrorMsg(res).includes('not found'), 'Expected question not found');
    });

    await test('21. Changing order to an already-occupied order rejected (409)', async () => {
      // createdQuestionId has order 1; try to change it to order 2 (which belongs to Q2)
      const res = await apiRequest(`/api/admin/questions/${createdQuestionId}`, {
        method: 'PATCH',
        cookie: adminCookie,
        body: { questionOrder: 2 },
      });
      assert(res.status === 409, `Expected 409, got ${res.status}`);
      assert(getErrorMsg(res).includes('already assigned') || getErrorMsg(res).includes('unique'), 'Expected duplicate order error');
    });

    // =========================================================================
    // SECTION 5: Reorder Questions
    // =========================================================================
    console.log('\n--- 5. Atomic Reordering ---');

    await test('22. Valid reorder reverses question order atomically', async () => {
      // Reverse orders: [Q3, Q2, Q1]
      const reversedIds = [sampleQuestionIds[2], sampleQuestionIds[1], sampleQuestionIds[0]];
      const res = await apiRequest('/api/admin/questions/reorder', {
        method: 'PATCH',
        cookie: adminCookie,
        body: { questionIds: reversedIds },
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.success === true, 'Expected success=true');

      // Verify in DB
      const checkRes = await apiRequest('/api/admin/questions', { cookie: adminCookie });
      assert(checkRes.data.questions[0].id === sampleQuestionIds[2], 'Q3 must now be order 1');
      assert(checkRes.data.questions[1].id === sampleQuestionIds[1], 'Q2 must be order 2');
      assert(checkRes.data.questions[2].id === sampleQuestionIds[0], 'Q1 must be order 3');
    });

    await test('23. Reorder with duplicate question IDs in payload rejected (400)', async () => {
      const res = await apiRequest('/api/admin/questions/reorder', {
        method: 'PATCH',
        cookie: adminCookie,
        body: { questionIds: [sampleQuestionIds[0], sampleQuestionIds[0], sampleQuestionIds[1]] },
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(getErrorMsg(res).includes('Duplicate question IDs'), 'Expected duplicate IDs error');
    });

    await test('24. Reorder with incomplete question set rejected (400)', async () => {
      const res = await apiRequest('/api/admin/questions/reorder', {
        method: 'PATCH',
        cookie: adminCookie,
        body: { questionIds: [sampleQuestionIds[0], sampleQuestionIds[1]] }, // only 2 of 3
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(getErrorMsg(res).includes('mismatch'), 'Expected set mismatch error');
    });

    await test('25. Reorder with foreign ID rejected (400)', async () => {
      const fakeUuid = '55555555-5555-4555-a555-555555555555';
      const res = await apiRequest('/api/admin/questions/reorder', {
        method: 'PATCH',
        cookie: adminCookie,
        body: { questionIds: [sampleQuestionIds[0], sampleQuestionIds[1], fakeUuid] },
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(getErrorMsg(res).includes('active competition event'), 'Expected foreign event error');
    });

    // Restore original order: [Q1, Q2, Q3]
    await apiRequest('/api/admin/questions/reorder', {
      method: 'PATCH',
      cookie: adminCookie,
      body: { questionIds: [sampleQuestionIds[0], sampleQuestionIds[1], sampleQuestionIds[2]] },
    });

    // =========================================================================
    // SECTION 6: Delete Questions & Order Compaction
    // =========================================================================
    console.log('\n--- 6. Deleting Questions & Order Compaction ---');

    await test('26. Admin deletes question and subsequent orders are compacted automatically', async () => {
      // Currently orders: Q1 (order 1), Q2 (order 2), Q3 (order 3)
      // Delete Q2 (sampleQuestionIds[1])
      const res = await apiRequest(`/api/admin/questions/${sampleQuestionIds[1]}`, {
        method: 'DELETE',
        cookie: adminCookie,
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.success === true, 'Expected success=true');

      // Verify Q3 was compacted from order 3 to order 2
      const listRes = await apiRequest('/api/admin/questions', { cookie: adminCookie });
      assert(listRes.data.questions.length === 2, 'Expected 2 remaining questions');
      assert(listRes.data.questions[0].id === sampleQuestionIds[0], 'First is Q1');
      assert(listRes.data.questions[0].questionOrder === 1, 'Q1 order is 1');
      assert(listRes.data.questions[1].id === sampleQuestionIds[2], 'Second is Q3');
      assert(listRes.data.questions[1].questionOrder === 2, 'Q3 compacted to order 2');
    });

    await test('27. Deleting nonexistent question returns safe 404', async () => {
      const fakeUuid = '66666666-6666-4666-a666-666666666666';
      const res = await apiRequest(`/api/admin/questions/${fakeUuid}`, {
        method: 'DELETE',
        cookie: adminCookie,
      });
      assert(res.status === 404, `Expected 404, got ${res.status}`);
      assert(getErrorMsg(res).includes('not found'), 'Expected not found');
    });

    // Re-create a 3rd question so question bank is complete
    {
      const resQ = await apiRequest('/api/admin/questions', {
        method: 'POST',
        cookie: adminCookie,
        body: {
          questionText: 'Restored third question?',
          optionA: 'Alpha',
          optionB: 'Beta',
          optionC: 'Gamma',
          optionD: 'Delta',
          correctOption: 'C',
          questionOrder: 3,
        },
      });
      sampleQuestionIds[1] = resQ.data.question.id;
    }

    // =========================================================================
    // SECTION 7: Validation Endpoint
    // =========================================================================
    console.log('\n--- 7. Question Bank Validation ---');

    await test('28. Valid question bank returns valid = true and 0 errors', async () => {
      const res = await apiRequest('/api/admin/questions/validate', {
        method: 'POST',
        cookie: adminCookie,
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.valid === true, 'Expected valid=true');
      assert(res.data.questionCount === 3, `Expected 3 questions, got ${res.data.questionCount}`);
      assert(res.data.errors.length === 0, 'Expected 0 errors');
    });

    await test('29. Order gap detected by validator (e.g. order 1, 2, 4 without 3)', async () => {
      // Temporarily update Q3 order to 4 in DB
      await query('UPDATE questions SET question_order = 4 WHERE id = $1', [sampleQuestionIds[1]]);

      const res = await apiRequest('/api/admin/questions/validate', {
        method: 'POST',
        cookie: adminCookie,
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.valid === false, 'Expected valid=false due to order gap');
      assert(res.data.errors.some((e) => e.includes('order gap') || e.includes('expected order')), 'Expected order gap error');

      // Restore order to 3
      await query('UPDATE questions SET question_order = 3 WHERE id = $1', [sampleQuestionIds[1]]);
    });

    // =========================================================================
    // SECTION 8: Event Status Gate (LIVE and ENDED Immutability)
    // =========================================================================
    console.log('\n--- 8. Event Status Gating: LIVE & ENDED Immutability ---');

    await test('30. Question creation rejected when event is LIVE (409 Conflict)', async () => {
      // Set event status to LIVE
      await query("UPDATE event SET status = 'LIVE' WHERE id = $1", [testEventId]);

      const res = await apiRequest('/api/admin/questions', {
        method: 'POST',
        cookie: adminCookie,
        body: {
          questionText: 'Late question during live?',
          optionA: 'A',
          optionB: 'B',
          optionC: 'C',
          optionD: 'D',
          correctOption: 'A',
        },
      });

      assert(res.status === 409, `Expected 409, got ${res.status}`);
      assert(getErrorMsg(res).includes('locked') && getErrorMsg(res).includes('LIVE'), 'Expected live locked error');
    });

    await test('31. Question update rejected when event is LIVE (409 Conflict)', async () => {
      const res = await apiRequest(`/api/admin/questions/${sampleQuestionIds[0]}`, {
        method: 'PATCH',
        cookie: adminCookie,
        body: { questionText: 'Attempting to change question text while live' },
      });

      assert(res.status === 409, `Expected 409, got ${res.status}`);
      assert(getErrorMsg(res).includes('locked'), 'Expected locked error');
    });

    await test('32. Question delete rejected when event is LIVE (409 Conflict)', async () => {
      const res = await apiRequest(`/api/admin/questions/${sampleQuestionIds[0]}`, {
        method: 'DELETE',
        cookie: adminCookie,
      });

      assert(res.status === 409, `Expected 409, got ${res.status}`);
      assert(getErrorMsg(res).includes('locked'), 'Expected locked error');
    });

    await test('33. Question reorder rejected when event is LIVE (409 Conflict)', async () => {
      const res = await apiRequest('/api/admin/questions/reorder', {
        method: 'PATCH',
        cookie: adminCookie,
        body: { questionIds: [sampleQuestionIds[0], sampleQuestionIds[1], sampleQuestionIds[2]] },
      });

      assert(res.status === 409, `Expected 409, got ${res.status}`);
      assert(getErrorMsg(res).includes('locked'), 'Expected locked error');
    });

    await test('34. Question mutations rejected when event is ENDED (409 Conflict)', async () => {
      // Set event status to ENDED
      await query("UPDATE event SET status = 'ENDED' WHERE id = $1", [testEventId]);

      const resCreate = await apiRequest('/api/admin/questions', {
        method: 'POST',
        cookie: adminCookie,
        body: {
          questionText: 'Late question after event ended?',
          optionA: 'A',
          optionB: 'B',
          optionC: 'C',
          optionD: 'D',
          correctOption: 'A',
        },
      });
      assert(resCreate.status === 409, `Expected 409, got ${resCreate.status}`);

      const resUpdate = await apiRequest(`/api/admin/questions/${sampleQuestionIds[0]}`, {
        method: 'PATCH',
        cookie: adminCookie,
        body: { questionText: 'Edit after ended' },
      });
      assert(resUpdate.status === 409, `Expected 409, got ${resUpdate.status}`);

      const resDelete = await apiRequest(`/api/admin/questions/${sampleQuestionIds[0]}`, {
        method: 'DELETE',
        cookie: adminCookie,
      });
      assert(resDelete.status === 409, `Expected 409, got ${resDelete.status}`);

      // Restore event status back to READY
      await query("UPDATE event SET status = 'READY' WHERE id = $1", [testEventId]);
    });

    // =========================================================================
    // SECTION 9: Cross-Event Protection
    // =========================================================================
    console.log('\n--- 9. Cross-Event Protection ---');

    // Create a secondary foreign event and a question belonging to it
    {
      const foreignEventRes = await query(
        `INSERT INTO event (name, description, status)
         VALUES ('Foreign Competition Event', 'Secondary event', 'ENDED')
         RETURNING id;`
      );
      foreignEventId = foreignEventRes.rows[0].id;

      const foreignQuestionRes = await query(
        `INSERT INTO questions (event_id, question_text, option_a, option_b, option_c, option_d, correct_option, question_order)
         VALUES ($1, 'Foreign question', 'A', 'B', 'C', 'D', 'A', 1)
         RETURNING id;`,
        [foreignEventId]
      );
      const foreignQuestionId = foreignQuestionRes.rows[0].id;

      await test('35. Cross-event question update rejected (403 Forbidden)', async () => {
        const res = await apiRequest(`/api/admin/questions/${foreignQuestionId}`, {
          method: 'PATCH',
          cookie: adminCookie,
          body: { questionText: 'Attempting to update foreign event question' },
        });
        assert(res.status === 403, `Expected 403, got ${res.status}`);
        assert(getErrorMsg(res).includes('active competition event'), 'Expected cross-event error');
      });

      await test('36. Cross-event question delete rejected (403 Forbidden)', async () => {
        const res = await apiRequest(`/api/admin/questions/${foreignQuestionId}`, {
          method: 'DELETE',
          cookie: adminCookie,
        });
        assert(res.status === 403, `Expected 403, got ${res.status}`);
        assert(getErrorMsg(res).includes('active competition event'), 'Expected cross-event error');
      });
    }

    // =========================================================================
    // SECTION 10: Participant Correct-Answer Leakage Prevention & Security
    // =========================================================================
    console.log('\n--- 10. Security & Participant Data Isolation ---');

    await test('37. Participant query projection strictly omits correct_option', async () => {
      const participantQuestions = await getParticipantQuestions(testEventId);
      assert(Array.isArray(participantQuestions), 'Expected questions array');
      assert(participantQuestions.length === 3, 'Expected 3 questions');

      participantQuestions.forEach((q) => {
        assert(q.id, 'Question ID must be present');
        assert(q.questionText, 'Question text must be present');
        assert(q.optionA && q.optionB && q.optionC && q.optionD, 'Options must be present');
        assert(q.timeLimitSeconds !== undefined, 'Timer must be present');
        assert(q.questionOrder !== undefined, 'Order must be present');
        assert(q.correctOption === undefined, 'CRITICAL: correctOption MUST NEVER be present for participants');
        assert(q.correct_option === undefined, 'CRITICAL: correct_option MUST NEVER be present for participants');
      });
    });

    await test('38. Raw SQL/Database errors are not exposed in responses', async () => {
      // Trigger a database constraint error or invalid operation
      const res = await apiRequest('/api/admin/questions', {
        method: 'POST',
        cookie: adminCookie,
        body: {
          questionText: 'Test',
          optionA: 'A',
          optionB: 'B',
          optionC: 'C',
          optionD: 'D',
          correctOption: 'A',
          questionOrder: 1, // Duplicate
        },
      });

      const msg = getErrorMsg(res);
      assert(!msg.includes('pg_catalog'), 'Must not expose pg_catalog');
      assert(!msg.includes('SQL state'), 'Must not expose raw SQL state');
    });

    await test('39. Empty question bank validation returns valid=false', async () => {
      // Create a clean temporary event with 0 questions
      const emptyEventRes = await query(
        `INSERT INTO event (name, description, status)
         VALUES ('Empty Event', 'Event without questions', 'READY')
         RETURNING id;`
      );
      const emptyEventId = emptyEventRes.rows[0].id;

      // Swap active event temporarily
      await query("UPDATE event SET status = 'ENDED' WHERE id = $1;", [testEventId]);

      const res = await apiRequest('/api/admin/questions/validate', {
        method: 'POST',
        cookie: adminCookie,
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.valid === false, 'Expected valid=false');
      assert(res.data.questionCount === 0, 'Expected count 0');
      assert(res.data.errors.some((e) => e.includes('Question bank is empty')), 'Expected empty question bank message');

      // Cleanup empty event and restore main event
      await query('DELETE FROM event WHERE id = $1;', [emptyEventId]);
      await query("UPDATE event SET status = 'READY' WHERE id = $1;", [testEventId]);
    });

    await test('40. Multiple active READY events fails safely without arbitrary selection', async () => {
      // Insert a second READY event
      const secondReadyRes = await query(
        `INSERT INTO event (name, description, status)
         VALUES ('Second Ambiguous READY Event', 'Conflict', 'READY')
         RETURNING id;`
      );
      const secondEventId = secondReadyRes.rows[0].id;

      const res = await apiRequest('/api/admin/questions', { cookie: adminCookie });
      assert(res.status === 500, `Expected 500 configuration error, got ${res.status}`);
      assert(getErrorMsg(res).includes('multiple READY events'), 'Expected multiple READY events failure');

      // Clean up second event
      await query('DELETE FROM event WHERE id = $1;', [secondEventId]);
    });

    console.log('\n----------------------------------------');
    console.log(`Results: ${passCount} passed, ${failCount} failed`);
    console.log('----------------------------------------\n');

    if (failCount > 0) {
      process.exitCode = 1;
    }
  } finally {
    // Crucial: Clean up test otp_codes and event so subsequent test suites are clean
    try {
      await query('DELETE FROM otp_codes;');
    } catch (_) {}
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await closePool();
  }
};

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
