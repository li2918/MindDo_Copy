'use strict';

const db = require('../database');
const password = require('../utils/password');
const tokens = require('../utils/tokens');
const { createStudentCode } = require('../utils/ids');
const { ApiError } = require('../utils/errors');
const config = require('../config/env');

/**
 * Register a new student account. Creates both an `accounts` row (login
 * identity) and a `students` row (domain profile) atomically.
 */
async function register(req, res) {
  const body = req.body;
  const emailLc = body.email.toLowerCase();

  const existing = await db.query('SELECT id FROM accounts WHERE email = $1', [emailLc]);
  if (existing.rowCount > 0) throw ApiError.conflict('Email already registered');

  const hashed = await password.hash(body.password);

  const result = await db.withTransaction(async client => {
    const accountRes = await client.query(
      `INSERT INTO accounts (email, password_hash, role, provider)
       VALUES ($1, $2, 'student', $3)
       RETURNING id, email, role, created_at`,
      [emailLc, hashed, body.provider]
    );
    const account = accountRes.rows[0];

    const studentCode = createStudentCode();
    const studentRes = await client.query(
      `INSERT INTO students (
         account_id, student_code, student_name, parent_name, phone, city,
         grade, lead_source, stage, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'signup','NEW')
       RETURNING id, student_code, student_name`,
      [
        account.id, studentCode, body.name, body.parentName || null, body.phone || null,
        body.city || null, body.grade || null, body.leadSource
      ]
    );

    return { account, student: studentRes.rows[0] };
  });

  const tokensOut = await issueSession(result.account, result.student.id, req);
  res.status(201).json({
    account: {
      id: result.account.id,
      email: result.account.email,
      role: result.account.role
    },
    student: {
      id: result.student.id,
      studentCode: result.student.student_code,
      studentName: result.student.student_name
    },
    ...tokensOut
  });
}

async function login(req, res) {
  const { email, password: pw } = req.body;
  const emailLc = email.toLowerCase();

  const { rows } = await db.query(
    `SELECT a.id, a.email, a.password_hash, a.role, a.is_active, s.id AS student_id, s.student_code, s.student_name
     FROM accounts a
     LEFT JOIN students s ON s.account_id = a.id
     WHERE a.email = $1`,
    [emailLc]
  );
  const acc = rows[0];
  if (!acc || !acc.is_active || !acc.password_hash) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  const ok = await password.verify(pw, acc.password_hash);
  if (!ok) throw ApiError.unauthorized('Invalid email or password');

  await db.query('UPDATE accounts SET last_login_at = NOW() WHERE id = $1', [acc.id]);

  const tokensOut = await issueSession(acc, acc.student_id, req);
  res.json({
    account: { id: acc.id, email: acc.email, role: acc.role },
    student: acc.student_id
      ? { id: acc.student_id, studentCode: acc.student_code, studentName: acc.student_name }
      : null,
    ...tokensOut
  });
}

/**
 * Refresh rotation: verify the presented token, mark the stored row revoked,
 * and issue a fresh access+refresh pair chained via `replaced_by`. Reuse of a
 * revoked token revokes the whole chain.
 */
async function refresh(req, res) {
  const { refreshToken } = req.body;
  let payload;
  try {
    payload = tokens.verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid refresh token');
  }

  const hash = tokens.hashRefreshToken(refreshToken);
  const stored = await db.query(
    `SELECT rt.id, rt.account_id, rt.revoked_at, rt.expires_at,
            a.email, a.role, a.is_active, s.id AS student_id
     FROM refresh_tokens rt
     JOIN accounts a ON a.id = rt.account_id
     LEFT JOIN students s ON s.account_id = a.id
     WHERE rt.token_hash = $1`,
    [hash]
  );
  const row = stored.rows[0];
  if (!row) throw ApiError.unauthorized('Unknown refresh token');
  if (!row.is_active) throw ApiError.unauthorized('Account disabled');

  if (row.revoked_at || new Date(row.expires_at) < new Date()) {
    // Reuse detected — revoke every live token for this account.
    await db.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE account_id = $1 AND revoked_at IS NULL`,
      [row.account_id]
    );
    throw ApiError.unauthorized('Refresh token no longer valid');
  }

  const account = {
    id: row.account_id,
    email: row.email,
    role: row.role
  };
  const out = await rotateRefresh(row.id, account, row.student_id, req);
  res.json({ account, ...out });
}

async function logout(req, res) {
  const { refreshToken } = req.body;
  if (refreshToken) {
    const hash = tokens.hashRefreshToken(refreshToken);
    await db.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [hash]
    );
  }
  res.status(204).end();
}

async function me(req, res) {
  const { rows } = await db.query(
    `SELECT a.id AS account_id, a.email, a.role, a.email_verified, a.last_login_at,
            s.id AS student_id, s.student_code, s.student_name, s.parent_name, s.phone,
            s.city, s.grade, s.birthday, s.learning_style, s.goal, s.stage, s.status,
            s.tags, s.metadata, s.created_at
     FROM accounts a
     LEFT JOIN students s ON s.account_id = a.id
     WHERE a.id = $1`,
    [req.user.accountId]
  );
  if (rows.length === 0) throw ApiError.notFound('Account not found');
  res.json({ data: rows[0] });
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

async function issueSession(account, studentId, req) {
  const payload = {
    sub: account.id,
    email: account.email,
    role: account.role,
    studentId: studentId || null
  };
  const accessToken = tokens.signAccessToken(payload);
  const refreshToken = tokens.signRefreshToken({ sub: account.id });
  const hash = tokens.hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + tokens.durationToMs(config.auth.refreshExpiresIn));

  await db.query(
    `INSERT INTO refresh_tokens (account_id, token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [account.id, hash, req.get('user-agent') || null, req.ip || null, expiresAt]
  );
  return {
    accessToken,
    refreshToken,
    expiresIn: config.auth.accessExpiresIn
  };
}

async function rotateRefresh(oldRefreshId, account, studentId, req) {
  return db.withTransaction(async client => {
    const payload = {
      sub: account.id,
      email: account.email,
      role: account.role,
      studentId: studentId || null
    };
    const accessToken = tokens.signAccessToken(payload);
    const refreshToken = tokens.signRefreshToken({ sub: account.id });
    const hash = tokens.hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + tokens.durationToMs(config.auth.refreshExpiresIn));

    const ins = await client.query(
      `INSERT INTO refresh_tokens (account_id, token_hash, user_agent, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [account.id, hash, req.get('user-agent') || null, req.ip || null, expiresAt]
    );
    await client.query(
      `UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by = $1
       WHERE id = $2`,
      [ins.rows[0].id, oldRefreshId]
    );
    return {
      accessToken,
      refreshToken,
      expiresIn: config.auth.accessExpiresIn
    };
  });
}

module.exports = { register, login, refresh, logout, me };
