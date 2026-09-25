/**
 * Round 1: Team Registration Test Suite
 * Free Registration + Mandatory Official WhatsApp Group Confirmation
 *
 * Covers:
 * 1. Free registration succeeds without payment information
 * 2. Payment ID is not required
 * 3. Payment proof is not required (JSON payload succeeds)
 * 4. WhatsApp confirmation is required (omitted confirmation rejected with 400)
 * 5. whatsapp_group_joined=false is rejected with 400 (not described as payment rejection)
 * 6. whatsapp_group_joined=true succeeds with 201
 * 7. Official WhatsApp link is sourced from server configuration (GET /api/registration/event)
 * 8. Successful 3-member free registration (1 lead, 2 members)
 * 9. Rejection when fewer than 2 members submitted (< 2)
 * 10. Rejection when more than 3 members submitted (> 3)
 * 11. Rejection when 0 TEAM_LEAD designated
 * 12. Rejection when multiple TEAM_LEADs designated
 * 13. Duplicate emails within the same team rejected
 * 14. Duplicate register numbers within the same team rejected
 * 15. Member already in another team rejected with safe anti-enumeration error
 * 16. Duplicate team name within event rejected
 * 17. Registration rejected when event is LIVE or ENDED
 * 18. Multiple READY events fails safely without arbitrary selection
 * 19. Atomic rollback: DB failure leaves zero orphaned records
 * 20. Existing user is reused without overwriting name or phone
 * 21. Client cannot self-approve; registration_status is always PENDING
 * 22. GET /api/registration/event returns safe event metadata without internal IDs
 * 23. Concurrent duplicate team registration handled safely
 */

import http from 'http';
import { getClient, query, closePool } from '../config/database.js';
import { config } from '../config/env.js';
import app from '../app.js';
import { registrationRateLimiter } from '../middleware/rateLimit.middleware.js';

let server;
let baseUrl;
let testEventId;

const setupEvent = async (status = 'READY') => {
  // Clean up existing events to ensure exactly one event for the test
  await query('DELETE FROM event;');

  const res = await query(
    `INSERT INTO event (name, description, status)
     VALUES ('Round 1 Free Registration Test Event', 'Event for free registration suite', $1)
     RETURNING id;`,
    [status]
  );
  testEventId = res.rows[0].id;
  return testEventId;
};

// Helper to post registration as JSON or multipart
const postRegistration = async (fields, file = null) => {
  if (!file) {
    const bodyObj = { ...fields };
    if (typeof bodyObj.members === 'string') {
      try {
        bodyObj.members = JSON.parse(bodyObj.members);
      } catch (e) {}
    }
    const res = await fetch(`${baseUrl}/api/registration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj),
    });

    let data = null;
    try {
      data = await res.json();
    } catch (e) {}

    return { status: res.status, data };
  }

  // Multipart form builder helper for backward compatibility testing
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

  const res = await fetch(`${baseUrl}/api/registration`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: Buffer.concat(buffers),
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
  console.log('\n=== Round 1: Free Registration & Official WhatsApp Confirmation Test Suite ===\n');

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;

  try {
    await setupEvent('READY');

    // --------------------------------------------------------------------------
    // Test 1: Free registration succeeds without payment information
    // --------------------------------------------------------------------------
    await test('1. Free registration succeeds without payment information', async () => {
      const res = await postRegistration({
        teamName: 'Code Titans',
        college: 'PSG College of Technology',
        department: 'Computer Science',
        whatsapp_group_joined: true,
        // NO paymentId, NO paymentProof
        members: [
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
        ],
      });

      assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
      assert(res.data.registrationStatus === 'PENDING', 'Status must be PENDING');
      assert(res.data.memberCount === 2, 'Member count must be 2');
      assert(res.data.teamName === 'Code Titans', 'Team name matches');
      assert(res.data.whatsappGroupJoined === true, 'WhatsApp confirmation confirmed');
      assert(res.data.fee === undefined, 'Must NOT return fee in response');

      // Verify no internal UUIDs exposed
      assert(!res.data.teamId && !res.data.id && !res.data.eventId, 'Must not leak database UUIDs');

      // Verify database record has whatsapp_group_joined=true and payment columns unused (null)
      const teamInDb = await query(
        'SELECT payment_id, payment_proof_path, whatsapp_group_joined FROM teams WHERE name = $1;',
        ['Code Titans']
      );
      assert(teamInDb.rows.length === 1, 'Team must be stored in database');
      assert(teamInDb.rows[0].whatsapp_group_joined === true, 'whatsapp_group_joined must be true in DB');
      assert(teamInDb.rows[0].payment_id === null, 'payment_id must remain null/unused');
      assert(teamInDb.rows[0].payment_proof_path === null, 'payment_proof_path must remain null/unused');
    });

    // --------------------------------------------------------------------------
    // Test 2: Payment ID is not required
    // --------------------------------------------------------------------------
    await test('2. Payment ID is not required', async () => {
      const res = await postRegistration({
        teamName: 'Alpha Squad',
        college: 'PSG Tech',
        department: 'IT',
        whatsapp_group_joined: true,
        // paymentId explicitly omitted
        members: [
          { name: 'Lead User', email: 'lead_nopayid@test.com', phone: '9876543212', registerNumber: 'AS01', role: 'TEAM_LEAD' },
          { name: 'Member User', email: 'member_nopayid@test.com', phone: '9876543213', registerNumber: 'AS02', role: 'MEMBER' },
        ],
      });

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.data.registrationStatus === 'PENDING');
    });

    // --------------------------------------------------------------------------
    // Test 3: Payment proof is not required (JSON payload succeeds without multipart/file)
    // --------------------------------------------------------------------------
    await test('3. Payment proof is not required (pure JSON without file)', async () => {
      const res = await postRegistration({
        teamName: 'Beta Squad',
        college: 'CIT',
        department: 'ECE',
        whatsapp_group_joined: true,
        // No file uploaded
        members: [
          { name: 'Beta Lead', email: 'beta_lead@cit.edu', phone: '9876543214', registerNumber: 'BS01', role: 'TEAM_LEAD' },
          { name: 'Beta Member', email: 'beta_member@cit.edu', phone: '9876543215', registerNumber: 'BS02', role: 'MEMBER' },
        ],
      });

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.data.teamName === 'Beta Squad');
    });

    // --------------------------------------------------------------------------
    // Test 4: WhatsApp confirmation is required (missing confirmation rejected)
    // --------------------------------------------------------------------------
    await test('4. WhatsApp confirmation is required (omitted confirmation rejected with 400)', async () => {
      const res = await postRegistration({
        teamName: 'Unconfirmed Team',
        college: 'GCT',
        department: 'EEE',
        // whatsapp_group_joined NOT provided
        members: [
          { name: 'UC Lead', email: 'uc_lead@gct.ac.in', phone: '9876543216', registerNumber: 'UC01', role: 'TEAM_LEAD' },
          { name: 'UC Member', email: 'uc_member@gct.ac.in', phone: '9876543217', registerNumber: 'UC02', role: 'MEMBER' },
        ],
      });

      assert(res.status === 400, `Expected 400 Bad Request, got ${res.status}`);
      assert(res.data.message.toLowerCase().includes('whatsapp'), 'Error message must mention WhatsApp');
      assert(!res.data.message.toLowerCase().includes('payment'), 'Must NOT describe error as payment rejection');
    });

    // --------------------------------------------------------------------------
    // Test 5: whatsapp_group_joined=false is rejected with normal validation error
    // --------------------------------------------------------------------------
    await test('5. whatsapp_group_joined=false is rejected with 400 validation error', async () => {
      const res = await postRegistration({
        teamName: 'Refusal Team',
        college: 'GCT',
        department: 'Mech',
        whatsapp_group_joined: false,
        members: [
          { name: 'Ref Lead', email: 'ref_lead@gct.ac.in', phone: '9876543218', registerNumber: 'RF01', role: 'TEAM_LEAD' },
          { name: 'Ref Member', email: 'ref_member@gct.ac.in', phone: '9876543219', registerNumber: 'RF02', role: 'MEMBER' },
        ],
      });

      assert(res.status === 400, `Expected 400 Bad Request, got ${res.status}`);
      assert(res.data.message.toLowerCase().includes('whatsapp'), 'Error must mention WhatsApp group confirmation');
      assert(!res.data.message.toLowerCase().includes('payment'), 'Must NOT describe error as payment rejection');
    });

    // --------------------------------------------------------------------------
    // Test 6: whatsapp_group_joined=true succeeds
    // --------------------------------------------------------------------------
    await test('6. whatsapp_group_joined=true succeeds with 201', async () => {
      const res = await postRegistration({
        teamName: 'Confirmed Team',
        college: 'PSG Tech',
        department: 'CSE',
        whatsapp_group_joined: true,
        members: [
          { name: 'Conf Lead', email: 'conf_lead@psg.edu', phone: '9876543221', registerNumber: 'CF01', role: 'TEAM_LEAD' },
          { name: 'Conf Member', email: 'conf_member@psg.edu', phone: '9876543222', registerNumber: 'CF02', role: 'MEMBER' },
        ],
      });

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.data.whatsappGroupJoined === true, 'Response confirms whatsappGroupJoined');
    });

    // --------------------------------------------------------------------------
    // Test 7: Official WhatsApp link is sourced from server configuration
    // --------------------------------------------------------------------------
    await test('7. Official WhatsApp link is sourced from server configuration (GET /api/registration/event)', async () => {
      const res = await fetch(`${baseUrl}/api/registration/event`);
      const data = await res.json();

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(data.success === true, 'Expected success true');
      assert(data.registrationOpen === true, 'Expected registrationOpen true');
      assert(data.whatsappGroupLink === config.whatsappGroupLink, 'Link must match server configuration');
      assert(typeof data.whatsappGroupLink === 'string' && data.whatsappGroupLink.startsWith('https://chat.whatsapp.com/'), 'Must be a valid WhatsApp link');
      assert(data.feePerMember === undefined, 'Must NOT expose feePerMember');
      assert(!data.event.id && !data.event.event_id, 'Must NOT expose internal database IDs');
    });

    // --------------------------------------------------------------------------
    // Test 8: Successful 3-member free registration (1 lead, 2 members)
    // --------------------------------------------------------------------------
    await test('8. Successful 3-member free registration (1 lead, 2 members)', async () => {
      const res = await postRegistration({
        teamName: 'Binary Beasts',
        college: 'Coimbatore Institute of Technology',
        department: 'Information Technology',
        whatsapp_group_joined: true,
        members: [
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
            phone: '+919876543223',
            registerNumber: '21IT002',
            role: 'MEMBER',
          },
          {
            name: 'Ananya Sharma',
            email: 'ananya@cit.edu.in',
            phone: '09876543224',
            registerNumber: '21IT003',
            role: 'MEMBER',
          },
        ],
      });

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.data.memberCount === 3, 'Member count must be 3');
      assert(res.data.registrationStatus === 'PENDING');
    });

    // --------------------------------------------------------------------------
    // Test 9: Rejection when fewer than 2 members submitted (< 2)
    // --------------------------------------------------------------------------
    await test('9. Rejection when fewer than 2 members submitted', async () => {
      const res = await postRegistration({
        teamName: 'Solo Team',
        college: 'GCT',
        department: 'ECE',
        whatsapp_group_joined: true,
        members: [
          {
            name: 'Solo Lead',
            email: 'solo@gct.ac.in',
            phone: '9876543230',
            registerNumber: '21EC001',
            role: 'TEAM_LEAD',
          },
        ],
      });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(res.data.message.includes('2 or 3 members'), 'Expected size validation message');
    });

    // --------------------------------------------------------------------------
    // Test 10: Rejection when more than 3 members submitted (> 3)
    // --------------------------------------------------------------------------
    await test('10. Rejection when more than 3 members submitted', async () => {
      const res = await postRegistration({
        teamName: 'Large Team',
        college: 'GCT',
        department: 'ECE',
        whatsapp_group_joined: true,
        members: [
          { name: 'M1', email: 'm1@gct.ac.in', phone: '9876543241', registerNumber: '21EC01', role: 'TEAM_LEAD' },
          { name: 'M2', email: 'm2@gct.ac.in', phone: '9876543242', registerNumber: '21EC02', role: 'MEMBER' },
          { name: 'M3', email: 'm3@gct.ac.in', phone: '9876543243', registerNumber: '21EC03', role: 'MEMBER' },
          { name: 'M4', email: 'm4@gct.ac.in', phone: '9876543244', registerNumber: '21EC04', role: 'MEMBER' },
        ],
      });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(res.data.message.includes('2 or 3 members'), 'Expected size validation message');
    });

    // --------------------------------------------------------------------------
    // Test 11: Rejection when 0 TEAM_LEAD designated
    // --------------------------------------------------------------------------
    await test('11. Rejection when 0 TEAM_LEAD designated', async () => {
      const res = await postRegistration({
        teamName: 'Leaderless Team',
        college: 'College',
        department: 'CSE',
        whatsapp_group_joined: true,
        members: [
          { name: 'M1', email: 'nolead1@college.edu', phone: '9876543251', registerNumber: 'R1', role: 'MEMBER' },
          { name: 'M2', email: 'nolead2@college.edu', phone: '9876543252', registerNumber: 'R2', role: 'MEMBER' },
        ],
      });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(res.data.message.includes('exactly one Team Lead'), 'Expected lead error message');
    });

    // --------------------------------------------------------------------------
    // Test 12: Rejection when multiple TEAM_LEADs designated
    // --------------------------------------------------------------------------
    await test('12. Rejection when multiple TEAM_LEADs designated', async () => {
      const res = await postRegistration({
        teamName: 'Two Leads Team',
        college: 'College',
        department: 'CSE',
        whatsapp_group_joined: true,
        members: [
          { name: 'L1', email: 'twolead1@college.edu', phone: '9876543261', registerNumber: 'TL1', role: 'TEAM_LEAD' },
          { name: 'L2', email: 'twolead2@college.edu', phone: '9876543262', registerNumber: 'TL2', role: 'TEAM_LEAD' },
        ],
      });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(res.data.message.includes('exactly one Team Lead'), 'Expected lead error message');
    });

    // --------------------------------------------------------------------------
    // Test 13: Duplicate emails within submitted team rejected
    // --------------------------------------------------------------------------
    await test('13. Duplicate emails within the same team rejected', async () => {
      const res = await postRegistration({
        teamName: 'Clone Team',
        college: 'College',
        department: 'IT',
        whatsapp_group_joined: true,
        members: [
          { name: 'Clone 1', email: 'same@college.edu', phone: '9876543271', registerNumber: 'CL1', role: 'TEAM_LEAD' },
          { name: 'Clone 2', email: 'same@college.edu', phone: '9876543272', registerNumber: 'CL2', role: 'MEMBER' },
        ],
      });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(res.data.message.includes('unique'), 'Expected email unique error');
    });

    // --------------------------------------------------------------------------
    // Test 14: Duplicate register numbers within submitted team rejected
    // --------------------------------------------------------------------------
    await test('14. Duplicate register numbers within the same team rejected', async () => {
      const res = await postRegistration({
        teamName: 'Reg Dup Team',
        college: 'College',
        department: 'IT',
        whatsapp_group_joined: true,
        members: [
          { name: 'Person A', email: 'personA@college.edu', phone: '9876543281', registerNumber: 'SAME_REG', role: 'TEAM_LEAD' },
          { name: 'Person B', email: 'personB@college.edu', phone: '9876543282', registerNumber: 'SAME_REG', role: 'MEMBER' },
        ],
      });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(res.data.message.includes('unique'), 'Expected reg number unique error');
    });

    // --------------------------------------------------------------------------
    // Test 15: Duplicate email across event rejected with safe anti-enumeration message
    // --------------------------------------------------------------------------
    await test('15. Member already in another team rejected with safe anti-enumeration error', async () => {
      // 'aswin@psgtech.edu' is already registered in 'Code Titans' from Test 1
      const res = await postRegistration({
        teamName: 'Poachers',
        college: 'Another College',
        department: 'CSE',
        whatsapp_group_joined: true,
        members: [
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
        ],
      });

      assert(res.status === 409, `Expected 409 Conflict, got ${res.status}`);
      assert(
        res.data.message === 'One or more members are already registered for this event.',
        'Must return safe anti-enumeration message'
      );
    });

    // --------------------------------------------------------------------------
    // Test 16: Duplicate team name within event rejected
    // --------------------------------------------------------------------------
    await test('16. Duplicate team name within event rejected', async () => {
      // 'Code Titans' already registered in Test 1
      const res = await postRegistration({
        teamName: 'Code Titans',
        college: 'Different College',
        department: 'IT',
        whatsapp_group_joined: true,
        members: [
          { name: 'T1', email: 't1@college.edu', phone: '9876543301', registerNumber: 'T01', role: 'TEAM_LEAD' },
          { name: 'T2', email: 't2@college.edu', phone: '9876543302', registerNumber: 'T02', role: 'MEMBER' },
        ],
      });

      assert(res.status === 409, `Expected 409 Conflict, got ${res.status}`);
      assert(
        res.data.message.includes('already registered'),
        'Expected team name duplicate error'
      );
    });

    // --------------------------------------------------------------------------
    // Test 17: Registration rejected when event is LIVE or ENDED
    // --------------------------------------------------------------------------
    await test('17. Registration rejected when event is LIVE or ENDED', async () => {
      // Change event status to LIVE
      await query('UPDATE event SET status = $1 WHERE id = $2;', ['LIVE', testEventId]);

      const res = await postRegistration({
        teamName: 'Late Comers',
        college: 'College',
        department: 'CSE',
        whatsapp_group_joined: true,
        members: [
          { name: 'Late 1', email: 'late1@college.edu', phone: '9876543311', registerNumber: 'L01', role: 'TEAM_LEAD' },
          { name: 'Late 2', email: 'late2@college.edu', phone: '9876543312', registerNumber: 'L02', role: 'MEMBER' },
        ],
      });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(res.data.message.includes('closed'), 'Expected registration closed message');

      // Restore to READY
      await query('UPDATE event SET status = $1 WHERE id = $2;', ['READY', testEventId]);
    });

    // --------------------------------------------------------------------------
    // Test 18: Multiple READY events fails safely
    // --------------------------------------------------------------------------
    await test('18. Multiple READY events fails safely without arbitrary selection', async () => {
      // Insert second READY event
      const secondEventRes = await query(
        `INSERT INTO event (name, description, status)
         VALUES ('Conflicting Event', 'Second ready event', 'READY')
         RETURNING id;`
      );
      const secondEventId = secondEventRes.rows[0].id;

      const res = await postRegistration({
        teamName: 'Ambiguity Test Team',
        college: 'College',
        department: 'CSE',
        whatsapp_group_joined: true,
        members: [
          { name: 'Amb1', email: 'amb1@college.edu', phone: '9876543321', registerNumber: 'A01', role: 'TEAM_LEAD' },
          { name: 'Amb2', email: 'amb2@college.edu', phone: '9876543322', registerNumber: 'A02', role: 'MEMBER' },
        ],
      });

      assert(res.status === 500, `Expected 500 for ambiguous events, got ${res.status}`);
      assert(
        res.data.message.includes('multiple events') || res.data.message.includes('configuration error'),
        'Expected configuration error'
      );

      // Clean up second event
      await query('DELETE FROM event WHERE id = $1;', [secondEventId]);
    });

    // --------------------------------------------------------------------------
    // Test 19: Atomic rollback on database failure leaves zero orphaned records
    // --------------------------------------------------------------------------
    await test('19. Atomic rollback: DB failure leaves zero orphaned records', async () => {
      // Attempt registration where team name is duplicate to force DB transaction abort
      const res = await postRegistration({
        teamName: 'Code Titans', // Will trigger duplicate 409
        college: 'PSG',
        department: 'CSE',
        whatsapp_group_joined: true,
        members: [
          { name: 'Rollback 1', email: 'rollback1@psg.edu', phone: '9876543331', registerNumber: 'RB01', role: 'TEAM_LEAD' },
          { name: 'Rollback 2', email: 'rollback2@psg.edu', phone: '9876543332', registerNumber: 'RB02', role: 'MEMBER' },
        ],
      });

      assert(res.status === 409, `Expected 409, got ${res.status}`);

      // Verify users were not inserted into users table
      const checkUser = await query('SELECT id FROM users WHERE email = $1;', ['rollback1@psg.edu']);
      assert(checkUser.rows.length === 0, 'Orphaned user must not exist after rollback');
    });

    // --------------------------------------------------------------------------
    // Test 20: Existing user is reused without overwriting name or phone
    // --------------------------------------------------------------------------
    await test('20. Existing user is reused without overwriting name or phone', async () => {
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
      const res = await postRegistration({
        teamName: 'Reusers Team',
        college: 'PSG',
        department: 'CSE',
        whatsapp_group_joined: true,
        members: [
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
        ],
      });

      assert(res.status === 201, `Expected 201, got ${res.status}`);

      // Verify user in DB still has Original Name and Phone
      const userCheck = await query('SELECT name, phone FROM users WHERE id = $1;', [originalUserId]);
      assert(userCheck.rows[0].name === 'Original Name', 'Existing user name must not be overwritten');
      assert(userCheck.rows[0].phone === '+919999999999', 'Existing user phone must not be overwritten');
    });

    // --------------------------------------------------------------------------
    // Test 21: Client cannot self-approve; registration_status is always PENDING
    // --------------------------------------------------------------------------
    await test('21. Client cannot self-approve; registration_status is always PENDING', async () => {
      const res = await postRegistration({
        teamName: 'Sneaky Approvers',
        college: 'GCT',
        department: 'CSE',
        registrationStatus: 'APPROVED', // Client tries to sneak in APPROVED
        registration_status: 'APPROVED',
        whatsapp_group_joined: true,
        members: [
          { name: 'S1', email: 's1@gct.ac.in', phone: '9876543351', registerNumber: 'SN01', role: 'TEAM_LEAD' },
          { name: 'S2', email: 's2@gct.ac.in', phone: '9876543352', registerNumber: 'SN02', role: 'MEMBER' },
        ],
      });

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.data.registrationStatus === 'PENDING', 'Must always be PENDING');

      const checkDb = await query(
        'SELECT registration_status FROM teams WHERE name = $1;',
        ['Sneaky Approvers']
      );
      assert(checkDb.rows[0].registration_status === 'PENDING', 'Database status must be PENDING');
    });

    // --------------------------------------------------------------------------
    // Test 22: Concurrent duplicate team registration handled safely
    // --------------------------------------------------------------------------
    await test('22. Concurrent duplicate team registration handled safely', async () => {
      const payload1 = {
        teamName: 'Concurrent Racers',
        college: 'PSG',
        department: 'CSE',
        whatsapp_group_joined: true,
        members: [
          { name: 'R1', email: 'race1@col.edu', phone: '9876543401', registerNumber: 'RC01', role: 'TEAM_LEAD' },
          { name: 'R2', email: 'race2@col.edu', phone: '9876543402', registerNumber: 'RC02', role: 'MEMBER' },
        ],
      };
      const payload2 = {
        teamName: 'Concurrent Racers', // SAME team name
        college: 'PSG',
        department: 'CSE',
        whatsapp_group_joined: true,
        members: [
          { name: 'R3', email: 'race3@col.edu', phone: '9876543403', registerNumber: 'RC03', role: 'TEAM_LEAD' },
          { name: 'R4', email: 'race4@col.edu', phone: '9876543404', registerNumber: 'RC04', role: 'MEMBER' },
        ],
      };

      const [res1, res2] = await Promise.all([
        postRegistration(payload1),
        postRegistration(payload2),
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
