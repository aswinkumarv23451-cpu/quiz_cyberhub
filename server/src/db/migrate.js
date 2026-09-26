/**
 * Database Migration Runner
 *
 * Reads .sql files from the migrations directory, executes them in order,
 * and tracks applied migrations in a _migrations meta-table.
 *
 * Usage: npm run db:migrate
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pool, { closePool } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATIONS_DIR = join(__dirname, 'migrations');

/**
 * Create the _migrations tracking table if it does not exist.
 */
async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL       PRIMARY KEY,
      name        VARCHAR(255) NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `);
}

/**
 * Get the set of already-applied migration names.
 */
async function getAppliedMigrations() {
  const result = await pool.query('SELECT name FROM _migrations ORDER BY id');
  return new Set(result.rows.map((row) => row.name));
}

/**
 * Apply a single migration file within a transaction.
 * Records the migration name in _migrations on success.
 * Rolls back the entire migration on failure.
 */
async function applyMigration(name, sql) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO _migrations (name) VALUES ($1)', [name]);
    await client.query('COMMIT');
    console.log(`  ✓ Applied: ${name}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`  ✗ Failed: ${name}`);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Main migration runner.
 */
async function migrate() {
  console.log('\n=== Database Migration ===\n');

  try {
    // 1. Verify connectivity
    const connResult = await pool.query('SELECT current_database() AS db');
    console.log(`Connected to database: ${connResult.rows[0].db}\n`);

    // 2. Ensure tracking table exists
    await ensureMigrationsTable();

    // 3. Determine which migrations have already been applied
    const applied = await getAppliedMigrations();

    // 4. Read migration files sorted alphabetically
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No migration files found in:', MIGRATIONS_DIR);
      return;
    }

    console.log(`Found ${files.length} migration file(s).\n`);

    let appliedCount = 0;
    let skippedCount = 0;

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  - Skipped (already applied): ${file}`);
        skippedCount++;
        continue;
      }

      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
      await applyMigration(file, sql);
      appliedCount++;
    }

    console.log(
      `\nMigration complete: ${appliedCount} applied, ${skippedCount} skipped.\n`
    );
  } catch (err) {
    console.error('\nMigration failed:');
    console.error('  error.name:', err?.name);
    console.error('  error.code:', err?.code);
    console.error('  error.message:', err?.message || String(err));
    if (err?.detail) console.error('  Detail:', err.detail);
    if (err?.hint) console.error('  Hint:', err.hint);
    process.exit(1);
  } finally {
    await closePool();
  }
}

migrate();
