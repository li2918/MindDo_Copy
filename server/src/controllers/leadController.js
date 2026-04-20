'use strict';

const db = require('../database');
const { ApiError } = require('../utils/errors');
const { parsePagination, buildPage } = require('../utils/pagination');
const { createStudentCode } = require('../utils/ids');

/**
 * Public trial lead intake. Called from trial.html / trial-register.html.
 *
 * If the caller is authenticated we attach to their student record. Otherwise
 * we create a lightweight shell account+student so every lead has a stable
 * student_id for downstream follow-up.
 */
async function create(req, res) {
  const body = req.body;

  const studentId = await db.withTransaction(async client => {
    if (req.user?.studentId) return req.user.studentId;

    const email = body.email?.toLowerCase() || null;
    if (email) {
      const existing = await client.query('SELECT id FROM accounts WHERE email = $1', [email]);
      if (existing.rowCount > 0) {
        const s = await client.query('SELECT id FROM students WHERE account_id = $1', [existing.rows[0].id]);
        if (s.rowCount > 0) return s.rows[0].id;
      }
    }

    // Phone-only lead: synthesize a placeholder email so accounts.email UNIQUE
    // constraint stays satisfied. Staff can merge later via admin tooling.
    const digits = String(body.phone).replace(/\D/g, '').slice(-10) || Date.now().toString();
    const placeholderEmail = email || `lead+${digits}-${Date.now()}@minddo.local`;

    const acc = await client.query(
      `INSERT INTO accounts (email, role, provider, is_active)
       VALUES ($1, 'student', 'email', true)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      [placeholderEmail]
    );
    const accountId = acc.rows[0].id;

    const existingStudent = await client.query('SELECT id FROM students WHERE account_id = $1', [accountId]);
    if (existingStudent.rowCount > 0) return existingStudent.rows[0].id;

    const s = await client.query(
      `INSERT INTO students (account_id, student_code, student_name, parent_name, phone, city, grade,
                             lead_source, stage, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'trial', 'trial', 'NEW')
       RETURNING id`,
      [
        accountId, createStudentCode(),
        body.studentName || 'Trial Lead',
        body.parentName || null, body.phone, body.city || null, body.grade || null
      ]
    );
    return s.rows[0].id;
  });

  const { rows } = await db.query(
    `INSERT INTO trial_leads (
        student_id, student_name, parent_name, email, phone, city, grade,
        subject, subject_label, trial_date, trial_time, channel, channel_label,
        goal, time_note, consent, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING *`,
    [
      studentId, body.studentName || null, body.parentName || null, body.email || null,
      body.phone, body.city || null, body.grade || null,
      body.subject || null, body.subjectLabel || null, body.trialDate || null, body.trialTime || null,
      body.channel || null, body.channelLabel || null, body.goal || null, body.timeNote || null,
      body.consent, body.metadata || {}
    ]
  );

  // Keep student.stage advancing with the lifecycle.
  await db.query(
    `UPDATE students SET stage = 'trial' WHERE id = $1 AND stage = 'lead'`,
    [studentId]
  );

  res.status(201).json({ data: rows[0] });
}

async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { since } = req.query;
  const where = [];
  const params = [];
  if (since) { params.push(since); where.push(`tl.created_at >= $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRes = await db.query(`SELECT COUNT(*)::int AS total FROM trial_leads tl ${whereSql}`, params);
  const rowsRes = await db.query(
    `SELECT tl.*, s.student_code
     FROM trial_leads tl
     LEFT JOIN students s ON s.id = tl.student_id
     ${whereSql}
     ORDER BY tl.created_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  res.json(buildPage({ rows: rowsRes.rows, total: totalRes.rows[0].total, page, limit }));
}

async function getById(req, res) {
  const { rows } = await db.query(
    `SELECT tl.*, s.student_code FROM trial_leads tl
     LEFT JOIN students s ON s.id = tl.student_id WHERE tl.id = $1`,
    [req.params.id]
  );
  if (rows.length === 0) throw ApiError.notFound('Lead not found');
  res.json({ data: rows[0] });
}

module.exports = { create, list, getById };
