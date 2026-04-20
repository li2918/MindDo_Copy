'use strict';

const db = require('../database');

/**
 * Powers `dashboard.html`. One request returns every metric the operations
 * dashboard currently reads from localStorage.
 */
async function overview(_req, res) {
  const [counts, stages, leadSources, paymentAgg, payments, leaveRequests, newStudents, newLeads] = await Promise.all([
    db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM students)                                          AS students_total,
        (SELECT COUNT(*)::int FROM students WHERE created_at::date = CURRENT_DATE)    AS students_today,
        (SELECT COUNT(*)::int FROM trial_leads)                                        AS leads_total,
        (SELECT COUNT(*)::int FROM trial_leads WHERE created_at::date = CURRENT_DATE)  AS leads_today,
        (SELECT COUNT(*)::int FROM assessments)                                        AS assessments_total,
        (SELECT COUNT(*)::int FROM membership_orders WHERE status = 'active')          AS memberships_active,
        (SELECT COUNT(*)::int FROM schedule_requests WHERE status = 'pending')         AS requests_pending
    `),
    db.query(`SELECT stage, COUNT(*)::int AS count FROM students GROUP BY stage`),
    db.query(`SELECT lead_source, COUNT(*)::int AS count FROM students GROUP BY lead_source`),
    db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'succeeded'
                          AND created_at >= date_trunc('month', CURRENT_DATE) THEN amount END), 0)::numeric AS revenue_mtd,
        COALESCE(SUM(CASE WHEN status = 'succeeded' THEN amount END), 0)::numeric      AS revenue_total,
        COUNT(*) FILTER (WHERE status = 'succeeded')::int                              AS succeeded_count,
        COUNT(*) FILTER (WHERE status = 'pending')::int                                AS pending_count,
        COUNT(*) FILTER (WHERE status = 'failed')::int                                 AS failed_count
      FROM payments
    `),
    db.query(`
      SELECT p.*, s.student_name, s.student_code
      FROM payments p
      LEFT JOIN students s ON s.id = p.student_id
      ORDER BY p.created_at DESC LIMIT 10
    `),
    db.query(`
      SELECT r.*, s.student_name, s.student_code
      FROM schedule_requests r
      LEFT JOIN students s ON s.id = r.student_id
      ORDER BY r.created_at DESC LIMIT 10
    `),
    db.query(`
      SELECT s.id, s.student_code, s.student_name, s.stage, s.status, a.email, s.created_at
      FROM students s JOIN accounts a ON a.id = s.account_id
      WHERE s.created_at::date = CURRENT_DATE
      ORDER BY s.created_at DESC
    `),
    db.query(`
      SELECT * FROM trial_leads
      WHERE created_at::date = CURRENT_DATE
      ORDER BY created_at DESC
    `)
  ]);

  res.json({
    data: {
      counts: counts.rows[0],
      stages: stages.rows,
      leadSources: leadSources.rows,
      payments: {
        summary: paymentAgg.rows[0],
        recent: payments.rows
      },
      requests: {
        recent: leaveRequests.rows
      },
      today: {
        newStudents: newStudents.rows,
        newLeads: newLeads.rows
      }
    }
  });
}

module.exports = { overview };
