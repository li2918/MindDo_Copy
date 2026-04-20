'use strict';

const db = require('../database');
const { ApiError } = require('../utils/errors');
const { parsePagination, buildPage } = require('../utils/pagination');

function resolveStudentId(req) {
  if (req.user?.role === 'student') return req.user.studentId;
  return req.body.studentId || req.params.studentId || req.user?.studentId;
}

async function create(req, res) {
  const studentId = resolveStudentId(req);
  if (!studentId) throw ApiError.badRequest('studentId required');

  const b = req.body;
  const { rows } = await db.query(
    `INSERT INTO assessments (student_id, quiz_score, level, goal, notes, recommended_course, assessment_data)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [studentId, b.quizScore ?? null, b.level || null, b.goal || null, b.notes || null,
     b.recommendedCourse || null, b.assessmentData || {}]
  );

  await db.query(
    `UPDATE students SET stage = 'assessment'
     WHERE id = $1 AND stage IN ('lead','trial','signup')`,
    [studentId]
  );

  res.status(201).json({ data: rows[0] });
}

async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { studentId } = req.query;

  let filter = '';
  const params = [];
  if (req.user.role === 'student') {
    params.push(req.user.studentId);
    filter = `WHERE student_id = $${params.length}`;
  } else if (studentId) {
    params.push(studentId);
    filter = `WHERE student_id = $${params.length}`;
  }

  const totalRes = await db.query(`SELECT COUNT(*)::int AS total FROM assessments ${filter}`, params);
  const rowsRes = await db.query(
    `SELECT * FROM assessments ${filter} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  res.json(buildPage({ rows: rowsRes.rows, total: totalRes.rows[0].total, page, limit }));
}

async function getById(req, res) {
  const { rows } = await db.query('SELECT * FROM assessments WHERE id = $1', [req.params.id]);
  if (rows.length === 0) throw ApiError.notFound('Assessment not found');
  if (req.user.role === 'student' && rows[0].student_id !== req.user.studentId) {
    throw ApiError.forbidden();
  }
  res.json({ data: rows[0] });
}

module.exports = { create, list, getById };
