/**
 * Module 5: Admin Registration Management & Payment Verification Test Suite
 *
 * Covers:
 * Authorization:
 *  1. Unauthenticated request rejected (401 Unauthorized)
 *  2. Team Lead (participant) blocked from list (403 Forbidden)
 *  3. Team Lead blocked from detail (403 Forbidden)
 *  4. Team Lead blocked from stats (403 Forbidden)
 *  5. Team Lead blocked from approve (403 Forbidden)
 *  6. Team Lead blocked from reject (403 Forbidden)
 *  7. Team Lead blocked from proof download (403 Forbidden)
 *
 * Listing, Filtering & Pagination:
 *  8. Admin lists registrations with correct lead details and member counts
 *  9. Pagination parameters work (page, limit, total, totalPages)
 * 10. Filter by status=PENDING returns only pending registrations
 * 11. Filter by status=APPROVED returns only approved registrations
 * 12. Filter by status=REJECTED returns only rejected registrations
 * 13. Invalid status filter returns 400 Bad Request
 * 14. Search query filters by team name or college
 *
 * Detail View:
 * 15. Admin views full team detail with all members
 * 16. Detail response never exposes payment_proof_path or raw filesystem paths
 * 17. Nonexistent teamId returns safe 404 (anti-enumeration)
 * 18. Invalid UUID format returns 400 Bad Request
 *
 * Stats:
 * 19. Admin stats return accurate status breakdown (total, pending, approved, rejected)
 *
 * State Machine — Approval:
 * 20. Admin successfully approves PENDING team
 * 21. Approving already-APPROVED team rejected (409 Conflict)
 * 22. Approving REJECTED team rejected (409 Conflict)
 * 23. Approving nonexistent team returns 404
 * 24. Approval blocked when payment ID is missing (400)
 * 25. Approval blocked when payment proof file is missing on disk (400)
 *
 * State Machine — Rejection:
 * 26. Admin successfully rejects PENDING team
 * 27. Rejecting already-REJECTED team rejected (409 Conflict)
 * 28. Rejecting APPROVED team rejected (409 Conflict)
 * 29. Rejecting nonexistent team returns 404
 *
 * Payment Proof Download:
 * 30. Admin downloads payment proof with correct headers and binary content
 * 31. Proof download for nonexistent team returns 404
 * 32. Proof download for team with no proof returns 404
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, closePool } from '../config/database.js';
import { config } from '../config/env.js';
import app from '../app.js';
import { clearTestMailbox, getLastTestEmail } from '../services/email.service.js';
import { paymentProofStorage } from '../services/storage/paymentProofStorage.js';

// Force test environment for in-memory mailbox
config.email.provider = 'test';
config.nodeEnv = 'test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let server;
let baseUrl;

const ADMIN_EMAIL = 'admin@round1.tech';
const LEAD_EMAIL = 'module5_lead@test.com';

let adminCookie;
let leadCookie;
let testEventId;

// Test fixtures
let pendingTeamId;
let approvedTeamId;
let rejectedTeamId;
let teamWithoutProofId;
let teamWithoutPaymentId;
let proofStorageRef;

const VALID_PNG_BUFFER = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('IHDR\0\0\0\x01\0\0\0\x01\x08\x06\0\0\0\x1f\x15c4\0\0\0\nIDATx\x9cc`\0\0\0\x02\0\x01HAF*\0\0\0\0IEND\xaeB`\x82'),
]);

// Helper for API requests
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
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  let data = null;
  let buffer = null;

  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch (_) {}
  } else {
    buffer = Buffer.from(await res.arrayBuffer());
  }

  return {
    status: res.status,
    headers: res.headers,
    data,
    buffer,
  };
};

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
  // Clean up
  await query('DELETE FROM answers;');
  await query('DELETE FROM attempts;');
  await query('DELETE FROM questions;');
  await query('DELETE FROM team_members;');
  await query('DELETE FROM teams;');
  await query('DELETE FROM otp_codes;');
  await query('DELETE FROM event;');

  // 1. Create active READY event
  const eventRes = await query(
    `INSERT INTO event (name, description, status)
     VALUES ('Module 5 Admin Test Event', 'Event for admin tests', 'READY')
     RETURNING id;`
  );
  testEventId = eventRes.rows[0].id;

  // 2. Save a real payment proof file via storage
  proofStorageRef = await paymentProofStorage.saveProof(
    VALID_PNG_BUFFER,
    'receipt.png',
    'image/png'
  );

  // 3. Create a Team Lead user
  const leadUserRes = await query(
    `INSERT INTO users (email, name, phone)
     VALUES ($1, 'Participant Lead', '+919999988888')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id;`,
    [LEAD_EMAIL]
  );
  const leadUserId = leadUserRes.rows[0].id;

  // 4. Create Member users
  const member1Res = await query(
    `INSERT INTO users (email, name, phone)
     VALUES ('m5_member1@test.com', 'Member One', '+919999988881')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id;`
  );
  const member1Id = member1Res.rows[0].id;

  const member2Res = await query(
    `INSERT INTO users (email, name, phone)
     VALUES ('m5_member2@test.com', 'Member Two', '+919999988882')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id;`
  );
  const member2Id = member2Res.rows[0].id;

  // 5. Create PENDING Team with proof and 3 members
  const pendingRes = await query(
    `INSERT INTO teams (event_id, name, college, department, registration_status, payment_id, payment_proof_path)
     VALUES ($1, 'Pending Cyber Hawks', 'National Tech', 'Cyber Security', 'PENDING', 'UPI-PENDING-001', $2)
     RETURNING id;`,
    [testEventId, proofStorageRef]
  );
  pendingTeamId = pendingRes.rows[0].id;

  await query(
    `INSERT INTO team_members (team_id, user_id, event_id, role, register_number)
     VALUES ($1, $2, $3, 'TEAM_LEAD', 'REG-M5-001'),
            ($1, $4, $3, 'MEMBER', 'REG-M5-002'),
            ($1, $5, $3, 'MEMBER', 'REG-M5-003');`,
    [pendingTeamId, leadUserId, testEventId, member1Id, member2Id]
  );

  // 6. Create APPROVED Team for participant auth
  const approvedLeadRes = await query(
    `INSERT INTO users (email, name, phone)
     VALUES ('m5_approved_lead@test.com', 'Approved Lead', '+919999988883')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id;`
  );
  const approvedLeadId = approvedLeadRes.rows[0].id;

  const approvedRes = await query(
    `INSERT INTO teams (event_id, name, college, department, registration_status, payment_id, payment_proof_path)
     VALUES ($1, 'Approved Falcon X', 'City College', 'Information Tech', 'APPROVED', 'UPI-APPROVED-002', $2)
     RETURNING id;`,
    [testEventId, proofStorageRef]
  );
  approvedTeamId = approvedRes.rows[0].id;

  await query(
    `INSERT INTO team_members (team_id, user_id, event_id, role, register_number)
     VALUES ($1, $2, $3, 'TEAM_LEAD', 'REG-M5-004');`,
    [approvedTeamId, approvedLeadId, testEventId]
  );

  // 7. Create REJECTED Team
  const rejectedRes = await query(
    `INSERT INTO teams (event_id, name, college, department, registration_status, payment_id, payment_proof_path)
     VALUES ($1, 'Rejected Void Squad', 'State University', 'ECE', 'REJECTED', 'UPI-REJECTED-003', $2)
     RETURNING id;`,
    [testEventId, proofStorageRef]
  );
  rejectedTeamId = rejectedRes.rows[0].id;

  // 8. Create PENDING Team without payment proof
  const noProofRes = await query(
    `INSERT INTO teams (event_id, name, college, department, registration_status, payment_id, payment_proof_path)
     VALUES ($1, 'No Proof Gladiators', 'Metro Institute', 'Data Science', 'PENDING', 'UPI-NOPROOF-004', NULL)
     RETURNING id;`,
    [testEventId]
  );
  teamWithoutProofId = noProofRes.rows[0].id;

  // 9. Create PENDING Team without payment ID
  const noPayRes = await query(
    `INSERT INTO teams (event_id, name, college, department, registration_status, payment_id, payment_proof_path)
     VALUES ($1, 'No Pay Knights', 'Global College', 'Mechanical', 'PENDING', '', $2)
     RETURNING id;`,
    [testEventId, proofStorageRef]
  );
  teamWithoutPaymentId = noPayRes.rows[0].id;

  // 10. Obtain Admin Cookie
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
  const adminSetCookie = adminVerify.headers.get('set-cookie');
  adminCookie = adminSetCookie.split(';')[0];

  // 11. Obtain Team Lead Cookie (using the approved lead)
  clearTestMailbox();
  await apiRequest('/api/auth/request-otp', {
    method: 'POST',
    body: { email: 'm5_approved_lead@test.com' },
  });
  const leadOtp = getLastTestEmail().otp;
  const leadVerify = await fetch(`${baseUrl}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'm5_approved_lead@test.com', otp: leadOtp }),
  });
  const leadSetCookie = leadVerify.headers.get('set-cookie');
  leadCookie = leadSetCookie.split(';')[0];
};

const getErrorMsg = (res) => res.data?.message || res.data?.error || (res.buffer ? res.buffer.toString('utf-8') : '');

const runTests = async () => {
  console.log('\n=== Module 5: Admin Registration & Payment Verification Test Suite ===\n');

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  try {
    await setupTestDatabase();

    // =========================================================================
    // SECTION 1: Authorization & Access Control
    // =========================================================================
    console.log('--- 1. Authorization & Role Verification ---');

    await test('1. Unauthenticated request to admin endpoints returns 401 Unauthorized', async () => {
      const res = await apiRequest('/api/admin/registrations');
      assert(res.status === 401, `Expected 401, got ${res.status}`);
      assert(getErrorMsg(res).includes('Authentication required'), 'Expected authentication error message');
    });

    await test('2. Team Lead (participant) blocked from list registrations (403 Forbidden)', async () => {
      const res = await apiRequest('/api/admin/registrations', { cookie: leadCookie });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
      assert(getErrorMsg(res).includes('Administrator access required') || getErrorMsg(res).includes('Forbidden'), 'Expected admin required message');
    });

    await test('3. Team Lead blocked from registration detail (403 Forbidden)', async () => {
      const res = await apiRequest(`/api/admin/registrations/${pendingTeamId}`, { cookie: leadCookie });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    await test('4. Team Lead blocked from registration stats (403 Forbidden)', async () => {
      const res = await apiRequest('/api/admin/registrations/stats', { cookie: leadCookie });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    await test('5. Team Lead blocked from approve registration (403 Forbidden)', async () => {
      const res = await apiRequest(`/api/admin/registrations/${pendingTeamId}/approve`, {
        method: 'POST',
        cookie: leadCookie,
      });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    await test('6. Team Lead blocked from reject registration (403 Forbidden)', async () => {
      const res = await apiRequest(`/api/admin/registrations/${pendingTeamId}/reject`, {
        method: 'POST',
        cookie: leadCookie,
      });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    await test('7. Team Lead blocked from proof download (403 Forbidden)', async () => {
      const res = await apiRequest(`/api/admin/registrations/${pendingTeamId}/proof`, { cookie: leadCookie });
      assert(res.status === 403, `Expected 403, got ${res.status}`);
    });

    // =========================================================================
    // SECTION 2: Listing, Filtering, and Pagination
    // =========================================================================
    console.log('\n--- 2. Listing, Filtering & Pagination ---');

    await test('8. Admin lists registrations with team lead details and member counts', async () => {
      const res = await apiRequest('/api/admin/registrations', { cookie: adminCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.success === true, 'Expected success=true');
      assert(Array.isArray(res.data.registrations), 'Expected registrations array');
      assert(res.data.registrations.length >= 5, `Expected >= 5 teams, got ${res.data.registrations.length}`);

      const pendingTeam = res.data.registrations.find((t) => t.id === pendingTeamId);
      assert(pendingTeam, 'Expected pending team in list');
      assert(pendingTeam.teamName === 'Pending Cyber Hawks', 'Expected correct teamName');
      assert(pendingTeam.memberCount === 3, `Expected 3 members, got ${pendingTeam.memberCount}`);
      assert(pendingTeam.leadName === 'Participant Lead', 'Expected correct leadName');
      assert(pendingTeam.leadEmail === LEAD_EMAIL, 'Expected correct leadEmail');
      assert(pendingTeam.paymentId === 'UPI-PENDING-001', 'Expected correct paymentId');
      assert(pendingTeam.registrationStatus === 'PENDING', 'Expected status PENDING');
    });

    await test('9. Pagination parameters work correctly (page, limit, total, totalPages)', async () => {
      const res = await apiRequest('/api/admin/registrations?page=1&limit=2', { cookie: adminCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.registrations.length === 2, `Expected 2 items, got ${res.data.registrations.length}`);
      assert(res.data.pagination.page === 1, 'Expected page 1');
      assert(res.data.pagination.limit === 2, 'Expected limit 2');
      assert(res.data.pagination.total >= 5, `Expected total >= 5, got ${res.data.pagination.total}`);
      assert(res.data.pagination.totalPages >= 3, 'Expected totalPages >= 3');
    });

    await test('10. Filter by status=PENDING returns only pending registrations', async () => {
      const res = await apiRequest('/api/admin/registrations?status=PENDING', { cookie: adminCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.registrations.length > 0, 'Expected at least one pending team');
      for (const reg of res.data.registrations) {
        assert(reg.registrationStatus === 'PENDING', `Expected all PENDING, got ${reg.registrationStatus}`);
      }
    });

    await test('11. Filter by status=APPROVED returns only approved registrations', async () => {
      const res = await apiRequest('/api/admin/registrations?status=APPROVED', { cookie: adminCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.registrations.length > 0, 'Expected at least one approved team');
      for (const reg of res.data.registrations) {
        assert(reg.registrationStatus === 'APPROVED', `Expected all APPROVED, got ${reg.registrationStatus}`);
      }
    });

    await test('12. Filter by status=REJECTED returns only rejected registrations', async () => {
      const res = await apiRequest('/api/admin/registrations?status=REJECTED', { cookie: adminCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.registrations.length > 0, 'Expected at least one rejected team');
      for (const reg of res.data.registrations) {
        assert(reg.registrationStatus === 'REJECTED', `Expected all REJECTED, got ${reg.registrationStatus}`);
      }
    });

    await test('13. Invalid status filter returns 400 Bad Request', async () => {
      const res = await apiRequest('/api/admin/registrations?status=INVALID_STATUS', { cookie: adminCookie });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(getErrorMsg(res).includes('Invalid status filter'), 'Expected status filter error');
    });

    await test('14. Search query filters registrations by team name or college', async () => {
      const res = await apiRequest('/api/admin/registrations?search=Cyber Hawks', { cookie: adminCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.registrations.length === 1, `Expected 1 match, got ${res.data.registrations.length}`);
      assert(res.data.registrations[0].teamName === 'Pending Cyber Hawks', 'Expected correct team matched');

      // Search by college
      const resCollege = await apiRequest('/api/admin/registrations?search=National Tech', { cookie: adminCookie });
      assert(resCollege.status === 200, `Expected 200, got ${resCollege.status}`);
      assert(resCollege.data.registrations.some((t) => t.college === 'National Tech'), 'Expected college match');
    });

    // =========================================================================
    // SECTION 3: Detail View & Anti-Enumeration
    // =========================================================================
    console.log('\n--- 3. Registration Detail & Security ---');

    await test('15. Admin views full team detail with all members', async () => {
      const res = await apiRequest(`/api/admin/registrations/${pendingTeamId}`, { cookie: adminCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.success === true, 'Expected success=true');

      const detail = res.data.registration;
      assert(detail.id === pendingTeamId, 'Expected correct team ID');
      assert(detail.teamName === 'Pending Cyber Hawks', 'Expected correct teamName');
      assert(detail.paymentId === 'UPI-PENDING-001', 'Expected correct paymentId');
      assert(detail.hasPaymentProof === true, 'Expected hasPaymentProof=true');
      assert(Array.isArray(detail.members), 'Expected members array');
      assert(detail.members.length === 3, `Expected 3 members, got ${detail.members.length}`);

      const lead = detail.members.find((m) => m.role === 'TEAM_LEAD');
      assert(lead, 'Expected TEAM_LEAD in members');
      assert(lead.email === LEAD_EMAIL, 'Expected correct lead email');
      assert(lead.registerNumber === 'REG-M5-001', 'Expected register number');
    });

    await test('16. Detail response never exposes payment_proof_path or raw filesystem paths', async () => {
      const res = await apiRequest(`/api/admin/registrations/${pendingTeamId}`, { cookie: adminCookie });
      const rawJson = JSON.stringify(res.data);
      assert(!rawJson.includes('payment_proof_path'), 'Must NOT expose payment_proof_path');
      assert(!rawJson.includes('uploads/payment-proofs'), 'Must NOT expose storage path');
      assert(!rawJson.includes('uploads\\payment-proofs'), 'Must NOT expose storage path');
    });

    await test('17. Nonexistent teamId returns safe 404 (anti-enumeration)', async () => {
      const fakeUuid = '00000000-0000-4000-a000-000000000000';
      const res = await apiRequest(`/api/admin/registrations/${fakeUuid}`, { cookie: adminCookie });
      assert(res.status === 404, `Expected 404, got ${res.status}`);
      assert(getErrorMsg(res).includes('not found'), 'Expected generic not found message');
    });

    await test('18. Invalid UUID format returns 400 Bad Request', async () => {
      const res = await apiRequest('/api/admin/registrations/not-a-valid-uuid', { cookie: adminCookie });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(getErrorMsg(res).includes('Invalid registration identifier'), 'Expected invalid UUID message');
    });

    // =========================================================================
    // SECTION 4: Registration Stats
    // =========================================================================
    console.log('\n--- 4. Registration Statistics ---');

    await test('19. Admin stats return accurate status breakdown (total, pending, approved, rejected)', async () => {
      const res = await apiRequest('/api/admin/registrations/stats', { cookie: adminCookie });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.success === true, 'Expected success=true');

      const stats = res.data.stats;
      assert(typeof stats.total === 'number', 'Expected total count number');
      assert(typeof stats.pending === 'number', 'Expected pending count number');
      assert(typeof stats.approved === 'number', 'Expected approved count number');
      assert(typeof stats.rejected === 'number', 'Expected rejected count number');
      assert(stats.total === stats.pending + stats.approved + stats.rejected, 'Total must equal sum of status counts');
      assert(stats.pending >= 3, `Expected at least 3 pending, got ${stats.pending}`);
      assert(stats.approved >= 1, `Expected at least 1 approved, got ${stats.approved}`);
      assert(stats.rejected >= 1, `Expected at least 1 rejected, got ${stats.rejected}`);
    });

    // =========================================================================
    // SECTION 5: State Machine — Approval
    // =========================================================================
    console.log('\n--- 5. State Machine: Approval Transitions ---');

    await test('20. Admin successfully approves PENDING team', async () => {
      const res = await apiRequest(`/api/admin/registrations/${pendingTeamId}/approve`, {
        method: 'POST',
        cookie: adminCookie,
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.success === true, 'Expected success=true');
      assert(res.data.registrationStatus === 'APPROVED', 'Expected status APPROVED');

      // Verify in DB directly
      const dbCheck = await query('SELECT registration_status FROM teams WHERE id = $1', [pendingTeamId]);
      assert(dbCheck.rows[0].registration_status === 'APPROVED', 'Expected DB status APPROVED');
    });

    await test('21. Approving already-APPROVED team rejected (409 Conflict)', async () => {
      const res = await apiRequest(`/api/admin/registrations/${pendingTeamId}/approve`, {
        method: 'POST',
        cookie: adminCookie,
      });
      assert(res.status === 409, `Expected 409, got ${res.status}`);
      assert(getErrorMsg(res).includes('already APPROVED'), `Expected already APPROVED error, got: ${getErrorMsg(res)}`);
    });

    await test('22. Approving REJECTED team rejected (409 Conflict)', async () => {
      const res = await apiRequest(`/api/admin/registrations/${rejectedTeamId}/approve`, {
        method: 'POST',
        cookie: adminCookie,
      });
      assert(res.status === 409, `Expected 409, got ${res.status}`);
      assert(getErrorMsg(res).includes('already REJECTED'), `Expected already REJECTED error, got: ${getErrorMsg(res)}`);
    });

    await test('23. Approving nonexistent team returns 404', async () => {
      const fakeUuid = '11111111-1111-4111-a111-111111111111';
      const res = await apiRequest(`/api/admin/registrations/${fakeUuid}/approve`, {
        method: 'POST',
        cookie: adminCookie,
      });
      assert(res.status === 404, `Expected 404, got ${res.status}`);
      assert(getErrorMsg(res).includes('not found'), 'Expected generic 404');
    });

    await test('24. Approval blocked when payment ID is missing (400 Bad Request)', async () => {
      const res = await apiRequest(`/api/admin/registrations/${teamWithoutPaymentId}/approve`, {
        method: 'POST',
        cookie: adminCookie,
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(getErrorMsg(res).includes('no payment ID on record'), `Expected payment ID error, got: ${getErrorMsg(res)}`);
    });

    await test('25. Approval blocked when payment proof file is missing on disk (400 Bad Request)', async () => {
      const res = await apiRequest(`/api/admin/registrations/${teamWithoutProofId}/approve`, {
        method: 'POST',
        cookie: adminCookie,
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(getErrorMsg(res).includes('payment proof file is missing'), `Expected proof file missing error, got: ${getErrorMsg(res)}`);
    });

    // =========================================================================
    // SECTION 6: State Machine — Rejection
    // =========================================================================
    console.log('\n--- 6. State Machine: Rejection Transitions ---');

    // Create a new PENDING team specifically for rejection test
    let teamToRejectId;
    {
      const newPendingRes = await query(
        `INSERT INTO teams (event_id, name, college, department, registration_status, payment_id, payment_proof_path)
         VALUES ($1, 'Team Destined For Rejection', 'Demo College', 'IT', 'PENDING', 'UPI-REJECT-TEST', $2)
         RETURNING id;`,
        [testEventId, proofStorageRef]
      );
      teamToRejectId = newPendingRes.rows[0].id;
    }

    await test('26. Admin successfully rejects PENDING team', async () => {
      const res = await apiRequest(`/api/admin/registrations/${teamToRejectId}/reject`, {
        method: 'POST',
        cookie: adminCookie,
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.success === true, 'Expected success=true');
      assert(res.data.registrationStatus === 'REJECTED', 'Expected status REJECTED');

      // Verify in DB directly
      const dbCheck = await query('SELECT registration_status FROM teams WHERE id = $1', [teamToRejectId]);
      assert(dbCheck.rows[0].registration_status === 'REJECTED', 'Expected DB status REJECTED');
    });

    await test('27. Rejecting already-REJECTED team rejected (409 Conflict)', async () => {
      const res = await apiRequest(`/api/admin/registrations/${teamToRejectId}/reject`, {
        method: 'POST',
        cookie: adminCookie,
      });
      assert(res.status === 409, `Expected 409, got ${res.status}`);
      assert(getErrorMsg(res).includes('already REJECTED'), `Expected already REJECTED error, got: ${getErrorMsg(res)}`);
    });

    await test('28. Rejecting APPROVED team rejected (409 Conflict)', async () => {
      const res = await apiRequest(`/api/admin/registrations/${approvedTeamId}/reject`, {
        method: 'POST',
        cookie: adminCookie,
      });
      assert(res.status === 409, `Expected 409, got ${res.status}`);
      assert(getErrorMsg(res).includes('already APPROVED'), `Expected already APPROVED error, got: ${getErrorMsg(res)}`);
    });

    await test('29. Rejecting nonexistent team returns 404', async () => {
      const fakeUuid = '22222222-2222-4222-a222-222222222222';
      const res = await apiRequest(`/api/admin/registrations/${fakeUuid}/reject`, {
        method: 'POST',
        cookie: adminCookie,
      });
      assert(res.status === 404, `Expected 404, got ${res.status}`);
      assert(getErrorMsg(res).includes('not found'), 'Expected generic 404');
    });

    // =========================================================================
    // SECTION 7: Payment Proof Download
    // =========================================================================
    console.log('\n--- 7. Secure Payment Proof Download ---');

    await test('30. Admin downloads payment proof with correct headers and binary content', async () => {
      const res = await apiRequest(`/api/admin/registrations/${approvedTeamId}/proof`, {
        cookie: adminCookie,
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.headers.get('content-type') === 'image/png', `Expected image/png, got ${res.headers.get('content-type')}`);
      assert(res.headers.get('content-disposition').includes('attachment; filename="proof-'), 'Expected attachment header');
      assert(res.buffer && res.buffer.length === VALID_PNG_BUFFER.length, 'Expected downloaded buffer to match uploaded file');
    });

    await test('31. Proof download for nonexistent team returns 404', async () => {
      const fakeUuid = '33333333-3333-4333-a333-333333333333';
      const res = await apiRequest(`/api/admin/registrations/${fakeUuid}/proof`, {
        cookie: adminCookie,
      });
      assert(res.status === 404, `Expected 404, got ${res.status}`);
      assert(getErrorMsg(res).includes('not found'), 'Expected generic 404');
    });

    await test('32. Proof download for team with no proof uploaded returns 404', async () => {
      const res = await apiRequest(`/api/admin/registrations/${teamWithoutProofId}/proof`, {
        cookie: adminCookie,
      });
      assert(res.status === 404, `Expected 404, got ${res.status}`);
      assert(getErrorMsg(res).includes('No payment proof uploaded'), 'Expected no payment proof uploaded error');
    });

    console.log('\n----------------------------------------');
    console.log(`Results: ${passCount} passed, ${failCount} failed`);
    console.log('----------------------------------------\n');

    if (failCount > 0) {
      process.exitCode = 1;
    }
  } finally {
    // Cleanup generated proof file and test otp records
    if (proofStorageRef) {
      await paymentProofStorage.deleteProof(proofStorageRef);
    }
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
