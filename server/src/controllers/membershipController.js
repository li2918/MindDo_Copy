'use strict';

const db = require('../database');
const { ApiError } = require('../utils/errors');
const { parsePagination, buildPage } = require('../utils/pagination');

/**
 * Create a membership order and (optionally) enrollment rows for each chosen
 * offering. Seat counts are incremented atomically; if any offering is full
 * the transaction is rolled back so orders never overbook.
 */
async function create(req, res) {
  const b = req.body;
  const studentId = req.user.role === 'student' ? req.user.studentId : (b.studentId || req.user.studentId);
  if (!studentId) throw ApiError.badRequest('studentId required');

  const data = await db.withTransaction(async client => {
    const orderRes = await client.query(
      `INSERT INTO membership_orders (
         student_id, tier, plan, class_mode, billing_cycle, time_preferences,
         add_ons, sessions, total_amount, currency, status, starts_at, ends_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11,$12)
       RETURNING *`,
      [
        studentId, b.tier, b.plan || null, b.classMode || null, b.billingCycle,
        b.timePreferences, JSON.stringify(b.addOns), JSON.stringify(b.sessions),
        b.totalAmount, b.currency, b.startsAt || null, b.endsAt || null
      ]
    );
    const order = orderRes.rows[0];

    for (const session of b.sessions || []) {
      const offering = await client.query(
        `SELECT id, seats_total, seats_taken FROM class_offerings
         WHERE id = $1 AND is_active = TRUE FOR UPDATE`,
        [session.offeringId]
      );
      if (offering.rowCount === 0) {
        throw ApiError.badRequest(`Unknown offering: ${session.offeringId}`);
      }
      const row = offering.rows[0];
      if (row.seats_taken >= row.seats_total) {
        throw ApiError.conflict(`Offering full: ${session.offeringId}`);
      }
      await client.query(
        `UPDATE class_offerings SET seats_taken = seats_taken + 1 WHERE id = $1`,
        [row.id]
      );
      await client.query(
        `INSERT INTO enrollments (membership_id, student_id, offering_id, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (membership_id, offering_id) DO NOTHING`,
        [order.id, studentId, row.id]
      );
    }

    await client.query(
      `UPDATE students SET stage = 'membership'
       WHERE id = $1 AND stage IN ('lead','trial','signup','assessment','payment')`,
      [studentId]
    );

    return order;
  });

  res.status(201).json({ data });
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

  const totalRes = await db.query(`SELECT COUNT(*)::int AS total FROM membership_orders ${whereSql}`, params);
  const rowsRes = await db.query(
    `SELECT * FROM membership_orders ${whereSql}
     ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  res.json(buildPage({ rows: rowsRes.rows, total: totalRes.rows[0].total, page, limit }));
}

async function getById(req, res) {
  const { rows } = await db.query(
    `SELECT * FROM membership_orders WHERE id = $1`,
    [req.params.id]
  );
  if (rows.length === 0) throw ApiError.notFound('Order not found');
  if (req.user.role === 'student' && rows[0].student_id !== req.user.studentId) {
    throw ApiError.forbidden();
  }
  const enrollments = await db.query(
    `SELECT e.*, o.course_name, o.weekday, o.time_slot, o.class_mode
     FROM enrollments e
     JOIN class_offerings o ON o.id = e.offering_id
     WHERE e.membership_id = $1`,
    [req.params.id]
  );
  res.json({ data: { ...rows[0], enrollments: enrollments.rows } });
}

async function cancel(req, res) {
  const result = await db.withTransaction(async client => {
    const orderRes = await client.query(
      `SELECT id, student_id, status FROM membership_orders WHERE id = $1 FOR UPDATE`,
      [req.params.id]
    );
    if (orderRes.rowCount === 0) throw ApiError.notFound('Order not found');
    if (req.user.role === 'student' && orderRes.rows[0].student_id !== req.user.studentId) {
      throw ApiError.forbidden();
    }
    if (orderRes.rows[0].status === 'cancelled') {
      return orderRes.rows[0];
    }
    const updated = await client.query(
      `UPDATE membership_orders SET status = 'cancelled' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    // Release seats from all active enrollments.
    const enrolls = await client.query(
      `SELECT offering_id FROM enrollments WHERE membership_id = $1 AND status = 'active'`,
      [req.params.id]
    );
    for (const e of enrolls.rows) {
      await client.query(
        `UPDATE class_offerings SET seats_taken = GREATEST(seats_taken - 1, 0) WHERE id = $1`,
        [e.offering_id]
      );
    }
    await client.query(
      `UPDATE enrollments SET status = 'dropped'
       WHERE membership_id = $1 AND status = 'active'`,
      [req.params.id]
    );
    return updated.rows[0];
  });
  res.json({ data: result });
}

module.exports = { create, list, getById, cancel };
