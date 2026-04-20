'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

function required(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function asNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (Number.isNaN(n)) throw new Error(`Env var ${name} must be a number (got ${raw})`);
  return n;
}

function asBool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw === 'true' || raw === '1';
}

function asList(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';

const config = {
  env,
  isProd,
  port: asNumber('PORT', 3001),
  apiPrefix: process.env.API_PREFIX || '/api',
  trustProxy: asNumber('TRUST_PROXY', 1),
  bodyLimit: process.env.REQUEST_BODY_LIMIT || '1mb',
  logLevel: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),

  db: {
    host: required('DB_HOST', 'localhost'),
    port: asNumber('DB_PORT', 5432),
    database: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    ssl: asBool('DB_SSL', false),
    max: asNumber('DB_POOL_MAX', 20),
    idleTimeoutMillis: asNumber('DB_IDLE_TIMEOUT_MS', 30000),
    connectionTimeoutMillis: asNumber('DB_CONNECTION_TIMEOUT_MS', 5000)
  },

  auth: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    bcryptRounds: asNumber('BCRYPT_ROUNDS', 12)
  },

  cors: {
    origins: asList('CORS_ORIGINS', ['http://localhost:8123'])
  },

  rateLimit: {
    windowMs: asNumber('RATE_LIMIT_WINDOW_MS', 60_000),
    max: asNumber('RATE_LIMIT_MAX', 300),
    authMax: asNumber('AUTH_RATE_LIMIT_MAX', 20)
  },

  admin: {
    bootstrapEmail: process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@minddo.local',
    bootstrapPassword: process.env.ADMIN_BOOTSTRAP_PASSWORD || 'Admin!2026'
  }
};

if (isProd) {
  const weakSecrets = [config.auth.accessSecret, config.auth.refreshSecret].some(s =>
    !s || s.length < 32 || s.startsWith('dev_')
  );
  if (weakSecrets) {
    throw new Error('JWT secrets are too weak for production. Provide 32+ char random strings.');
  }
}

module.exports = config;
