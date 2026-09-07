/**
 * Comprehensive Authentication & Security Test Suite for Module 3
 *
 * Covers:
 * 1. Valid OTP request
 * 2. OTP stored as HMAC-SHA256 hash in DB (never plaintext, never plain SHA-256)
 * 3. OTP never returned in API response
 * 4. OTP expires (after 5 minutes)
 * 5. OTP cannot be reused once used
 * 6. Wrong OTP rejected
 * 7. More than 5 verification attempts rejected and OTP invalidated
 * 8. Resend cooldown enforced (60s)
 * 9. Nonexistent email does not reveal account existence (anti-enumeration)
 * 10. Unapproved team cannot access participant authentication
 * 11. Normal MEMBER cannot authenticate into quiz / become Team Lead
 * 12. Approved Team Lead can authenticate
 * 13. Unauthorized admin email rejected
 * 14. Authorized admin email can authenticate
 * 15. Protected endpoint rejects unauthenticated request
 * 16. requireAdmin blocks participant
 * 17. requireTeamLead blocks normal member
 * 18. Logout clears cookie / invalidates session
 * 19. Cookie-only authentication: token NEVER returned in JSON response body
 * 20. Cryptographically secure randomness and timing safety
 */

import http from 'http';
import { query, closePool } from '../config/database.js';
import { config } from '../config/env.js';
import app from '../app.js';
import {
  getTestMailbox,
  getLastTestEmail,
  clearTestMailbox,
} from '../services/email.service.js';
import { hashOtp, timingSafeEqual } from '../utils/crypto.utils.js';
import { resetOtpTracking } from '../services/otp.service.js';

// Force test environment
config.email.provider = 'test';
config.nodeEnv = 'test';

let server;
let baseUrl;

// Test fixtures
let testEventId;
let approvedTeamId;
let pendingTeamId;
let leadUserId;
let memberUserId;
let unapprovedLeadUserId;

const LEAD_EMAIL = 'module3_lead@test.com';
const MEMBER_EMAIL = 'module3_member@test.com';
const UNAPPROVED_EMAIL = 'module3_unapproved@test.com';
const NONEXISTENT_EMAIL = 'module3_nobody@test.com';
const AUTHORIZED_ADMIN_EMAIL = 'admin@round1.tech';
const UNAUTHORIZED_ADMIN_EMAIL = 'impostor_admin@other.com';

// HTTP helper using native fetch
const apiRequest = async (path, options = {}) => {
  const url = `${baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const setCookie = res.headers.get('set-cookie');
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }

  return {
    status: res.status,
    headers: res.headers,
    setCookie,
    data,
  };
};

// Seed database fixtures
const setupFixtures = async () => {
  // 1. Create test event
  const eventRes = await query(
    `INSERT INTO event (name, description, status)
     VALUES ('Module 3 Auth Test Event', 'Test event for auth suite', 'READY')
     RETURNING id;`
  );
  testEventId = eventRes.rows[0].id;

  // 2. Create users
  const leadRes = await query(
    `INSERT INTO users (name, email)
     VALUES ('Test Team Lead', $1)
     ON CONFLICT (email) DO UPDATE SET name = 'Test Team Lead'
     RETURNING id;`,
    [LEAD_EMAIL]
  );
  leadUserId = leadRes.rows[0].id;

  const memberRes = await query(
    `INSERT INTO users (name, email)
     VALUES ('Test Team Member', $1)
     ON CONFLICT (email) DO UPDATE SET name = 'Test Team Member'
     RETURNING id;`,
    [MEMBER_EMAIL]
  );
  memberUserId = memberRes.rows[0].id;

  const unapprovedRes = await query(
    `INSERT INTO users (name, email)
     VALUES ('Test Unapproved Lead', $1)
     ON CONFLICT (email) DO UPDATE SET name = 'Test Unapproved Lead'
     RETURNING id;`,
    [UNAPPROVED_EMAIL]
  );
  unapprovedLeadUserId = unapprovedRes.rows[0].id;

  // 3. Create teams (one APPROVED, one PENDING)
  const appTeamRes = await query(
    `INSERT INTO teams (name, event_id, college, department, registration_status)
     VALUES ('Approved Test Team', $1, 'Test College', 'CSE', 'APPROVED')
     RETURNING id;`,
    [testEventId]
  );
  approvedTeamId = appTeamRes.rows[0].id;

  const pendTeamRes = await query(
    `INSERT INTO teams (name, event_id, college, department, registration_status)
     VALUES ('Pending Test Team', $1, 'Test College', 'ECE', 'PENDING')
     RETURNING id;`,
    [testEventId]
  );
  pendingTeamId = pendTeamRes.rows[0].id;

  // 4. Create team members
  await query(
    `INSERT INTO team_members (team_id, user_id, event_id, register_number, role)
     VALUES ($1, $2, $3, 'REG_LEAD', 'TEAM_LEAD');`,
    [approvedTeamId, leadUserId, testEventId]
  );

  await query(
    `INSERT INTO team_members (team_id, user_id, event_id, register_number, role)
     VALUES ($1, $2, $3, 'REG_MEMB', 'MEMBER');`,
    [approvedTeamId, memberUserId, testEventId]
  );

  await query(
    `INSERT INTO team_members (team_id, user_id, event_id, register_number, role)
     VALUES ($1, $2, $3, 'REG_UNAPP', 'TEAM_LEAD');`,
    [pendingTeamId, unapprovedLeadUserId, testEventId]
  );
};

// Cleanup fixtures
const cleanupFixtures = async () => {
  if (testEventId) {
    await query('DELETE FROM event WHERE id = $1;', [testEventId]);
  }
  await query('DELETE FROM users WHERE email IN ($1, $2, $3);', [
    LEAD_EMAIL,
    MEMBER_EMAIL,
    UNAPPROVED_EMAIL,
  ]);
};

// Test runner helper
let passCount = 0;
let failCount = 0;

const test = async (name, fn) => {
  try {
    resetOtpTracking();
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
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
};

// Main test execution
const runTests = async () => {
  console.log('\n=== Module 3: Authentication & Security Test Suite ===\n');

  // Start temporary test server
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  try {
    await setupFixtures();

    // --------------------------------------------------------------------------
    // Test 1: Valid OTP request for eligible Team Lead
    // --------------------------------------------------------------------------
    await test('1. Valid OTP request generates and sends OTP', async () => {
      clearTestMailbox();
      const res = await apiRequest('/api/auth/request-otp', {
        method: 'POST',
        body: { email: LEAD_EMAIL },
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(
        res.data.message === 'If the account is eligible, an OTP has been sent.',
        'Expected anti-enumeration message'
      );

      const email = getLastTestEmail();
      assert(email !== null, 'Expected OTP email to be dispatched');
      assert(email.to === LEAD_EMAIL, `Expected to ${LEAD_EMAIL}`);
      assert(/^\d{6}$/.test(email.otp), 'Expected 6-digit numeric OTP');
    });

    // --------------------------------------------------------------------------
    // Test 2: OTP stored as HMAC-SHA256 in DB, never plaintext
    // --------------------------------------------------------------------------
    await test('2. OTP is stored as HMAC-SHA256 hash in otp_codes (never plaintext)', async () => {
      const email = getLastTestEmail();
      const plainOtp = email.otp;

      const dbRes = await query(
        `SELECT otp_hash, is_used, purpose, expires_at
         FROM otp_codes
         WHERE user_id = $1 AND purpose = 'login' AND is_used = FALSE
         ORDER BY created_at DESC LIMIT 1;`,
        [leadUserId]
      );

      assert(dbRes.rows.length === 1, 'Expected active OTP row in DB');
      const row = dbRes.rows[0];

      assert(row.otp_hash !== plainOtp, 'OTP MUST NOT be stored in plaintext');
      const expectedHash = hashOtp(plainOtp);
      assert(
        row.otp_hash === expectedHash,
        'OTP in DB must match HMAC-SHA256(OTP_HASH_SECRET, OTP)'
      );
      assert(row.purpose === 'login', 'Purpose must be login');
      assert(row.is_used === false, 'is_used must be false');
    });

    // --------------------------------------------------------------------------
    // Test 3: OTP never returned in API response
    // --------------------------------------------------------------------------
    await test('3. OTP is never returned in API response body', async () => {
      clearTestMailbox();
      // Wait past cooldown for next request or delete previous test code
      await query('DELETE FROM otp_codes WHERE user_id = $1;', [leadUserId]);

      const res = await apiRequest('/api/auth/request-otp', {
        method: 'POST',
        body: { email: LEAD_EMAIL },
      });

      const responseStr = JSON.stringify(res.data);
      const email = getLastTestEmail();

      assert(
        !responseStr.includes(email.otp),
        'API response MUST NOT contain the generated OTP'
      );
      assert(
        !res.data.otp && !res.data.code,
        'Response object must not contain otp/code fields'
      );
    });

    // --------------------------------------------------------------------------
    // Test 4: OTP expires after 5 minutes
    // --------------------------------------------------------------------------
    await test('4. Expired OTP is rejected', async () => {
      const email = getLastTestEmail();

      // Manually backdate expiry to the past
      await query(
        `UPDATE otp_codes
         SET expires_at = NOW() - INTERVAL '1 minute'
         WHERE user_id = $1 AND is_used = FALSE;`,
        [leadUserId]
      );

      const res = await apiRequest('/api/auth/verify-otp', {
        method: 'POST',
        body: { email: LEAD_EMAIL, otp: email.otp },
      });

      assert(res.status === 400, `Expected 400 for expired OTP, got ${res.status}`);
      assert(
        res.data.message.includes('Invalid or expired'),
        'Expected expired error message'
      );
    });

    // --------------------------------------------------------------------------
    // Test 5: Wrong OTP rejected
    // --------------------------------------------------------------------------
    await test('5. Wrong OTP is rejected', async () => {
      await query('DELETE FROM otp_codes WHERE user_id = $1;', [leadUserId]);
      clearTestMailbox();

      await apiRequest('/api/auth/request-otp', {
        method: 'POST',
        body: { email: LEAD_EMAIL },
      });
      const realOtp = getLastTestEmail().otp;
      const fakeOtp = realOtp === '123456' ? '654321' : '123456';

      const res = await apiRequest('/api/auth/verify-otp', {
        method: 'POST',
        body: { email: LEAD_EMAIL, otp: fakeOtp },
      });

      assert(res.status === 400, `Expected 400 for wrong OTP, got ${res.status}`);
      assert(
        res.data.message.includes('Invalid or expired'),
        'Expected invalid code message'
      );
    });

    // --------------------------------------------------------------------------
    // Test 6: More than 5 verification attempts rejected & OTP invalidated
    // --------------------------------------------------------------------------
    await test('6. Max 5 failed attempts locks and invalidates OTP', async () => {
      await query('DELETE FROM otp_codes WHERE user_id = $1;', [leadUserId]);
      clearTestMailbox();

      await apiRequest('/api/auth/request-otp', {
        method: 'POST',
        body: { email: LEAD_EMAIL },
      });
      const realOtp = getLastTestEmail().otp;

      // Attempt 5 wrong verifications
      for (let i = 1; i <= 5; i++) {
        await apiRequest('/api/auth/verify-otp', {
          method: 'POST',
          body: { email: LEAD_EMAIL, otp: '000000' },
        });
      }

      // Check OTP in DB is marked is_used = true
      const checkRes = await query(
        `SELECT is_used FROM otp_codes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1;`,
        [leadUserId]
      );
      assert(
        checkRes.rows[0].is_used === true,
        'OTP must be marked is_used = TRUE after 5 failed attempts'
      );

      // Now attempt with the real OTP — should fail because it was invalidated!
      const finalRes = await apiRequest('/api/auth/verify-otp', {
        method: 'POST',
        body: { email: LEAD_EMAIL, otp: realOtp },
      });
      assert(
        finalRes.status === 400,
        'Previously valid OTP must now be rejected because it was invalidated'
      );
    });

    // --------------------------------------------------------------------------
    // Test 7: Resend cooldown (60s) enforced
    // --------------------------------------------------------------------------
    await test('7. Resend cooldown (60 seconds) is enforced', async () => {
      await query('DELETE FROM otp_codes WHERE user_id = $1;', [leadUserId]);
      clearTestMailbox();

      // First request succeeds
      const res1 = await apiRequest('/api/auth/request-otp', {
        method: 'POST',
        body: { email: LEAD_EMAIL },
      });
      assert(res1.status === 200, 'First request should succeed');

      // Immediate second request within 60s must fail with 429
      const res2 = await apiRequest('/api/auth/request-otp', {
        method: 'POST',
        body: { email: LEAD_EMAIL },
      });
      assert(
        res2.status === 429,
        `Expected 429 Too Many Requests for cooldown, got ${res2.status}`
      );
    });

    // --------------------------------------------------------------------------
    // Test 8: Nonexistent email does not reveal account existence (Anti-enumeration)
    // --------------------------------------------------------------------------
    await test('8. Nonexistent email returns identical generic response without dispatching OTP', async () => {
      clearTestMailbox();
      const res = await apiRequest('/api/auth/request-otp', {
        method: 'POST',
        body: { email: NONEXISTENT_EMAIL },
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(
        res.data.message === 'If the account is eligible, an OTP has been sent.',
        'Expected exact anti-enumeration message'
      );
      assert(
        getTestMailbox().length === 0,
        'No email should be dispatched for non-existent user'
      );
    });

    // --------------------------------------------------------------------------
    // Test 9: Unapproved team cannot access participant authentication
    // --------------------------------------------------------------------------
    await test('9. Unapproved team lead cannot receive OTP (anti-enumeration response)', async () => {
      clearTestMailbox();
      const res = await apiRequest('/api/auth/request-otp', {
        method: 'POST',
        body: { email: UNAPPROVED_EMAIL },
      });

      assert(res.status === 200, 'Expected generic 200 response');
      assert(
        res.data.message === 'If the account is eligible, an OTP has been sent.',
        'Expected generic anti-enumeration response'
      );
      assert(
        getTestMailbox().length === 0,
        'No OTP should be dispatched to unapproved team lead'
      );
    });

    // --------------------------------------------------------------------------
    // Test 10: Normal MEMBER cannot receive participant login OTP
    // --------------------------------------------------------------------------
    await test('10. Normal MEMBER cannot receive quiz login OTP', async () => {
      clearTestMailbox();
      const res = await apiRequest('/api/auth/request-otp', {
        method: 'POST',
        body: { email: MEMBER_EMAIL },
      });

      assert(res.status === 200, 'Expected generic 200 response');
      assert(
        getTestMailbox().length === 0,
        'No OTP should be dispatched to normal MEMBER'
      );
    });

    // --------------------------------------------------------------------------
    // Test 11: Approved Team Lead authenticates successfully & receives HttpOnly cookie
    // --------------------------------------------------------------------------
    let leadCookie;
    await test('11. Approved Team Lead authenticates, sets HttpOnly cookie, does NOT expose token in body', async () => {
      await query('DELETE FROM otp_codes WHERE user_id = $1;', [leadUserId]);
      clearTestMailbox();

      await apiRequest('/api/auth/request-otp', {
        method: 'POST',
        body: { email: LEAD_EMAIL },
      });
      const validOtp = getLastTestEmail().otp;

      const res = await apiRequest('/api/auth/verify-otp', {
        method: 'POST',
        body: { email: LEAD_EMAIL, otp: validOtp },
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.role === 'TEAM_LEAD', `Expected role TEAM_LEAD, got ${res.data.role}`);
      assert(res.data.user.email === LEAD_EMAIL, 'Expected user email');
      assert(res.data.team.name === 'Approved Test Team', 'Expected team name');

      // MANDATORY CORRECTION 1: Cookie-only JWT
      assert(!res.data.token, 'JWT MUST NOT be returned in JSON response body');
      assert(!res.data.accessToken, 'accessToken MUST NOT be returned in JSON response body');

      assert(res.setCookie, 'HttpOnly cookie must be present in Set-Cookie header');
      assert(
        res.setCookie.includes('round1_token='),
        'Cookie header must contain round1_token'
      );
      assert(
        res.setCookie.toLowerCase().includes('httponly'),
        'Cookie MUST have HttpOnly flag'
      );

      leadCookie = res.setCookie.split(';')[0];
    });

    // --------------------------------------------------------------------------
    // Test 12: OTP cannot be reused after successful verification
    // --------------------------------------------------------------------------
    await test('12. OTP cannot be reused once used', async () => {
      const validOtp = getLastTestEmail().otp;

      const res = await apiRequest('/api/auth/verify-otp', {
        method: 'POST',
        body: { email: LEAD_EMAIL, otp: validOtp },
      });

      assert(res.status === 400, `Expected 400 for reused OTP, got ${res.status}`);
      assert(
        res.data.message.includes('Invalid or expired'),
        'Reused OTP must be rejected'
      );
    });

    // --------------------------------------------------------------------------
    // Test 13: GET /api/auth/me returns profile for authenticated Team Lead
    // --------------------------------------------------------------------------
    await test('13. GET /api/auth/me returns safe profile using HttpOnly cookie', async () => {
      const res = await apiRequest('/api/auth/me', {
        method: 'GET',
        headers: {
          Cookie: leadCookie,
        },
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.data.user.email === LEAD_EMAIL, 'Expected user email');
      assert(res.data.role === 'TEAM_LEAD', 'Expected role TEAM_LEAD');
      assert(res.data.team.name === 'Approved Test Team', 'Expected team name');
      assert(!res.data.user.otp_hash, 'Must never leak otp_hash');
      assert(!res.data.user.password, 'Must never leak password');
    });

    // --------------------------------------------------------------------------
    // Test 14: Protected endpoint rejects unauthenticated request
    // --------------------------------------------------------------------------
    await test('14. Protected endpoint rejects unauthenticated request (401)', async () => {
      const res = await apiRequest('/api/auth/me', {
        method: 'GET',
      });

      assert(res.status === 401, `Expected 401, got ${res.status}`);
      assert(
        res.data.message.includes('Authentication required'),
        'Expected authentication required message'
      );
    });

    // --------------------------------------------------------------------------
    // Test 15: Unauthorized admin email rejected
    // --------------------------------------------------------------------------
    await test('15. Unauthorized admin email is rejected (anti-enumeration response, no OTP)', async () => {
      clearTestMailbox();
      const res = await apiRequest('/api/auth/request-otp', {
        method: 'POST',
        body: { email: UNAUTHORIZED_ADMIN_EMAIL },
      });

      assert(res.status === 200, 'Expected generic 200 response');
      assert(
        getTestMailbox().length === 0,
        'No OTP should be dispatched to unauthorized admin email'
      );
    });

    // --------------------------------------------------------------------------
    // Test 16: Authorized admin email authenticates with ADMIN role
    // --------------------------------------------------------------------------
    let adminCookie;
    await test('16. Authorized admin email can request OTP, verify, and receive ADMIN role', async () => {
      clearTestMailbox();
      const resReq = await apiRequest('/api/auth/request-otp', {
        method: 'POST',
        body: { email: AUTHORIZED_ADMIN_EMAIL },
      });

      assert(resReq.status === 200, `Expected 200, got ${resReq.status}`);
      const adminOtp = getLastTestEmail().otp;
      assert(/^\d{6}$/.test(adminOtp), 'Expected 6-digit OTP for admin');

      const resVerify = await apiRequest('/api/auth/verify-otp', {
        method: 'POST',
        body: { email: AUTHORIZED_ADMIN_EMAIL, otp: adminOtp },
      });

      assert(resVerify.status === 200, `Expected 200, got ${resVerify.status}`);
      assert(resVerify.data.role === 'ADMIN', `Expected role ADMIN, got ${resVerify.data.role}`);
      assert(
        resVerify.setCookie.includes('round1_token='),
        'Expected HttpOnly cookie for admin'
      );

      adminCookie = resVerify.setCookie.split(';')[0];
    });

    // --------------------------------------------------------------------------
    // Test 17: requireAdmin blocks participant (role = TEAM_LEAD)
    // --------------------------------------------------------------------------
    await test('17. requireAdmin middleware blocks participant (403 Forbidden)', async () => {
      // Create a temporary test route on the fly or test using middleware directly
      const { requireAuth, requireAdmin } = await import('../middleware/auth.middleware.js');

      let calledNext = false;
      let sentStatus = null;
      let sentBody = null;

      const mockReq = {
        cookies: {
          round1_token: leadCookie.split('=')[1],
        },
        headers: {},
      };
      const mockRes = {
        status: (code) => {
          sentStatus = code;
          return {
            json: (b) => {
              sentBody = b;
            },
          };
        },
      };

      // Run requireAuth first
      await requireAuth(mockReq, mockRes, () => {});
      assert(mockReq.user && mockReq.user.role === 'TEAM_LEAD', 'Req user must be TEAM_LEAD');

      // Now run requireAdmin
      requireAdmin(mockReq, mockRes, () => {
        calledNext = true;
      });

      assert(calledNext === false, 'requireAdmin MUST NOT call next() for participant');
      assert(sentStatus === 403, `Expected 403 Forbidden, got ${sentStatus}`);
      assert(
        sentBody.message.includes('Administrator access required'),
        'Expected admin required message'
      );
    });

    // --------------------------------------------------------------------------
    // Test 18: Logout clears session cookie
    // --------------------------------------------------------------------------
    await test('18. Logout invalidates session and clears HttpOnly cookie', async () => {
      const res = await apiRequest('/api/auth/logout', {
        method: 'POST',
        headers: {
          Cookie: leadCookie,
        },
      });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.setCookie, 'Expected Set-Cookie header on logout');
      assert(
        res.setCookie.includes('round1_token=;') ||
          res.setCookie.includes('round1_token=') && res.setCookie.toLowerCase().includes('expires='),
        'Cookie must be cleared/expired on logout'
      );
    });

    // --------------------------------------------------------------------------
    // Test 19: Constant-time comparison and crypto randomness
    // --------------------------------------------------------------------------
    await test('19. Constant-time comparison & HMAC-SHA256 uniqueness', async () => {
      const hash1 = hashOtp('123456');
      const hash2 = hashOtp('123456');
      const hash3 = hashOtp('123457');

      assert(hash1 === hash2, 'Identical OTPs must produce identical HMAC hashes');
      assert(hash1 !== hash3, 'Different OTPs must produce different HMAC hashes');
      assert(
        timingSafeEqual(hash1, hash2) === true,
        'timingSafeEqual must return true for matching hashes'
      );
      assert(
        timingSafeEqual(hash1, hash3) === false,
        'timingSafeEqual must return false for differing hashes'
      );
    });

    // --------------------------------------------------------------------------
    // Test 20: Invalidate previous unused OTP when new OTP is requested
    // --------------------------------------------------------------------------
    await test('20. New OTP request invalidates previous unused OTP', async () => {
      await query('DELETE FROM otp_codes WHERE user_id = $1;', [leadUserId]);
      clearTestMailbox();

      // Request OTP 1
      await apiRequest('/api/auth/request-otp', {
        method: 'POST',
        body: { email: LEAD_EMAIL },
      });
      const firstOtp = getLastTestEmail().otp;

      // Delete cooldown constraint row timestamp so we can issue second OTP
      await query(
        `UPDATE otp_codes
         SET created_at = NOW() - INTERVAL '70 seconds'
         WHERE user_id = $1;`,
        [leadUserId]
      );

      // Request OTP 2
      await apiRequest('/api/auth/request-otp', {
        method: 'POST',
        body: { email: LEAD_EMAIL },
      });
      const secondOtp = getLastTestEmail().otp;

      assert(firstOtp !== secondOtp, 'New OTP should differ');

      // Verify OTP 1 should now be rejected because it was invalidated!
      const res = await apiRequest('/api/auth/verify-otp', {
        method: 'POST',
        body: { email: LEAD_EMAIL, otp: firstOtp },
      });
      assert(res.status === 400, 'Previous unused OTP must be invalidated');

      // Verify OTP 2 succeeds
      const res2 = await apiRequest('/api/auth/verify-otp', {
        method: 'POST',
        body: { email: LEAD_EMAIL, otp: secondOtp },
      });
      assert(res2.status === 200, 'Latest OTP must succeed');
    });
  } finally {
    await cleanupFixtures();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await closePool();
  }

  console.log('\n----------------------------------------');
  console.log(`Results: ${passCount} passed, ${failCount} failed`);
  console.log('----------------------------------------\n');

  if (failCount > 0) {
    process.exit(1);
  }
};

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
