'use strict';

const crypto = require('crypto');

/**
 * Human-readable student code — matches the frontend format in
 * `assets/minddo-flow.js` (`MDYYYY-MMDD-HHmm`) plus a 3-digit disambiguator so
 * two students created in the same minute don't collide.
 */
function createStudentCode(now = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  const y = now.getUTCFullYear();
  const m = pad(now.getUTCMonth() + 1);
  const d = pad(now.getUTCDate());
  const hh = pad(now.getUTCHours());
  const mm = pad(now.getUTCMinutes());
  const rand = crypto.randomInt(0, 1000).toString().padStart(3, '0');
  return `MD${y}-${m}${d}-${hh}${mm}-${rand}`;
}

module.exports = { createStudentCode };
