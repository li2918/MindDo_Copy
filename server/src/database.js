'use strict';

const { Pool } = require('pg');
const config = require('./config/env');
const logger = require('./utils/logger');

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
  max: config.db.max,
  idleTimeoutMillis: config.db.idleTimeoutMillis,
  connectionTimeoutMillis: config.db.connectionTimeoutMillis
});

pool.on('error', err => {
  // Idle client errors should not crash the process in production — log and let
  // the pool recycle the client on the next checkout.
  logger.error('pg pool error', { message: err.message });
});

async function query(text, params) {
  const started = Date.now();
  try {
    const res = await pool.query(text, params);
    const ms = Date.now() - started;
    if (ms > 200) logger.warn('slow query', { ms, text: text.slice(0, 120) });
    return res;
  } catch (err) {
    logger.error('query failed', { message: err.message, text: text.slice(0, 200) });
    throw err;
  }
}

/**
 * Run `fn(client)` inside a transaction. Commits on success, rolls back on
 * error, always releases the client.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function healthCheck() {
  const { rows } = await pool.query('SELECT 1 AS ok');
  return rows[0]?.ok === 1;
}

async function close() {
  await pool.end();
}

module.exports = { pool, query, withTransaction, healthCheck, close };
