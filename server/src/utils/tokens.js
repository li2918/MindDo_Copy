'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

function signAccessToken(payload) {
  return jwt.sign(payload, config.auth.accessSecret, {
    expiresIn: config.auth.accessExpiresIn,
    issuer: 'minddo-api',
    audience: 'minddo-web'
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.auth.accessSecret, {
    issuer: 'minddo-api',
    audience: 'minddo-web'
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, config.auth.refreshSecret, {
    expiresIn: config.auth.refreshExpiresIn,
    issuer: 'minddo-api',
    audience: 'minddo-web-refresh'
  });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, config.auth.refreshSecret, {
    issuer: 'minddo-api',
    audience: 'minddo-web-refresh'
  });
}

/** Hash refresh tokens before storing so DB leaks don't expose live sessions. */
function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Parse a "15m" / "30d" / "2h" string to milliseconds. Used when translating
 * `expiresIn` into a concrete `expires_at` timestamp for the refresh_tokens row.
 */
function durationToMs(expr) {
  const m = /^(\d+)([smhd])$/.exec(String(expr).trim());
  if (!m) throw new Error(`Invalid duration: ${expr}`);
  const n = Number(m[1]);
  const unit = m[2];
  const mult = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return n * mult;
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
  durationToMs
};
