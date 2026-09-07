import pg from 'pg';
import { config } from './env.js';

const { Pool } = pg;

/**
 * PostgreSQL connection pool.
 * Uses database settings from config.db (sourced from environment variables).
 */
const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000', 10),
});

// Log unexpected pool-level errors (e.g. idle client disconnections)
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
});

/**
 * Execute a parameterized query against the pool.
 * @param {string} text - SQL query string
 * @param {Array} [params] - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export const query = (text, params) => pool.query(text, params);

/**
 * Acquire a dedicated client from the pool (for transactions).
 * Caller MUST call client.release() when done.
 * @returns {Promise<pg.PoolClient>}
 */
export const getClient = () => pool.connect();

/**
 * Test database connectivity by running a simple query.
 * @returns {Promise<{connected: boolean, serverTime: string, database: string}>}
 */
export const testConnection = async () => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT NOW() AS server_time, current_database() AS database_name'
    );
    return {
      connected: true,
      serverTime: result.rows[0].server_time,
      database: result.rows[0].database_name,
    };
  } finally {
    client.release();
  }
};

/**
 * Gracefully close all pool connections.
 */
export const closePool = () => pool.end();

export default pool;
