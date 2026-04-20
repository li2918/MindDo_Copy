'use strict';

const db = require('../database');
const { ApiError } = require('../utils/errors');

async function list(req, res) {
  const includeInactive = req.user?.role && req.user.role !== 'student' && req.query.all === 'true';
  const { rows } = await db.query(
    `SELECT o.*, t.full_name AS teacher_name
     FROM class_offerings o
     LEFT JOIN teachers t ON t.id = o.teacher_id
     ${includeInactive ? '' : 'WHERE o.is_active = TRUE'}
     ORDER BY o.day_key, o.slot_key`
  );
  res.json({ data: rows });
}

async function getById(req, res) {
  const { rows } = await db.query(
    `SELECT o.*, t.full_name AS teacher_name
     FROM class_offerings o
     LEFT JOIN teachers t ON t.id = o.teacher_id
     WHERE o.id = $1`,
    [req.params.id]
  );
  if (rows.length === 0) throw ApiError.notFound('Offering not found');
  res.json({ data: rows[0] });
}

async function upsert(req, res) {
  const b = req.body;
  const { rows } = await db.query(
    `INSERT INTO class_offerings (id, course_name, level, teacher_id, class_mode,
                                   day_key, slot_key, weekday, time_slot,
                                   seats_total, seats_taken, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (id) DO UPDATE SET
       course_name = EXCLUDED.course_name,
       level       = EXCLUDED.level,
       teacher_id  = EXCLUDED.teacher_id,
       class_mode  = EXCLUDED.class_mode,
       day_key     = EXCLUDED.day_key,
       slot_key    = EXCLUDED.slot_key,
       weekday     = EXCLUDED.weekday,
       time_slot   = EXCLUDED.time_slot,
       seats_total = EXCLUDED.seats_total,
       is_active   = EXCLUDED.is_active
     RETURNING *`,
    [
      b.id, b.courseName, b.level, b.teacherId || null, b.classMode,
      b.dayKey, b.slotKey, b.weekday, b.timeSlot,
      b.seatsTotal, b.seatsTaken, b.isActive
    ]
  );
  res.status(201).json({ data: rows[0] });
}

async function remove(req, res) {
  const { rowCount } = await db.query('DELETE FROM class_offerings WHERE id = $1', [req.params.id]);
  if (rowCount === 0) throw ApiError.notFound('Offering not found');
  res.status(204).end();
}

module.exports = { list, getById, upsert, remove };
