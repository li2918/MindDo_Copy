'use strict';

/**
 * Seed script — mirrors the demo data that `assets/minddo-flow.js` stores in
 * localStorage, so a freshly migrated database makes every dashboard and
 * profile page show the same scenario the frontend prototype already tells.
 *
 * Safe to re-run: truncates domain tables, then rewrites everything.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const config = require('../src/config/env');

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : false
});

const OFFERINGS = [
  { id: 'ai-fund-mon-16',   course: { zh: 'AI 启蒙入门',   en: 'AI Fundamentals'    }, level: { zh: '入门',   en: 'Beginner'     }, teacher: 'Dr. Sarah Chen',  mode: 'small', day: 'mon', slot: 't16', weekday: { zh: '周一', en: 'Mon' }, time: '16:00 – 17:00', total: 6, taken: 3 },
  { id: 'ai-fund-wed-16',   course: { zh: 'AI 启蒙入门',   en: 'AI Fundamentals'    }, level: { zh: '入门',   en: 'Beginner'     }, teacher: 'Dr. Sarah Chen',  mode: 'small', day: 'wed', slot: 't16', weekday: { zh: '周三', en: 'Wed' }, time: '16:00 – 17:00', total: 6, taken: 5 },
  { id: 'ai-create-tue-17', course: { zh: 'AI 创意工坊',   en: 'AI Creative Studio' }, level: { zh: '中级',   en: 'Intermediate' }, teacher: 'Jenny Lin',       mode: 'small', day: 'tue', slot: 't17', weekday: { zh: '周二', en: 'Tue' }, time: '17:00 – 18:00', total: 6, taken: 4 },
  { id: 'ai-create-thu-17', course: { zh: 'AI 创意工坊',   en: 'AI Creative Studio' }, level: { zh: '中级',   en: 'Intermediate' }, teacher: 'Jenny Lin',       mode: 'small', day: 'thu', slot: 't17', weekday: { zh: '周四', en: 'Thu' }, time: '17:00 – 18:00', total: 6, taken: 2 },
  { id: 'ai-prog-mon-18',   course: { zh: 'AI 编程进阶',   en: 'AI Programming'     }, level: { zh: '进阶',   en: 'Advanced'     }, teacher: 'Marcus Johnson',  mode: 'small', day: 'mon', slot: 't18', weekday: { zh: '周一', en: 'Mon' }, time: '18:00 – 19:00', total: 6, taken: 6 },
  { id: 'ai-prog-fri-17',   course: { zh: 'AI 编程进阶',   en: 'AI Programming'     }, level: { zh: '进阶',   en: 'Advanced'     }, teacher: 'Marcus Johnson',  mode: 'small', day: 'fri', slot: 't17', weekday: { zh: '周五', en: 'Fri' }, time: '17:00 – 18:00', total: 6, taken: 3 },
  { id: 'ai-comp-wed-18',   course: { zh: 'AI 竞赛冲刺',   en: 'AI Competition'     }, level: { zh: '竞赛',   en: 'Competition'  }, teacher: 'David Park',      mode: '1v1',   day: 'wed', slot: 't18', weekday: { zh: '周三', en: 'Wed' }, time: '18:00 – 19:00', total: 1, taken: 0 },
  { id: 'ai-fund-sat-10',   course: { zh: 'AI 启蒙入门',   en: 'AI Fundamentals'    }, level: { zh: '入门',   en: 'Beginner'     }, teacher: 'Dr. Sarah Chen',  mode: 'small', day: 'sat', slot: 't10', weekday: { zh: '周六', en: 'Sat' }, time: '10:00 – 11:00', total: 6, taken: 4 },
  { id: 'ai-create-sat-13', course: { zh: 'AI 创意工坊',   en: 'AI Creative Studio' }, level: { zh: '中级',   en: 'Intermediate' }, teacher: 'Jenny Lin',       mode: 'small', day: 'sat', slot: 't13', weekday: { zh: '周六', en: 'Sat' }, time: '13:00 – 14:00', total: 6, taken: 1 },
  { id: 'ai-project-sat-15',course: { zh: 'AI 项目营',     en: 'AI Project Camp'    }, level: { zh: '项目营', en: 'Project Camp' }, teacher: 'David Park',      mode: 'small', day: 'sat', slot: 't15', weekday: { zh: '周六', en: 'Sat' }, time: '15:00 – 16:00', total: 8, taken: 5 },
  { id: 'ai-prog-sun-10',   course: { zh: 'AI 编程进阶',   en: 'AI Programming'     }, level: { zh: '进阶',   en: 'Advanced'     }, teacher: 'Marcus Johnson',  mode: 'small', day: 'sun', slot: 't10', weekday: { zh: '周日', en: 'Sun' }, time: '10:00 – 11:00', total: 6, taken: 2 },
  { id: 'ai-create-sun-14', course: { zh: 'AI 创意工坊',   en: 'AI Creative Studio' }, level: { zh: '中级',   en: 'Intermediate' }, teacher: 'Jenny Lin',       mode: 'small', day: 'sun', slot: 't14', weekday: { zh: '周日', en: 'Sun' }, time: '14:00 – 15:00', total: 6, taken: 3 }
];

const TRUNCATE_ORDER = [
  'audit_logs',
  'email_outbox',
  'refresh_tokens',
  'schedule_requests',
  'feedback',
  'sessions',
  'enrollments',
  'membership_orders',
  'payments',
  'assessments',
  'trial_leads',
  'students',
  'class_offerings',
  'teachers',
  'accounts'
];

async function run() {
  const client = await pool.connect();
  const started = Date.now();
  try {
    await client.query('BEGIN');
    for (const t of TRUNCATE_ORDER) {
      await client.query(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`);
    }

    // ---------- Admin ----------
    const adminHash = await bcrypt.hash(config.admin.bootstrapPassword, config.auth.bcryptRounds);
    const admin = await client.query(
      `INSERT INTO accounts (email, password_hash, role, provider, is_active, email_verified)
       VALUES ($1, $2, 'admin', 'email', true, true)
       RETURNING id`,
      [config.admin.bootstrapEmail, adminHash]
    );

    // ---------- Teachers ----------
    const teacherByName = {};
    for (const name of ['Dr. Sarah Chen', 'Jenny Lin', 'Marcus Johnson', 'David Park']) {
      const r = await client.query(
        `INSERT INTO teachers (full_name, title, subjects, is_active)
         VALUES ($1, 'AI Instructor', ARRAY['AI','Coding'], true)
         RETURNING id`,
        [name]
      );
      teacherByName[name] = r.rows[0].id;
    }

    // ---------- Offerings ----------
    for (const o of OFFERINGS) {
      await client.query(
        `INSERT INTO class_offerings (id, course_name, level, teacher_id, class_mode,
                                       day_key, slot_key, weekday, time_slot, seats_total, seats_taken)
         VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)`,
        [
          o.id, JSON.stringify(o.course), JSON.stringify(o.level), teacherByName[o.teacher],
          o.mode, o.day, o.slot, JSON.stringify(o.weekday), o.time, o.total, o.taken
        ]
      );
    }

    // ---------- Demo student ----------
    const studentHash = await bcrypt.hash('Student!2026', config.auth.bcryptRounds);
    const acc = await client.query(
      `INSERT INTO accounts (email, password_hash, role, provider, is_active, email_verified)
       VALUES ('leo.li@example.com', $1, 'student', 'email', true, true)
       RETURNING id`,
      [studentHash]
    );
    const accountId = acc.rows[0].id;

    const studentCode = 'MD2026-0417-1145';
    const studentRow = await client.query(
      `INSERT INTO students (account_id, student_code, student_name, parent_name, phone, city,
                             grade, birthday, goal, lead_source, stage, status)
       VALUES ($1, $2, '李若安', '李女士', '317-555-0188', 'Indianapolis', '六年级',
               '2014-05-18', 'AI创造力提升', 'trial', 'membership', 'ACTIVE')
       RETURNING id`,
      [accountId, studentCode]
    );
    const studentId = studentRow.rows[0].id;

    await client.query(
      `INSERT INTO trial_leads (student_id, student_name, parent_name, email, phone, city, grade,
                                subject, subject_label, trial_date, trial_time, channel, channel_label,
                                goal, time_note, consent)
       VALUES ($1, '李若安', '李女士', 'leo.li@example.com', '317-555-0188', 'Indianapolis',
               '六年级', 'ai-coding', 'AI 编程进阶', CURRENT_DATE, '18:30', 'wechat', '微信/社群',
               'AI创造力提升', 'Prefer weekday evening slots.', true)`,
      [studentId]
    );

    await client.query(
      `INSERT INTO assessments (student_id, quiz_score, level, goal, notes, recommended_course)
       VALUES ($1, 82, 'Intermediate', 'Interest Learning',
               'Strong curiosity and project readiness.', 'AI Creative Studio')`,
      [studentId]
    );

    const paymentRow = await client.query(
      `INSERT INTO payments (student_id, amount, currency, status, payment_method, provider, transaction_id)
       VALUES ($1, 369.00, 'USD', 'succeeded', 'card', 'stripe', 'TEST-TXN-0001')
       RETURNING id`,
      [studentId]
    );

    const membership = await client.query(
      `INSERT INTO membership_orders (student_id, tier, plan, class_mode, billing_cycle,
                                       time_preferences, add_ons, sessions, total_amount, status)
       VALUES ($1, 'weekly2', 'weekly2', '1v1', 'monthly',
               $2::jsonb, $3::jsonb, $4::jsonb, 369.00, 'active')
       RETURNING id`,
      [
        studentId,
        JSON.stringify({ weekday: '周一', timeSlot: '16:00 – 17:00' }),
        JSON.stringify(['mentor']),
        JSON.stringify([
          { offeringId: 'ai-fund-mon-16', courseName: 'AI 启蒙入门', weekday: '周一', timeSlot: '16:00 – 17:00' },
          { offeringId: 'ai-fund-wed-16', courseName: 'AI 启蒙入门', weekday: '周三', timeSlot: '16:00 – 17:00' }
        ])
      ]
    );
    const membershipId = membership.rows[0].id;

    for (const oid of ['ai-fund-mon-16', 'ai-fund-wed-16']) {
      await client.query(
        `INSERT INTO enrollments (membership_id, student_id, offering_id, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT DO NOTHING`,
        [membershipId, studentId, oid]
      );
    }

    await client.query(
      `INSERT INTO feedback (student_id, type, subject, rating, highlights, suggestion, next_step)
       VALUES ($1, 'trial', 'AI 编程进阶', 5,
               'Student responded well to guided project prompts.',
               'Move into the formal weekly track.',
               'Continue to formal course')`,
      [studentId]
    );

    await client.query(
      `INSERT INTO schedule_requests (student_id, request_type, target_label, reason, status)
       VALUES ($1, 'reschedule', '每周两节课 · 周三 · 晚间 19:00-21:00',
               '本周学校活动冲突，希望顺延到周四同一时间。', 'pending')`,
      [studentId]
    );

    await client.query(
      `INSERT INTO audit_logs (account_id, action, resource, resource_id, metadata)
       VALUES ($1, 'seed.bootstrap', 'database', $2, $3::jsonb)`,
      [admin.rows[0].id, 'seed', JSON.stringify({ offerings: OFFERINGS.length, paymentId: paymentRow.rows[0].id })]
    );

    await client.query('COMMIT');
    console.log(`[seed] ok in ${Date.now() - started}ms`);
    console.log(`[seed] admin: ${config.admin.bootstrapEmail} / ${config.admin.bootstrapPassword}`);
    console.log(`[seed] demo student: leo.li@example.com / Student!2026`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[seed] failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
