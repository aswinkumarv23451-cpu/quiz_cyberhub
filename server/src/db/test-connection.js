/**
 * Database Connection Test
 *
 * Standalone script to verify PostgreSQL connectivity,
 * list tables, and check constraints/indexes.
 *
 * Usage: npm run db:test
 */

import { testConnection, query, closePool } from '../config/database.js';

async function test() {
  console.log('\n=== Database Connection Test ===\n');

  try {
    // ── 1. Basic connectivity ───────────────────────────────────────────
    console.log('1. Testing connection...');
    const conn = await testConnection();
    console.log(`   ✓ Connected to "${conn.database}" at ${conn.serverTime}`);

    // ── 2. List tables ──────────────────────────────────────────────────
    console.log('\n2. Checking tables...');
    const tables = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    if (tables.rows.length === 0) {
      console.log(
        '   ⚠ No tables found. Run "npm run db:migrate" first.'
      );
      await closePool();
      return;
    }

    const expectedTables = [
      '_migrations',
      'answers',
      'attempts',
      'event',
      'otp_codes',
      'questions',
      'team_members',
      'teams',
      'users',
    ];

    for (const row of tables.rows) {
      const expected = expectedTables.includes(row.table_name);
      console.log(`   ${expected ? '✓' : '-'} ${row.table_name}`);
    }
    console.log(`   Total: ${tables.rows.length} table(s)`);

    // ── 3. Check constraints by table ───────────────────────────────────
    console.log('\n3. Checking constraints...');
    const constraints = await query(`
      SELECT tc.constraint_name, tc.table_name, tc.constraint_type
      FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public'
        AND tc.table_name != '_migrations'
      ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name
    `);

    const grouped = {};
    for (const row of constraints.rows) {
      if (!grouped[row.table_name]) grouped[row.table_name] = [];
      grouped[row.table_name].push(
        `${row.constraint_type}: ${row.constraint_name}`
      );
    }

    for (const [table, constList] of Object.entries(grouped)) {
      console.log(`   ${table}:`);
      for (const c of constList) {
        console.log(`     ${c}`);
      }
    }

    // ── 4. Check custom indexes ─────────────────────────────────────────
    console.log('\n4. Checking custom indexes...');
    const indexes = await query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `);

    for (const row of indexes.rows) {
      console.log(`   ✓ ${row.tablename}: ${row.indexname}`);
    }
    console.log(`   Total: ${indexes.rows.length} custom index(es)`);

    // ── 5. Verify critical constraints ──────────────────────────────────
    console.log('\n5. Verifying critical constraints...');

    // 5a. One TEAM_LEAD per team (partial unique index)
    const leadIdx = await query(`
      SELECT indexname FROM pg_indexes
      WHERE indexname = 'idx_one_lead_per_team'
    `);
    console.log(
      `   One-lead-per-team (partial unique index): ${leadIdx.rows.length > 0 ? '✓' : '✗ MISSING'}`
    );

    // 5b. One attempt per team (unique constraint)
    const attemptUq = await query(`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'attempts'
        AND constraint_type = 'UNIQUE'
        AND constraint_name = 'uq_attempts_team_id'
    `);
    console.log(
      `   One-attempt-per-team (UNIQUE team_id):    ${attemptUq.rows.length > 0 ? '✓' : '✗ MISSING'}`
    );

    // 5c. One answer per question per attempt (unique constraint)
    const answerUq = await query(`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'answers'
        AND constraint_type = 'UNIQUE'
        AND constraint_name = 'uq_answers_attempt_question'
    `);
    console.log(
      `   One-answer-per-question (UNIQUE):         ${answerUq.rows.length > 0 ? '✓' : '✗ MISSING'}`
    );

    // 5d. Cross-event FK on answers → attempts
    const fkAttempt = await query(`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'answers'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name = 'fk_answers_attempt_event'
    `);
    console.log(
      `   Cross-event FK (answers→attempts):        ${fkAttempt.rows.length > 0 ? '✓' : '✗ MISSING'}`
    );

    // 5e. Cross-event FK on answers → questions
    const fkQuestion = await query(`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'answers'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name = 'fk_answers_question_event'
    `);
    console.log(
      `   Cross-event FK (answers→questions):       ${fkQuestion.rows.length > 0 ? '✓' : '✗ MISSING'}`
    );

    // 5f. Event status check constraint
    const eventChk = await query(`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'event'
        AND constraint_type = 'CHECK'
        AND constraint_name = 'chk_event_status'
    `);
    console.log(
      `   Event status CHECK:                       ${eventChk.rows.length > 0 ? '✓' : '✗ MISSING'}`
    );

    // 5g. User-per-event unique constraint
    const userEventUq = await query(`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'team_members'
        AND constraint_type = 'UNIQUE'
        AND constraint_name = 'uq_team_members_user_event'
    `);
    console.log(
      `   One-user-per-event (UNIQUE):              ${userEventUq.rows.length > 0 ? '✓' : '✗ MISSING'}`
    );

    // 5h. Column check for attempts.current_question_started_at
    const colCheck = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'attempts' AND column_name = 'current_question_started_at'
    `);
    console.log(
      `   attempts.current_question_started_at:     ${colCheck.rows.length > 0 ? '✓' : '✗ MISSING'}`
    );

    // 5i. Column check for teams.whatsapp_group_joined
    const waColCheck = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'teams' AND column_name = 'whatsapp_group_joined'
    `);
    console.log(
      `   teams.whatsapp_group_joined:              ${waColCheck.rows.length > 0 ? '✓' : '✗ MISSING'}`
    );

    // ── 6. Verify triggers ──────────────────────────────────────────────
    console.log('\n6. Checking updated_at triggers...');
    const triggers = await query(`
      SELECT trigger_name, event_object_table
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
        AND trigger_name LIKE 'trg_%_updated_at'
      ORDER BY event_object_table
    `);

    for (const row of triggers.rows) {
      console.log(`   ✓ ${row.event_object_table}: ${row.trigger_name}`);
    }
    console.log(`   Total: ${triggers.rows.length} trigger(s)`);

    console.log('\n=== All tests passed ===\n');
  } catch (err) {
    console.error('\n✗ Connection test failed:', err.message);
    if (err.code === 'ECONNREFUSED') {
      console.error(
        '\n  PostgreSQL is not running or not reachable at the configured host/port.'
      );
      console.error(
        '  Check your server/.env file and ensure PostgreSQL is started.\n'
      );
    }
    process.exit(1);
  } finally {
    await closePool();
  }
}

test();
