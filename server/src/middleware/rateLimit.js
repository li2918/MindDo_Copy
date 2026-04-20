'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config/env');

const defaults = {
  windowMs: config.rateLimit.windowMs,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many requests' } }
};

const apiLimiter = rateLimit({ ...defaults, max: config.rateLimit.max });

// Tighter limiter specifically for credential-sensitive endpoints.
const authLimiter = rateLimit({
  ...defaults,
  max: config.rateLimit.authMax,
  windowMs: 15 * 60 * 1000, // 15 min window for login/register/refresh
  skipSuccessfulRequests: true
});

module.exports = { apiLimiter, authLimiter };
