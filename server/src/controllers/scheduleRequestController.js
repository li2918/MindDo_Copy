'use strict';

const db = require('../database');
const { ApiError } = require('../utils/errors');
const { parsePagination, buildPage } = require('../utils/pagination');

async function create(req, res) {
  const b = req.body;
  const studentId = req.user.role === 'student' ? req.user.studentId : (b.studentId || req.user.studentId);
  if (!studentId) throw ApiError.badRequest('studentId required');

  const { rows } = await db.query(
    `INSERT INTO schedule_requests (student_id, session_id, request_type, target_label, reason, requested_date, status)
     VALUES ($1,$2,$3,$4,$5,$6,'pending')
     RETURNING *`,
    [studentId, b.sessionId || null, b.requestType, b.targetLabel || null,
     b.reason, b.requestedDate || null]
  );
  res.status(201).json({ data: rows[0] });
}

async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { status, studentId, q } = req.query;

  const where = [];
  const params = [];
  if (req.user.role === 'student') {
    params.push(req.user.studentId);
    where.push(`r.student_id = $${params.length}`);
  } else if (studentId) {
    params.push(studentId); where.push(`r.student_id = $${params.length}`);
  }
  if (status) { params.push(status); where.push(`r.status = $${params.length}`); }
  if (q) {
    params.push(`%${q}%`);
    where.push(`(s.student_name ILIKE $${params.length}
                 OR r.reason ILIKE $${params.length}
                 OR r.target_label ILIKE $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRes = await db.query(
    `SELECT COUNT(*)::int AS total FROM schedule_requests r
     LEFT JOIN students s ON s.id = r.student_id ${whereSql}`,
    params
  );
  const rowsRes = await db.query(
    `SELECT r.*, s.student_name, s.student_code, a.email
     FROM schedule_requests r
     LEFT JOIN students s ON s.id = r.student_id
     LEFT JOIN accounts a ON a.id = s.account_id
     ${whereSql}
     ORDER BY r.created_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  res.json(buildPage({ rows: rowsRes.rows, total: totalRes.rows[0].total, page, limit }));
}

async function updateStatus(req, res) {
  const { status, adminNotes } = req.body;
  const { rows } = await db.query(
    `UPDATE schedule_requests
     SET status = $1, admin_notes = $2, handled_by = $3, handled_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [status, adminNotes || null, req.user.accountId, req.params.id]
  );
  if (rows.length === 0) throw ApiError.notFound('Request not found');
  res.json({ data: rows[0] });
}

async function cancel(req, res) {
  const { rows } = await db.query(
    `UPDATE schedule_requests SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND student_id = $2 AND status = 'pending'
     RETURNING *`,
    [req.params.id, req.user.studentId]
  );
  if (rows.length === 0) throw ApiError.notFound('Request not found or not cancellable');
  res.json({ data: rows[0] });
}

module.exports = { create, list, updateStatus, cancel };
