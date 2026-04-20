# MindDo Backend API

Production-grade REST API for the MindDo education platform. Replaces the
localStorage-only prototype with a real persistence tier, authenticated
sessions, role-based access control, and the endpoints the existing HTML pages
need to move off `assets/minddo-flow.js`.

## Stack

- Node.js 18+ / Express 4
- PostgreSQL 14+ (uses `pgcrypto`, `citext`, `pg_trgm`)
- JWT access tokens (15 min) + rotating refresh tokens (30 days, hashed at rest)
- bcrypt password hashing (12 rounds)
- Joi request validation, Helmet, CORS allowlist, rate limiting, gzip compression

## Project layout

```
server/
├── server.js                 # HTTP bootstrap + graceful shutdown
├── scripts/
│   ├── migrate.js            # idempotent schema migration (`--reset` supported)
│   └── seed.js               # demo data matching the frontend prototype
└── src/
    ├── app.js                # Express app: middleware + routes + error handlers
    ├── config/env.js         # typed env loader + production safety checks
    ├── database.js           # pg pool, transaction helper, health check
    ├── controllers/          # one per domain
    ├── middleware/           # auth, roles, validation, rate-limit, errors
    ├── routes/               # one router per resource, mounted under /api
    └── utils/                # logger, errors, tokens, password, pagination, ids
```

## Getting started

### 1. Install

```bash
cd server
npm install
```

### 2. Database

Install PostgreSQL locally and create the role + database listed in `.env`:

```sql
CREATE ROLE minddo_user WITH LOGIN PASSWORD 'secure_password';
CREATE DATABASE minddo_db OWNER minddo_user;
```

### 3. Configure

```bash
cp .env.example .env
# Fill in DB_* and, for production, regenerate JWT_* secrets:
#   openssl rand -hex 64
```

### 4. Migrate + seed

```bash
npm run migrate        # idempotent — safe to re-run
npm run seed           # wipes domain tables and re-loads demo data
# one-shot reset:
npm run db:reset
```

### 5. Run

```bash
npm run dev            # nodemon
npm start              # production
```

The API is served at `http://localhost:3001/api`. Health probe:
`GET /api/health`.

Default credentials after `npm run seed`:

| Role    | Email                 | Password       |
| ------- | --------------------- | -------------- |
| admin   | `admin@minddo.local`  | `Admin!2026`   |
| student | `leo.li@example.com`  | `Student!2026` |

## Authentication

```
POST /api/auth/register      Public — create account + student profile
POST /api/auth/login         Public — returns { accessToken, refreshToken }
POST /api/auth/refresh       Public — rotating refresh; reuse revokes chain
POST /api/auth/logout        Public — revokes the presented refresh token
GET  /api/auth/me            Auth   — current account + student profile
```

Every authenticated request needs `Authorization: Bearer <accessToken>`.

## Resources

| Method + path                                  | Who               | Purpose                                |
| ---------------------------------------------- | ----------------- | -------------------------------------- |
| `GET    /api/students`                         | staff / admin     | list + search (q, status, stage, source) |
| `GET    /api/students/me`                      | student           | own full snapshot                      |
| `GET    /api/students/:id`                     | self or staff     | single student                         |
| `GET    /api/students/:id/snapshot`            | self or staff     | aggregated snapshot                    |
| `PATCH  /api/students/:id`                     | self or staff     | update profile                         |
| `POST   /api/trial-leads`                      | public            | trial form intake                      |
| `GET    /api/trial-leads`                      | staff / admin     | list leads                             |
| `POST   /api/assessments`                      | student / staff   | save assessment                        |
| `GET    /api/assessments`                      | scoped to caller  | list                                   |
| `POST   /api/payments`                         | student / staff   | record payment                         |
| `GET    /api/payments`                         | scoped to caller  | list                                   |
| `PATCH  /api/payments/:id/status`              | staff / admin     | refund / cancel / etc.                 |
| `POST   /api/memberships`                      | student / staff   | create order + enrollments (atomic)    |
| `GET    /api/memberships`                      | scoped to caller  | list                                   |
| `GET    /api/memberships/:id`                  | self or staff     | order detail + enrollments             |
| `POST   /api/memberships/:id/cancel`           | self or staff     | cancel + release seats                 |
| `POST   /api/feedback`                         | student / staff   | progress, parent, semester, trial      |
| `GET    /api/feedback`                         | scoped to caller  | list                                   |
| `POST   /api/schedule-requests`                | student / staff   | leave / reschedule                     |
| `GET    /api/schedule-requests`                | scoped to caller  | list                                   |
| `PATCH  /api/schedule-requests/:id/status`     | staff / admin     | approve / reject / complete            |
| `POST   /api/schedule-requests/:id/cancel`     | student           | cancel own pending request             |
| `GET    /api/offerings`                        | public            | class catalog                          |
| `POST   /api/offerings`                        | staff / admin     | upsert (PUT same path also works)      |
| `DELETE /api/offerings/:id`                    | staff / admin     | remove                                 |
| `GET    /api/sessions`                         | scoped to caller  | scheduled classes                      |
| `POST   /api/sessions`                         | internal          | create                                 |
| `PATCH  /api/sessions/:id/status`              | internal          | mark completed / cancelled / no-show   |
| `GET    /api/dashboard/overview`               | staff / admin     | everything `dashboard.html` needs      |

## Response shape

```jsonc
// success
{ "data": { ... } }
{ "data": [ ... ], "pagination": { "page": 1, "limit": 20, "total": 137, "totalPages": 7 } }

// error
{ "error": { "code": "unprocessable", "message": "Validation failed", "details": [ ... ] } }
```

Postgres errors are translated to HTTP equivalents (`23505` → 409, `23503` →
400, etc.) by the central error handler.

## Security highlights

- Passwords stored as bcrypt hashes (rounds configurable).
- Refresh tokens hashed with SHA-256 before storage; on reuse the whole chain
  for that account is revoked (`replaced_by` linkage).
- JWTs carry `iss` / `aud` and are verified on every request; tight 15-min
  access window limits blast radius if leaked.
- `helmet`, strict CORS allowlist, and two-tier rate limiting (general +
  stricter on `/auth/*`).
- Joi validation strips unknown keys before anything touches SQL; all queries
  use parameterised `$1…$N` placeholders.
- Role-based authorisation (`student`, `parent`, `teacher`, `staff`, `admin`)
  with per-route gates and row-level ownership checks.
- Production guardrail: `NODE_ENV=production` refuses to boot if JWT secrets
  are short or look like the bundled dev defaults.
- Graceful SIGTERM/SIGINT shutdown drains HTTP and closes the pg pool.

## Connecting the existing frontend

The frontend currently persists through `assets/minddo-flow.js`. To migrate
incrementally, replace the relevant `MindDoFlow.*` helpers with `fetch`
calls against the matching endpoint above. Suggested order:

1. `saveLead`                    → `POST /api/trial-leads`
2. `saveSignupUser` + login      → `POST /api/auth/register` / `login`
3. `saveAssessment`              → `POST /api/assessments`
4. `saveMembershipOrder`         → `POST /api/memberships`
5. `saveFeedback`                → `POST /api/feedback`
6. `saveScheduleRequest` / update → `POST /api/schedule-requests` and `PATCH …/status`
7. Dashboard widgets              → `GET /api/dashboard/overview`

`MindDoFlow.getSnapshot()` maps directly to `GET /api/students/me`.

## Testing

```bash
npm test
```

`jest` + `supertest` are pre-installed. Tests have not been authored yet — add
them alongside any feature you ship.
