'use strict';

const db = require('../database');
const { ApiError } = require('../utils/errors');
const { parsePagination, buildPage } = require('../utils/pagination');

function resolveStudentId(req) {
  if (req.user.role === 'student') return req.user.studentId;
  return req.body.studentId || req.params.studentId || req.user.studentId;
}

async function create(req, res) {
  const studentId = resolveStudentId(req);
  if (!studentId) throw ApiError.badRequest('studentId required');
  const b = req.body;

  const { rows } = await db.query(
    `INSERT INTO feedback (student_id, session_id, type, subject, rating, highlights, suggestion, next_step, content, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [studentId, b.sessionId || null, b.type, b.subject || null, b.rating ?? null,
     b.highlights || null, b.suggestion || null, b.nextStep || null,
     b.content || null, b.metadata || {}]
  );

  await db.query(
    `UPDATE students SET stage = 'feedback'
     WHERE id = $1 AND stage IN ('lead','trial','signup','assessment','payment','membership')`,
    [studentId]
  );

  res.status(201).json({ data: rows[0] });
}

async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { studentId, type } = req.query;

  const where = [];
  const params = [];
  if (req.user.role === 'student') {
    params.push(req.user.studentId);
    where.push(`student_id = $${params.length}`);
  } else if (studentId) {
    params.push(studentId); where.push(`student_id = $${params.length}`);
  }
  if (type) { params.push(type); where.push(`type = $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRes = await db.query(`SELECT COUNT(*)::int AS total FROM feedback ${whereSql}`, params);
  const rowsRes = await db.query(
    `SELECT * FROM feedback ${whereSql} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  res.json(buildPage({ rows: rowsRes.rows, total: totalRes.rows[0].total, page, limit }));
}

module.exports = { create, list };
