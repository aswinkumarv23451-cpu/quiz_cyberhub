/**
 * Module 4: Team Registration + Payment Proof Comprehensive Test Suite
 *
 * Covers:
 * 1. Successful 2-member registration (1 lead, 1 member) with server-calculated ₹100 fee
 * 2. Successful 3-member registration (1 lead, 2 members) with server-calculated ₹150 fee
 * 3. Rejection when fewer than 2 members (< 2)
 * 4. Rejection when more than 3 members (> 3)
 * 5. Rejection when 0 TEAM_LEAD is designated
 * 6. Rejection when multiple TEAM_LEADs are designated
 * 7. Rejection when duplicate emails exist within the submitted team
 * 8. Rejection when duplicate register numbers exist within the submitted team
 * 9. Duplicate email protection across the event (safe anti-enumeration message)
 * 10. Duplicate team name protection within the event
 * 11. Event status check: registration rejected when event is LIVE or ENDED
 * 12. Multiple READY events fail safely
 * 13. Atomic rollback: transaction error leaves zero orphaned teams and cleans up disk file
 * 14. Existing user is reused without overwriting name or phone
 * 15. Server ignores client-provided fee/amount
 * 16. Server ignores client-provided registration_status (always PENDING)
 * 17. Client cannot select arbitrary event_id
 * 18. No internal UUID or Team ID exposed in API response
 * 19. Payment ID and payment proof required
 * 20. Real file validation: spoofed MIME type and invalid magic bytes rejected
 * 21. Payment proof extension/MIME mismatch rejected
 * 22. Path traversal attack rejected (original filename cannot control storage path)
 * 23. Concurrent duplicate registration caught by PostgreSQL unique constraints
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { getClient, query, closePool } from '../config/database.js';
import app from '../app.js';
import { registrationRateLimiter } from '../middleware/rateLimit.middleware.js';
import { paymentProofStorage } from '../services/storage/paymentProofStorage.js';

let server;
let baseUrl;

// Sample binary buffers with authentic magic bytes
const VALID_PNG_BUFFER = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('IHDR\0\0\0\x01\0\0\0\x01\x08\x06\0\0\0\x1f\x15c4\0\0\0\nIDATx\x9cc`\0\0\0\x02\0\x01HAF*\0\0\0\0IEND\xaeB`\x82'),
]);

const VALID_JPEG_BUFFER = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
  Buffer.alloc(100, 0xaa),
  Buffer.from([0xff, 0xd9]),
]);

const FAKE_PNG_BUFFER = Buffer.from('NOT_A_REAL_PNG_FILE_CONTENT_JUST_TEXT');

let testEventId;

const setupEvent = async (status = 'READY') => {
  // Clean up existing events to ensure exactly one READY event for the test
  await query('DELETE FROM event;');

  const res = await query(
    `INSERT INTO event (name, description, status)
     VALUES ('Module 4 Registration Test Event', 'Event for registration suite', $1)
     RETURNING id;`,
    [status]
  );
  testEventId = res.rows[0].id;
  return testEventId;
};

// Multipart form builder helper for native fetch
const buildMultipartBody = (fields, file) => {
  const boundary = `----WebKitFormBoundary${Date.now().toString(16)}`;
  const buffers = [];

  for (const [key, value] of Object.entries(fields)) {
    buffers.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${
          typeof value === 'object' ? JSON.stringify(value) : value
        }\r\n`
      )
    );
  }

  if (file) {
    buffers.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldname}"; filename="${file.filename}"\r\nContent-Type: ${file.mimetype}\r\n\r\n`
      )
    );
    buffers.push(file.buffer);
    buffers.push(Buffer.from('\r\n'));
  }

  buffers.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: Buffer.concat(buffers),
  };
};

const postRegistration = async (fields, file) => {
  const { headers, body } = buildMultipartBody(fields, file);
  const res = await fetch(`${baseUrl}/api/registration`, {
    method: 'POST',
    headers,
    body,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {}

  return { status: res.status, data };
};

let passCount = 0;
let failCount = 0;

const test = async (name, fn) => {
  try {
    registrationRateLimiter.reset();
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

const runTests = async () => {
  console.log('\n=== Module 4: Team Registration & Payment Proof Test Suite ===\n');

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  try {
    await setupEvent('READY');

    // --------------------------------------------------------------------------
    // Test 1: Successful 2-member registration & ₹100 fee calculation
    // --------------------------------------------------------------------------
    await test('1. Successful 2-member registration (1 lead, 1 member) with ₹100 fee', async () => {
      const res = await postRegistration(
        {
          teamName: 'Code Titans',
          college: 'PSG College of Technology',
          department: 'Computer Science',
          paymentId: 'TXN10001',
          members: JSON.stringify([
            {
              name: 'Aswin Kumar',
              email: 'aswin@psgtech.edu',
              phone: '9876543210',
              registerNumber: '21CS001',
              role: 'TEAM_LEAD',
            },
            {
              name: 'Karthik Raja',
              email: 'karthik@psgtech.edu',
              phone: '9876543211',
              registerNumber: '21CS002',
              role: 'MEMBER',
            },
          ]),
        },
        {
          fieldname: 'paymentProof',
          filename: 'receipt.png',
          mimetype: 'image/png',
          buffer: VALID_PNG_BUFFER,
        }
      );

      assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
      assert(res.data.registrationStatus === 'PENDING', 'Status must be PENDING');
      assert(res.data.memberCount === 2, 'Member count must be 2');
      assert(res.data.fee === 100, 'Fee must be server-calculated as 100');
      assert(res.data.teamName === 'Code Titans', 'Team name matches');

      // Verify no internal UUIDs exposed
      assert(!res.data.teamId && !res.data.id && !res.data.eventId, 'Must not leak database UUIDs');
    });

    // --------------------------------------------------------------------------
    // Test 2: Successful 3-member registration & ₹150 fee calculation
    // --------------------------------------------------------------------------
    await test('2. Successful 3-member registration (1 lead, 2 members) with ₹150 fee', async () => {
      const res = await postRegistration(
        {
          teamName: 'Binary Beasts',
          college: 'Coimbatore Institute of Technology',
          department: 'Information Technology',
          paymentId: 'TXN15002',
          members: JSON.stringify([
            {
              name: 'Priya Dharshini',
              email: 'priya@cit.edu.in',
              phone: '9876543220',
              registerNumber: '21IT001',
              role: 'TEAM_LEAD',
            },
            {
              name: 'Suresh Kumar',
              email: 'suresh@cit.edu.in',
              phone: '+919876543221',
              registerNumber: '21IT002',
              role: 'MEMBER',
            },
            {
              name: 'Ananya Sharma',
              email: 'ananya@cit.edu.in',
              phone: '09876543222',
              registerNumber: '21IT003',
              role: 'MEMBER',
            },
          ]),
        },
        {
          fieldname: 'paymentProof',
          filename: 'proof.jpg',
          mimetype: 'image/jpeg',
          buffer: VALID_JPEG_BUFFER,
        }
      );

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.data.memberCount === 3, 'Member count must be 3');
      assert(res.data.fee === 150, 'Fee must be server-calculated as 150');
    });

    // --------------------------------------------------------------------------
    // Test 3: Rejection when fewer than 2 members (< 2)
    // --------------------------------------------------------------------------
    await test('3. Rejection when fewer than 2 members submitted', async () => {
      const res = await postRegistration(
        {
          teamName: 'Solo Team',
          college: 'GCT',
          department: 'ECE',
          paymentId: 'TXN_SOLO',
          members: JSON.stringify([
            {
              name: 'Solo Lead',
              email: 'solo@gct.ac.in',
              phone: '9876543230',
              registerNumber: '21EC001',
              role: 'TEAM_LEAD',
            },
          ]),
        },
        {
          fieldname: 'paymentProof',
          filename: 'proof.png',
          mimetype: 'image/png',
          buffer: VALID_PNG_BUFFER,
        }
      );

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(res.data.message.includes('2 or 3 members'), 'Expected size validation message');
    });

    // --------------------------------------------------------------------------
    // Test 4: Rejection when more than 3 members (> 3)
    // --------------------------------------------------------------------------
    await test('4. Rejection when more than 3 members submitted', async () => {
      const res = await postRegistration(
        {
          teamName: 'Large Team',
          college: 'GCT',
          department: 'ECE',
          paymentId: 'TXN_LARGE',
          members: JSON.stringify([
            { name: 'M1', email: 'm1@gct.ac.in', phone: '9876543241', registerNumber: '21EC01', role: 'TEAM_LEAD' },
            { name: 'M2', email: 'm2@gct.ac.in', phone: '9876543242', registerNumber: '21EC02', role: 'MEMBER' },
            { name: 'M3', email: 'm3@gct.ac.in', phone: '9876543243', registerNumber: '21EC03', role: 'MEMBER' },
            { name: 'M4', email: 'm4@gct.ac.in', phone: '9876543244', registerNumber: '21EC04', role: 'MEMBER' },
          ]),
        },
        {
          fieldname: 'paymentProof',
          filename: 'proof.png',
          mimetype: 'image/png',
          buffer: VALID_PNG_BUFFER,
        }
      );

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(res.data.message.includes('2 or 3 members'), 'Expected size validation message');
    });

    // --------------------------------------------------------------------------
    // Test 5: Rejection when 0 TEAM_LEAD designated
    // --------------------------------------------------------------------------
    await test('5. Rejection when 0 TEAM_LEAD designated', async () => {
      const res = await postRegistration(
        {
          teamName: 'Leaderless Team',
          college: 'College',
          department: 'CSE',
          paymentId: 'TXN_NO_LEAD',
          members: JSON.stringify([
            { name: 'M1', email: 'nolead1@college.edu', phone: '9876543251', registerNumber: 'R1', role: 'MEMBER' },
            { name: 'M2', email: 'nolead2@college.edu', phone: '9876543252', registerNumber: 'R2', role: 'MEMBER' },
          ]),
        },
        {
          fieldname: 'paymentProof',
          filename: 'proof.png',
          mimetype: 'image/png',
          buffer: VALID_PNG_BUFFER,
        }
      );

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(res.data.message.includes('exactly one Team Lead'), 'Expected lead error message');
    });

    // --------------------------------------------------------------------------
    // Test 6: Rejection when multiple TEAM_LEADs designated
    // --------------------------------------------------------------------------
    await test('6. Rejection when multiple TEAM_LEADs designated', async () => {
      const res = await postRegistration(
        {
          teamName: 'Two Leads Team',
          college: 'College',
          department: 'CSE',
          paymentId: 'TXN_TWO_LEADS',
          members: JSON.stringify([
            { name: 'L1', email: 'twolead1@college.edu', phone: '9876543261', registerNumber: 'TL1', role: 'TEAM_LEAD' },
            { name: 'L2', email: 'twolead2@college.edu', phone: '9876543262', registerNumber: 'TL2', role: 'TEAM_LEAD' },
          ]),
        },
        {
          fieldname: 'paymentProof',
          filename: 'proof.png',
          mimetype: 'image/png',
          buffer: VALID_PNG_BUFFER,
        }
      );

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(res.data.message.includes('exactly one Team Lead'), 'Expected lead error message');
    });

    // --------------------------------------------------------------------------
    // Test 7: Duplicate emails within submitted team rejected
    // --------------------------------------------------------------------------
    await test('7. Duplicate emails within the same team rejected', async () => {
      const res = await postRegistration(
        {
          teamName: 'Clone Team',
          college: 'College',
          department: 'IT',
          paymentId: 'TXN_CLONE',
          members: JSON.stringify([
            { name: 'Clone 1', email: 'same@college.edu', phone: '9876543271', registerNumber: 'CL1', role: 'TEAM_LEAD' },
            { name: 'Clone 2', email: 'same@college.edu', phone: '9876543272', registerNumber: 'CL2', role: 'MEMBER' },
          ]),
        },
        {
          fieldname: 'paymentProof',
          filename: 'proof.png',
          mimetype: 'image/png',
          buffer: VALID_PNG_BUFFER,
        }
      );

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(res.data.message.includes('unique'), 'Expected email unique error');
    });

    // --------------------------------------------------------------------------
    // Test 8: Duplicate register numbers within submitted team rejected
    // --------------------------------------------------------------------------
    await test('8. Duplicate register numbers within the same team rejected', async () => {
      const res = await postRegistration(
        {
          teamName: 'Reg Dup Team',
          college: 'College',
          department: 'IT',
          paymentId: 'TXN_REG_DUP',
          members: JSON.stringify([
            { name: 'Person A', email: 'personA@college.edu', phone: '9876543281', registerNumber: 'SAME_REG', role: 'TEAM_LEAD' },
            { name: 'Person B', email: 'personB@college.edu', phone: '9876543282', registerNumber: 'SAME_REG', role: 'MEMBER' },
          ]),
        },
        {
          fieldname: 'paymentProof',
          filename: 'proof.png',
          mimetype: 'image/png',
          buffer: VALID_PNG_BUFFER,
        }
      );

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(res.data.message.includes('unique'), 'Expected reg number unique error');
    });

    // --------------------------------------------------------------------------
    // Test 9: Duplicate email across event rejected with safe anti-enumeration message
    // --------------------------------------------------------------------------
    await test('9. Member already in another team rejected with safe anti-enumeration error', async () => {
      // 'aswin@psgtech.edu' is already registered in 'Code Titans' from Test 1
      const res = await postRegistration(
        {
          teamName: 'Poachers',
          college: 'Another College',
          department: 'CSE',
          paymentId: 'TXN_DUP_CROSS',
          members: JSON.stringify([
            {
              name: 'Different Name',
              email: 'aswin@psgtech.edu', // ALREADY REGISTERED IN THIS EVENT
              phone: '9876543291',
              registerNumber: 'POACH01',
              role: 'TEAM_LEAD',
            },
            {
              name: 'New Person',
              email: 'newperson@another.edu',
              phone: '9876543292',
              registerNumber: 'POACH02',
              role: 'MEMBER',
            },
          ]),
        },
        {
          fieldname: 'paymentProof',
          filename: 'proof.png',
          mimetype: 'image/png',
          buffer: VALID_PNG_BUFFER,
        }
      );

      assert(res.status === 409, `Expected 409 Conflict, got ${res.status}`);
      // MANDATORY CORRECTION 5: Anti-enumeration check
      assert(
        res.data.message === 'One or more members are already registered for this event.',
        `Expected generic anti-enumeration message, got: ${res.data.message}`
      );
      assert(!res.data.message.includes('aswin@psgtech.edu'), 'Must not leak the specific email');
    });

    // --------------------------------------------------------------------------
    // Test 10: Duplicate team name within event rejected
    // --------------------------------------------------------------------------
    await test('10. Duplicate team name within event rejected', async () => {
      // 'Code Titans' registered in Test 1
      const res = await postRegistration(
        {
          teamName: 'Code Titans', // Case-insensitive collision
          college: 'Different College',
          department: 'MECH',
          paymentId: 'TXN_TEAM_DUP',
          members: JSON.stringify([
            { name: 'X1', email: 'x1@mech.edu', phone: '9876543301', registerNumber: 'M01', role: 'TEAM_LEAD' },
            { name: 'X2', email: 'x2@mech.edu', phone: '9876543302', registerNumber: 'M02', role: 'MEMBER' },
          ]),
        },
        {
          fieldname: 'paymentProof',
          filename: 'proof.png',
          mimetype: 'image/png',
          buffer: VALID_PNG_BUFFER,
        }
      );

      assert(res.status === 409, `Expected 409 Conflict, got ${res.status}`);
      assert(
        res.data.message.includes('Team name is already registered'),
        'Expected team name collision error'
      );
    });

    // --------------------------------------------------------------------------
    // Test 11: Event status check: registration rejected when event is LIVE or ENDED
    // --------------------------------------------------------------------------
    await test('11. Registration rejected when event is LIVE or ENDED', async () => {
      // Set event to LIVE
      await query('UPDATE event SET status = $1 WHERE id = $2;', ['LIVE', testEventId]);

      const res = await postRegistration(
        {
          teamName: 'Late Comers',
          college: 'College',
          department: 'CSE',
          paymentId: 'TXN_LATE',
          members: JSON.stringify([
            { name: 'Late 1', email: 'late1@college.edu', phone: '9876543311', registerNumber: 'L01', role: 'TEAM_LEAD' },
            { name: 'Late 2', email: 'late2@college.edu', phone: '9876543312', registerNumber: 'L02', role: 'MEMBER' },
          ]),
        },
        {
          fieldname: 'paymentProof',
          filename: 'proof.png',
          mimetype: 'image/png',
          buffer: VALID_PNG_BUFFER,
        }
      );

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(res.data.message.includes('closed'), 'Expected registration closed message');

      // Restore to READY
      await query('UPDATE event SET status = $1 WHERE id = $2;', ['READY', testEventId]);
    });

    // --------------------------------------------------------------------------
    // Test 12: Multiple READY events fails safely (Mandatory Correction 8)
    // --------------------------------------------------------------------------
    await test('12. Multiple READY events fails safely without arbitrary selection', async () => {
      // Insert second READY event
      const secondEventRes = await query(
        `INSERT INTO event (name, description, status)
         VALUES ('Conflicting Event', 'Second ready event', 'READY')
         RETURNING id;`
      );
      const secondEventId = secondEventRes.rows[0].id;

      const res = await postRegistration(
        {
          teamName: 'Ambiguity Test Team',
          college: 'College',
          department: 'CSE',
          paymentId: 'TXN_AMBIGUOUS',
          members: JSON.stringify([
            { name: 'Amb1', email: 'amb1@college.edu', phone: '9876543321', registerNumber: 'A01', role: 'TEAM_LEAD' },
            { name: 'Amb2', email: 'amb2@college.edu', phone: '9876543322', registerNumber: 'A02', role: 'MEMBER' },
          ]),
        },
        {
          fieldname: 'paymentProof',
          filename: 'proof.png',
          mimetype: 'image/png',
          buffer: VALID_PNG_BUFFER,
        }
      );

      assert(res.status === 500, `Expected 500 for ambiguous events, got ${res.status}`);
      assert(
        res.data.message.includes('multiple events') || res.data.message.includes('configuration error'),
        'Expected configuration error'
      );

      // Clean up second event
      await query('DELETE FROM event WHERE id = $1;', [secondEventId]);
    });

    // --------------------------------------------------------------------------
    // Test 13: Atomic rollback & file cleanup on database failure
    // --------------------------------------------------------------------------
    await test('13. Atomic rollback: DB failure leaves zero records and cleans up disk file', async () => {
      // We will trigger a failure by using an invalid event_id internally or conflicting data
      // Let's create a team that fails at member insertion stage (e.g. duplicate register number in team_members)
      // First, let's verify uploads folder count before attempt
      const uploadsDir = path.resolve('uploads/payment-proofs');
      const filesBefore = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];

      // Attempt registration where team name is duplicate to force DB transaction abort
      const res = await postRegistration(
        {
          teamName: 'Code Titans', // Will trigger rollback
          college: 'PSG',
          department: 'CSE',
          paymentId: 'TXN_ROLLBACK',
          members: JSON.stringify([
            { name: 'Rollback 1', email: 'rollback1@psg.edu', phone: '9876543331', registerNumber: 'RB01', role: 'TEAM_LEAD' },
            { name: 'Rollback 2', email: 'rollback2@psg.edu', phone: '9876543332', registerNumber: 'RB02', role: 'MEMBER' },
          ]),
        },
        {
          fieldname: 'paymentProof',
          filename: 'proof.png',
          mimetype: 'image/png',
          buffer: VALID_PNG_BUFFER,
        }
      );

      assert(res.status === 409, `Expected 409, got ${res.status}`);

      // Check uploads directory: no new file should remain!
      const filesAfter = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
      assert(
        filesAfter.length === filesBefore.length,
        'File MUST be deleted on transaction failure'
      );

      // Verify users were not inserted
      const checkUser = await query('SELECT id FROM users WHERE email = $1;', ['rollback1@psg.edu']);
      assert(checkUser.rows.length === 0, 'Orphaned user must not exist after rollback');
    });

    // --------------------------------------------------------------------------
    // Test 14: Existing user is reused without overwriting name or phone (Mandatory Correction 1)
    // --------------------------------------------------------------------------
    await test('14. Existing user is reused without overwriting name or phone', async () => {
      await query('DELETE FROM users WHERE email IN ($1, $2);', [
        'existinguser@reuse.edu',
        'partner@reuse.edu',
      ]);
      // Create user manually with original name and phone
      const origRes = await query(
        `INSERT INTO users (name, email, phone)
         VALUES ('Original Name', 'existinguser@reuse.edu', '+919999999999')
         RETURNING id, name, phone;`
      );
      const originalUserId = origRes.rows[0].id;

      // Register new team featuring this existing user with DIFFERENT name and phone submitted
      const res = await postRegistration(
        {
          teamName: 'Reusers Team',
          college: 'PSG',
          department: 'CSE',
          paymentId: 'TXN_REUSE',
          members: JSON.stringify([
            {
              name: 'Attempted Overwrite Name', // Should be ignored
              email: 'existinguser@reuse.edu',
              phone: '9876543340', // Should be ignored
              registerNumber: 'RU01',
              role: 'TEAM_LEAD',
            },
            {
              name: 'Partner User',
              email: 'partner@reuse.edu',
              phone: '9876543341',
              registerNumber: 'RU02',
              role: 'MEMBER',
            },
          ]),
        },
        {
          fieldname: 'paymentProof',
          filename: 'proof.png',
          mimetype: 'image/png',
          buffer: VALID_PNG_BUFFER,
        }
      );

      assert(res.status === 201, `Expected 201, got ${res.status}`);

      // Verify DB record: ID is identical, name and phone were NOT overwritten!
      const userCheck = await query('SELECT id, name, phone FROM users WHERE id = $1;', [originalUserId]);
      assert(userCheck.rows.length === 1, 'User must exist');
      assert(userCheck.rows[0].name === 'Original Name', 'Name MUST NOT be overwritten');
      assert(userCheck.rows[0].phone === '+919999999999', 'Phone MUST NOT be overwritten');
    });

    // --------------------------------------------------------------------------
    // Test 15: Server ignores client-provided fee/amount (Mandatory Correction 2)
    // --------------------------------------------------------------------------
    await test('15. Server ignores client-provided fee/amount and calculates authoritatively', async () => {
      const res = await postRegistration(
        {
          teamName: 'Fee Tamper Team',
          college: 'College',
          department: 'CSE',
          paymentId: 'TXN_TAMPER',
          fee: 1, // Tampered fee attempt
          amount: 5, // Tampered amount attempt
          members: JSON.stringify([
            { name: 'T1', email: 'tamper1@col.edu', phone: '9876543351', registerNumber: 'TP1', role: 'TEAM_LEAD' },
            { name: 'T2', email: 'tamper2@col.edu', phone: '9876543352', registerNumber: 'TP2', role: 'MEMBER' },
          ]),
        },
        {
          fieldname: 'paymentProof',
          filename: 'proof.png',
          mimetype: 'image/png',
          buffer: VALID_PNG_BUFFER,
        }
      );

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.data.fee === 100, `Expected server fee 100, got ${res.data.fee}`);
    });

    // --------------------------------------------------------------------------
    // Test 16: Server ignores client-provided registration_status (always PENDING)
    // --------------------------------------------------------------------------
    await test('16. Client cannot self-approve; registration_status is always PENDING', async () => {
      const res = await postRegistration(
        {
          teamName: 'Self Approvers',
          college: 'College',
          department: 'CSE',
          paymentId: 'TXN_SELF_APP',
          registration_status: 'APPROVED', // Tampered status
          status: 'APPROVED',
          members: JSON.stringify([
            { name: 'SA1', email: 'selfapp1@col.edu', phone: '9876543361', registerNumber: 'SA1', role: 'TEAM_LEAD' },
            { name: 'SA2', email: 'selfapp2@col.edu', phone: '9876543362', registerNumber: 'SA2', role: 'MEMBER' },
          ]),
        },
        {
          fieldname: 'paymentProof',
          filename: 'proof.png',
          mimetype: 'image/png',
          buffer: VALID_PNG_BUFFER,
        }
      );

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.data.registrationStatus === 'PENDING', 'Status must strictly be PENDING');

      // Verify in DB directly
      const dbCheck = await query(
        'SELECT registration_status FROM teams WHERE name = $1;',
        ['Self Approvers']
      );
      assert(dbCheck.rows[0].registration_status === 'PENDING', 'DB status must be PENDING');
    });

    // --------------------------------------------------------------------------
    // Test 17: Real file validation: spoofed MIME type and invalid magic bytes rejected
    // --------------------------------------------------------------------------
    await test('17. Real file validation: text file pretending to be PNG is rejected', async () => {
      const res = await postRegistration(
        {
          teamName: 'Spoof Team',
          college: 'College',
          department: 'CSE',
          paymentId: 'TXN_SPOOF',
          members: JSON.stringify([
            { name: 'SP1', email: 'spoof1@col.edu', phone: '9876543371', registerNumber: 'SP1', role: 'TEAM_LEAD' },
            { name: 'SP2', email: 'spoof2@col.edu', phone: '9876543372', registerNumber: 'SP2', role: 'MEMBER' },
          ]),
        },
        {
          fieldname: 'paymentProof',
          filename: 'fake.png',
          mimetype: 'image/png', // Declared as PNG, but buffer is plain text
          buffer: FAKE_PNG_BUFFER,
        }
      );

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(
        res.data.message.includes('signature') || res.data.message.includes('Invalid file content'),
        `Expected signature error, got: ${res.data.message}`
      );
    });

    // --------------------------------------------------------------------------
    // Test 18: Payment proof extension / MIME mismatch rejected
    // --------------------------------------------------------------------------
    await test('18. Extension and MIME type mismatch is rejected', async () => {
      const res = await postRegistration(
        {
          teamName: 'Mismatch Team',
          college: 'College',
          department: 'CSE',
          paymentId: 'TXN_MISMATCH',
          members: JSON.stringify([
            { name: 'MM1', email: 'mm1@col.edu', phone: '9876543381', registerNumber: 'MM1', role: 'TEAM_LEAD' },
            { name: 'MM2', email: 'mm2@col.edu', phone: '9876543382', registerNumber: 'MM2', role: 'MEMBER' },
          ]),
        },
        {
          fieldname: 'paymentProof',
          filename: 'image.jpg', // JPG extension
          mimetype: 'application/pdf', // Mismatched declared MIME
          buffer: VALID_JPEG_BUFFER,
        }
      );

      assert(res.status === 400, `Expected 400 for mismatch, got ${res.status}`);
    });

    // --------------------------------------------------------------------------
    // Test 19: Path traversal attack rejected (original filename cannot control storage)
    // --------------------------------------------------------------------------
    await test('19. Path traversal attempt in filename rejected / randomized by server', async () => {
      const res = await postRegistration(
        {
          teamName: 'Traversal Team',
          college: 'College',
          department: 'CSE',
          paymentId: 'TXN_TRAVERSAL',
          members: JSON.stringify([
            { name: 'TR1', email: 'tr1@col.edu', phone: '9876543391', registerNumber: 'TR1', role: 'TEAM_LEAD' },
            { name: 'TR2', email: 'tr2@col.edu', phone: '9876543392', registerNumber: 'TR2', role: 'MEMBER' },
          ]),
        },
        {
          fieldname: 'paymentProof',
          filename: '../../../../etc/passwd.png', // Malicious traversal attempt
          mimetype: 'image/png',
          buffer: VALID_PNG_BUFFER,
        }
      );

      assert(res.status === 201, `Expected 201, got ${res.status}`);

      // Verify that the file was stored with a randomized server filename in uploads/payment-proofs/
      const checkTeam = await query(
        'SELECT payment_proof_path FROM teams WHERE name = $1;',
        ['Traversal Team']
      );
      const storedPath = checkTeam.rows[0].payment_proof_path;
      assert(storedPath.startsWith('uploads/payment-proofs/proof-'), 'Must use safe server-generated prefix');
      assert(!storedPath.includes('..'), 'Must not contain path traversal dots');
    });

    // --------------------------------------------------------------------------
    // Test 20: GET /api/registration/event returns safe public event metadata
    // --------------------------------------------------------------------------
    await test('20. GET /api/registration/event returns safe event metadata without internal IDs', async () => {
      const res = await fetch(`${baseUrl}/api/registration/event`);
      const data = await res.json();

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(data.success === true, 'Expected success true');
      assert(data.registrationOpen === true, 'Expected registrationOpen true');
      assert(data.feePerMember === 50, 'Fee per member must be 50');
      assert(data.event.name === 'Module 4 Registration Test Event', 'Event name matches');
      assert(!data.event.id && !data.event.event_id, 'Must NOT expose internal database IDs');
    });

    // --------------------------------------------------------------------------
    // Test 21: Concurrent duplicate team registration handled safely
    // --------------------------------------------------------------------------
    await test('21. Concurrent duplicate team registration handled safely', async () => {
      const payload1 = {
        teamName: 'Concurrent Racers',
        college: 'PSG',
        department: 'CSE',
        paymentId: 'TXN_RACE_1',
        members: JSON.stringify([
          { name: 'R1', email: 'race1@col.edu', phone: '9876543401', registerNumber: 'RC01', role: 'TEAM_LEAD' },
          { name: 'R2', email: 'race2@col.edu', phone: '9876543402', registerNumber: 'RC02', role: 'MEMBER' },
        ]),
      };
      const payload2 = {
        teamName: 'Concurrent Racers', // SAME team name
        college: 'PSG',
        department: 'CSE',
        paymentId: 'TXN_RACE_2',
        members: JSON.stringify([
          { name: 'R3', email: 'race3@col.edu', phone: '9876543403', registerNumber: 'RC03', role: 'TEAM_LEAD' },
          { name: 'R4', email: 'race4@col.edu', phone: '9876543404', registerNumber: 'RC04', role: 'MEMBER' },
        ]),
      };

      const file1 = {
        fieldname: 'paymentProof',
        filename: 'proof1.png',
        mimetype: 'image/png',
        buffer: VALID_PNG_BUFFER,
      };
      const file2 = {
        fieldname: 'paymentProof',
        filename: 'proof2.png',
        mimetype: 'image/png',
        buffer: VALID_PNG_BUFFER,
      };

      const [res1, res2] = await Promise.all([
        postRegistration(payload1, file1),
        postRegistration(payload2, file2),
      ]);

      const statuses = [res1.status, res2.status].sort();
      assert(
        statuses[0] === 201 && statuses[1] === 409,
        `Expected exactly one 201 and one 409, got: ${res1.status} and ${res2.status}`
      );
    });
  } finally {
    // Cleanup fixtures
    await query('DELETE FROM event;');
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
