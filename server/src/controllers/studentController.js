'use strict';

const db = require('../database');
const { ApiError } = require('../utils/errors');
const { parsePagination, buildPage } = require('../utils/pagination');

const SELECT_STUDENT = `
  SELECT s.id, s.student_code, s.student_name, s.parent_name, s.phone, s.city,
         s.grade, s.birthday, s.learning_style, s.goal, s.lead_source, s.stage,
         s.status, s.tags, s.metadata, s.created_at, s.updated_at,
         a.email, a.role
  FROM students s
  JOIN accounts a ON a.id = s.account_id
`;

async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { q, status, stage, source } = req.query;

  const where = [];
  const params = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`(s.student_name ILIKE $${params.length}
                OR a.email ILIKE $${params.length}
                OR s.student_code ILIKE $${params.length})`);
  }
  if (status) { params.push(status); where.push(`s.status = $${params.length}`); }
  if (stage)  { params.push(stage);  where.push(`s.stage  = $${params.length}`); }
  if (source) { params.push(source); where.push(`s.lead_source = $${params.length}`); }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRes = await db.query(
    `SELECT COUNT(*)::int AS total FROM students s JOIN accounts a ON a.id = s.account_id ${whereSql}`,
    params
  );
  const rowsRes = await db.query(
    `${SELECT_STUDENT} ${whereSql}
     ORDER BY s.created_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  res.json(buildPage({ rows: rowsRes.rows, total: totalRes.rows[0].total, page, limit }));
}

async function getById(req, res) {
  const { id } = req.params;
  const { rows } = await db.query(`${SELECT_STUDENT} WHERE s.id = $1`, [id]);
  if (rows.length === 0) throw ApiError.notFound('Student not found');
  // Enforce ownership: students can only read their own record.
  if (req.user.role === 'student' && req.user.studentId !== id) {
    throw ApiError.forbidden();
  }
  res.json({ data: rows[0] });
}

async function update(req, res) {
  const { id } = req.params;
  if (req.user.role === 'student' && req.user.studentId !== id) {
    throw ApiError.forbidden();
  }
  const body = req.body;

  // Students are not allowed to change their own stage/status.
  if (req.user.role === 'student') {
    delete body.stage;
    delete body.status;
    delete body.tags;
  }

  const colMap = {
    studentName: 'student_name',
    parentName:  'parent_name',
    phone:       'phone',
    city:        'city',
    grade:       'grade',
    birthday:    'birthday',
    learningStyle: 'learning_style',
    goal:        'goal',
    stage:       'stage',
    status:      'status',
    tags:        'tags',
    metadata:    'metadata'
  };

  const sets = [];
  const params = [];
  for (const [key, col] of Object.entries(colMap)) {
    if (body[key] !== undefined) {
      params.push(body[key]);
      sets.push(`${col} = $${params.length}`);
    }
  }
  if (sets.length === 0) throw ApiError.badRequest('No updatable fields provided');
  params.push(id);

  const { rows } = await db.query(
    `UPDATE students SET ${sets.join(', ')} WHERE id = $${params.length}
     RETURNING id`,
    params
  );
  if (rows.length === 0) throw ApiError.notFound('Student not found');

  const fresh = await db.query(`${SELECT_STUDENT} WHERE s.id = $1`, [id]);
  res.json({ data: fresh.rows[0] });
}

/**
 * Aggregated snapshot — mirrors `MindDoFlow.getSnapshot()` on the frontend.
 * Used by `student-account.html` to render everything on a single request.
 */
async function snapshot(req, res) {
  const id = req.params.id || req.user.studentId;
  if (!id) throw ApiError.badRequest('Student id required');
  if (req.user.role === 'student' && req.user.studentId !== id) {
    throw ApiError.forbidden();
  }

  const [student, lead, assessment, payment, membership, feedback, requests] = await Promise.all([
    db.query(`${SELECT_STUDENT} WHERE s.id = $1`, [id]),
    db.query(`SELECT * FROM trial_leads      WHERE student_id = $1 ORDER BY created_at DESC LIMIT 1`, [id]),
    db.query(`SELECT * FROM assessments      WHERE student_id = $1 ORDER BY created_at DESC LIMIT 1`, [id]),
    db.query(`SELECT * FROM payments         WHERE student_id = $1 ORDER BY created_at DESC LIMIT 1`, [id]),
    db.query(`SELECT * FROM membership_orders WHERE student_id = $1 ORDER BY created_at DESC LIMIT 1`, [id]),
    db.query(`SELECT * FROM feedback         WHERE student_id = $1 ORDER BY created_at DESC LIMIT 1`, [id]),
    db.query(`SELECT * FROM schedule_requests WHERE student_id = $1 ORDER BY created_at DESC LIMIT 10`, [id])
  ]);

  if (student.rows.length === 0) throw ApiError.notFound('Student not found');
  res.json({
    data: {
      student: student.rows[0],
      lead: lead.rows[0] || null,
      assessment: assessment.rows[0] || null,
      payment: payment.rows[0] || null,
      membership: membership.rows[0] || null,
      feedback: feedback.rows[0] || null,
      requests: requests.rows
    }
  });
}

module.exports = { list, getById, update, snapshot };
