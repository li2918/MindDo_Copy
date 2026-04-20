'use strict';

const db = require('../database');
const { ApiError } = require('../utils/errors');
const { parsePagination, buildPage } = require('../utils/pagination');

async function create(req, res) {
  const b = req.body;
  const { rows } = await db.query(
    `INSERT INTO sessions (offering_id, student_id, teacher_id, course_name,
                           session_date, start_time, end_time, status, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [b.offeringId || null, b.studentId, b.teacherId || null, b.courseName || null,
     b.sessionDate, b.startTime, b.endTime, b.status, b.notes || null]
  );
  res.status(201).json({ data: rows[0] });
}

async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { studentId, from, to, status } = req.query;

  const where = [];
  const params = [];
  if (req.user.role === 'student') {
    params.push(req.user.studentId);
    where.push(`student_id = $${params.length}`);
  } else if (studentId) {
    params.push(studentId); where.push(`student_id = $${params.length}`);
  }
  if (from) { params.push(from); where.push(`session_date >= $${params.length}`); }
  if (to)   { params.push(to);   where.push(`session_date <= $${params.length}`); }
  if (status){ params.push(status); where.push(`status = $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRes = await db.query(`SELECT COUNT(*)::int AS total FROM sessions ${whereSql}`, params);
  const rowsRes = await db.query(
    `SELECT * FROM sessions ${whereSql}
     ORDER BY session_date ASC, start_time ASC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  res.json(buildPage({ rows: rowsRes.rows, total: totalRes.rows[0].total, page, limit }));
}

async function updateStatus(req, res) {
  const { status, notes } = req.body;
  if (!['scheduled','completed','cancelled','rescheduled','no_show'].includes(status)) {
    throw ApiError.badRequest('Invalid status');
  }
  const { rows } = await db.query(
    `UPDATE sessions SET status = $1, notes = COALESCE($2, notes) WHERE id = $3 RETURNING *`,
    [status, notes || null, req.params.id]
  );
  if (rows.length === 0) throw ApiError.notFound('Session not found');
  res.json({ data: rows[0] });
}

module.exports = { create, list, updateStatus };
