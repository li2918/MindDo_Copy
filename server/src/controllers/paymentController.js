'use strict';

const db = require('../database');
const { ApiError } = require('../utils/errors');
const { parsePagination, buildPage } = require('../utils/pagination');

async function create(req, res) {
  const b = req.body;
  // Students can only create payments against their own record.
  if (req.user.role === 'student' && req.user.studentId !== b.studentId) {
    throw ApiError.forbidden();
  }

  const { rows } = await db.query(
    `INSERT INTO payments (student_id, amount, currency, status, payment_method, provider, transaction_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [b.studentId, b.amount, b.currency, b.status, b.paymentMethod || null,
     b.provider || null, b.transactionId || null, b.metadata || {}]
  );

  if (b.status === 'succeeded') {
    await db.query(
      `UPDATE students SET stage = 'payment'
       WHERE id = $1 AND stage IN ('lead','trial','signup','assessment')`,
      [b.studentId]
    );
  }

  res.status(201).json({ data: rows[0] });
}

async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { studentId, status } = req.query;

  const where = [];
  const params = [];
  if (req.user.role === 'student') {
    params.push(req.user.studentId);
    where.push(`student_id = $${params.length}`);
  } else if (studentId) {
    params.push(studentId); where.push(`student_id = $${params.length}`);
  }
  if (status) { params.push(status); where.push(`status = $${params.length}`); }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRes = await db.query(`SELECT COUNT(*)::int AS total FROM payments ${whereSql}`, params);
  const rowsRes = await db.query(
    `SELECT * FROM payments ${whereSql} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  res.json(buildPage({ rows: rowsRes.rows, total: totalRes.rows[0].total, page, limit }));
}

async function updateStatus(req, res) {
  const { status } = req.body;
  if (!['pending','succeeded','failed','refunded','cancelled'].includes(status)) {
    throw ApiError.badRequest('Invalid status');
  }
  const { rows } = await db.query(
    `UPDATE payments SET status = $1 WHERE id = $2 RETURNING *`,
    [status, req.params.id]
  );
  if (rows.length === 0) throw ApiError.notFound('Payment not found');
  res.json({ data: rows[0] });
}

module.exports = { create, list, updateStatus };
