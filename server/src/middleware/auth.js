'use strict';

const { verifyAccessToken } = require('../utils/tokens');
const { ApiError } = require('../utils/errors');

function extractToken(req) {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) return h.slice(7).trim();
  return null;
}

function authenticate(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next(ApiError.unauthorized('Access token required'));
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      accountId: payload.sub,
      role: payload.role,
      studentId: payload.studentId || null,
      email: payload.email
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return next(ApiError.unauthorized('Access token expired'));
    return next(ApiError.unauthorized('Invalid access token'));
  }
}

function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      accountId: payload.sub,
      role: payload.role,
      studentId: payload.studentId || null,
      email: payload.email
    };
  } catch (_) { /* ignore — treat as anonymous */ }
  next();
}

module.exports = { authenticate, optionalAuth };
