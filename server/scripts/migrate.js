'use strict';

/**
 * Database migration for the MindDo platform.
 *
 * Usage:
 *   node scripts/migrate.js          # idempotent: create everything missing
 *   node scripts/migrate.js --reset  # DROP SCHEMA public CASCADE, then re-create
 *
 * The schema is authored in a single transactional block so the database is
 * never left half-migrated.
 */

const { Pool } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const args = new Set(process.argv.slice(2));
const RESET = args.has('--reset');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

const SQL_RESET = `
  DROP SCHEMA IF EXISTS public CASCADE;
  CREATE SCHEMA public;
  GRANT ALL ON SCHEMA public TO public;
`;

const SQL_EXTENSIONS = `
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";
  CREATE EXTENSION IF NOT EXISTS "citext";
`;

// Reusable trigger function: refresh updated_at on every row update.
const SQL_TOUCH_FN = `
  CREATE OR REPLACE FUNCTION set_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`;

const SQL_TABLES = `
  -- ---------- Accounts ----------
  -- One row per login identity. Students, staff, teachers, admins all live here.
  CREATE TABLE IF NOT EXISTS accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           CITEXT UNIQUE NOT NULL,
    password_hash   TEXT,                              -- nullable for SSO-only accounts
    role            TEXT NOT NULL DEFAULT 'student'
                    CHECK (role IN ('student','parent','teacher','staff','admin')),
    provider        TEXT NOT NULL DEFAULT 'email'
                    CHECK (provider IN ('email','google','microsoft','apple')),
    provider_sub    TEXT,                              -- subject id from OAuth provider
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_sub)
  );
  CREATE INDEX IF NOT EXISTS idx_accounts_role        ON accounts(role);
  CREATE INDEX IF NOT EXISTS idx_accounts_created_at  ON accounts(created_at DESC);

  -- ---------- Students ----------
  -- Domain profile tied to an account. student_code is the human-readable ID
  -- used throughout the UI (e.g. MD2026-0417-1145).
  CREATE TABLE IF NOT EXISTS students (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID UNIQUE NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    student_code    TEXT UNIQUE NOT NULL,
    student_name    TEXT NOT NULL,
    parent_name     TEXT,
    phone           TEXT,
    city            TEXT,
    birthday        DATE,
    grade           TEXT,
    learning_style  TEXT,
    goal            TEXT,
    lead_source     TEXT NOT NULL DEFAULT 'organic'
                    CHECK (lead_source IN ('trial','signup','referral','campaign','organic')),
    stage           TEXT NOT NULL DEFAULT 'lead'
                    CHECK (stage IN ('lead','trial','signup','assessment','payment','membership','feedback','churned')),
    status          TEXT NOT NULL DEFAULT 'NEW'
                    CHECK (status IN ('NEW','ACTIVE','PAUSED','CHURNED')),
    tags            TEXT[] NOT NULL DEFAULT '{}',
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_students_stage       ON students(stage);
  CREATE INDEX IF NOT EXISTS idx_students_status      ON students(status);
  CREATE INDEX IF NOT EXISTS idx_students_lead_source ON students(lead_source);
  CREATE INDEX IF NOT EXISTS idx_students_created_at  ON students(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_students_name_trgm   ON students USING gin (student_name gin_trgm_ops);

  -- ---------- Teachers ----------
  CREATE TABLE IF NOT EXISTS teachers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id  UUID UNIQUE REFERENCES accounts(id) ON DELETE SET NULL,
    full_name   TEXT NOT NULL,
    title       TEXT,
    bio         TEXT,
    subjects    TEXT[] NOT NULL DEFAULT '{}',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- ---------- Class offerings ----------
  -- Catalog the student selects from on course-selection.html.
  CREATE TABLE IF NOT EXISTS class_offerings (
    id           TEXT PRIMARY KEY,                     -- stable slug e.g. ai-fund-mon-16
    course_name  JSONB NOT NULL,                       -- { zh, en }
    level        JSONB NOT NULL,
    teacher_id   UUID REFERENCES teachers(id) ON DELETE SET NULL,
    class_mode   TEXT NOT NULL CHECK (class_mode IN ('small','1v1','group')),
    day_key      TEXT NOT NULL CHECK (day_key IN ('mon','tue','wed','thu','fri','sat','sun')),
    slot_key     TEXT NOT NULL,
    weekday      JSONB NOT NULL,
    time_slot    TEXT NOT NULL,
    seats_total  INTEGER NOT NULL DEFAULT 6,
    seats_taken  INTEGER NOT NULL DEFAULT 0,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (seats_taken >= 0 AND seats_taken <= seats_total)
  );
  CREATE INDEX IF NOT EXISTS idx_offerings_day ON class_offerings(day_key, slot_key);

  -- ---------- Trial leads ----------
  CREATE TABLE IF NOT EXISTS trial_leads (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id    UUID REFERENCES students(id) ON DELETE CASCADE,
    student_name  TEXT,
    parent_name   TEXT,
    email         CITEXT,
    phone         TEXT NOT NULL,
    city          TEXT,
    grade         TEXT,
    subject       TEXT,
    subject_label TEXT,
    trial_date    DATE,
    trial_time    TEXT,
    channel       TEXT,
    channel_label TEXT,
    goal          TEXT,
    time_note     TEXT,
    consent       BOOLEAN NOT NULL DEFAULT FALSE,
    metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_trial_leads_student ON trial_leads(student_id);
  CREATE INDEX IF NOT EXISTS idx_trial_leads_date    ON trial_leads(created_at DESC);

  -- ---------- Assessments ----------
  CREATE TABLE IF NOT EXISTS assessments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id          UUID REFERENCES students(id) ON DELETE CASCADE,
    quiz_score          INTEGER CHECK (quiz_score BETWEEN 0 AND 100),
    level               TEXT,
    goal                TEXT,
    notes               TEXT,
    recommended_course  TEXT,
    assessment_data     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_assessments_student ON assessments(student_id);

  -- ---------- Payments ----------
  CREATE TABLE IF NOT EXISTS payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID REFERENCES students(id) ON DELETE SET NULL,
    amount          NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    currency        CHAR(3) NOT NULL DEFAULT 'USD',
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','succeeded','failed','refunded','cancelled')),
    payment_method  TEXT,
    provider        TEXT,                              -- stripe, manual, wechat, etc.
    transaction_id  TEXT UNIQUE,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
  CREATE INDEX IF NOT EXISTS idx_payments_status  ON payments(status);
  CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at DESC);

  -- ---------- Membership orders ----------
  CREATE TABLE IF NOT EXISTS membership_orders (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id        UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    tier              TEXT NOT NULL,
    plan              TEXT,
    class_mode        TEXT,
    billing_cycle     TEXT NOT NULL CHECK (billing_cycle IN ('monthly','quarterly','annual')),
    time_preferences  JSONB NOT NULL DEFAULT '{}'::jsonb,
    add_ons           JSONB NOT NULL DEFAULT '[]'::jsonb,
    sessions          JSONB NOT NULL DEFAULT '[]'::jsonb,  -- chosen offerings snapshot
    total_amount      NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
    currency          CHAR(3) NOT NULL DEFAULT 'USD',
    status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('pending','active','paused','cancelled','expired')),
    starts_at         TIMESTAMPTZ,
    ends_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_memberships_student ON membership_orders(student_id);
  CREATE INDEX IF NOT EXISTS idx_memberships_status  ON membership_orders(status);

  -- ---------- Enrollments (order ↔ offering) ----------
  CREATE TABLE IF NOT EXISTS enrollments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_id   UUID NOT NULL REFERENCES membership_orders(id) ON DELETE CASCADE,
    student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    offering_id     TEXT NOT NULL REFERENCES class_offerings(id) ON DELETE RESTRICT,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','dropped','completed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (membership_id, offering_id)
  );
  CREATE INDEX IF NOT EXISTS idx_enrollments_student  ON enrollments(student_id);
  CREATE INDEX IF NOT EXISTS idx_enrollments_offering ON enrollments(offering_id);

  -- ---------- Class sessions (scheduled occurrences) ----------
  CREATE TABLE IF NOT EXISTS sessions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_id    TEXT REFERENCES class_offerings(id) ON DELETE SET NULL,
    student_id     UUID REFERENCES students(id) ON DELETE CASCADE,
    teacher_id     UUID REFERENCES teachers(id) ON DELETE SET NULL,
    course_name    TEXT,
    session_date   DATE NOT NULL,
    start_time     TIME NOT NULL,
    end_time       TIME NOT NULL,
    status         TEXT NOT NULL DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled','completed','cancelled','rescheduled','no_show')),
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_time > start_time)
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_date    ON sessions(session_date);
  CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(student_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_status  ON sessions(status);

  -- ---------- Feedback ----------
  CREATE TABLE IF NOT EXISTS feedback (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id    UUID REFERENCES students(id) ON DELETE CASCADE,
    session_id    UUID REFERENCES sessions(id)  ON DELETE SET NULL,
    type          TEXT NOT NULL CHECK (type IN ('progress','parent','semester','trial')),
    subject       TEXT,
    rating        INTEGER CHECK (rating BETWEEN 1 AND 5),
    highlights    TEXT,
    suggestion    TEXT,
    next_step     TEXT,
    content       TEXT,
    metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_feedback_student ON feedback(student_id);
  CREATE INDEX IF NOT EXISTS idx_feedback_type    ON feedback(type);

  -- ---------- Schedule change requests (leave / reschedule) ----------
  CREATE TABLE IF NOT EXISTS schedule_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    session_id      UUID REFERENCES sessions(id) ON DELETE SET NULL,
    request_type    TEXT NOT NULL CHECK (request_type IN ('leave','reschedule')),
    target_label    TEXT,
    reason          TEXT NOT NULL,
    requested_date  DATE,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','completed','cancelled')),
    admin_notes     TEXT,
    handled_by      UUID REFERENCES accounts(id) ON DELETE SET NULL,
    handled_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_requests_student ON schedule_requests(student_id);
  CREATE INDEX IF NOT EXISTS idx_requests_status  ON schedule_requests(status);
  CREATE INDEX IF NOT EXISTS idx_requests_created ON schedule_requests(created_at DESC);

  -- ---------- Refresh tokens (rotating, revocable) ----------
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    token_hash  TEXT UNIQUE NOT NULL,
    user_agent  TEXT,
    ip_address  INET,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    replaced_by UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_refresh_account ON refresh_tokens(account_id);
  CREATE INDEX IF NOT EXISTS idx_refresh_expires ON refresh_tokens(expires_at);

  -- ---------- Email outbox ----------
  CREATE TABLE IF NOT EXISTS email_outbox (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    to_email    CITEXT NOT NULL,
    subject     TEXT NOT NULL,
    body        TEXT NOT NULL,
    template    TEXT,
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    status      TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','sent','failed')),
    error       TEXT,
    sent_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_email_status ON email_outbox(status);

  -- ---------- Audit log ----------
  CREATE TABLE IF NOT EXISTS audit_logs (
    id            BIGSERIAL PRIMARY KEY,
    account_id    UUID REFERENCES accounts(id) ON DELETE SET NULL,
    action        TEXT NOT NULL,
    resource      TEXT,
    resource_id   TEXT,
    ip_address    INET,
    user_agent    TEXT,
    metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_audit_account ON audit_logs(account_id);
  CREATE INDEX IF NOT EXISTS idx_audit_action  ON audit_logs(action);
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
`;

// Attach the updated_at trigger to every mutable table.
const TOUCHED_TABLES = [
  'accounts', 'students', 'teachers', 'class_offerings',
  'payments', 'membership_orders', 'enrollments', 'sessions', 'schedule_requests'
];

function triggerSql(table) {
  return `
    DROP TRIGGER IF EXISTS ${table}_touch ON ${table};
    CREATE TRIGGER ${table}_touch
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `;
}

async function run() {
  const client = await pool.connect();
  const started = Date.now();
  try {
    if (RESET) {
      console.log('[migrate] --reset: dropping public schema');
      await client.query(SQL_RESET);
    }

    await client.query('BEGIN');
    await client.query(SQL_EXTENSIONS);
    // pg_trgm needs a separate statement (it is non-transactional on some servers
    // but CREATE EXTENSION IF NOT EXISTS is fine inside a transaction on modern PG).
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm";`);
    await client.query(SQL_TOUCH_FN);
    await client.query(SQL_TABLES);
    for (const table of TOUCHED_TABLES) {
      await client.query(triggerSql(table));
    }
    await client.query('COMMIT');
    console.log(`[migrate] ok in ${Date.now() - started}ms`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[migrate] failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
