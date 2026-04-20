'use strict';

const bcrypt = require('bcryptjs');
const config = require('../config/env');

async function hash(plain) {
  return bcrypt.hash(plain, config.auth.bcryptRounds);
}

async function verify(plain, hashed) {
  if (!plain || !hashed) return false;
  return bcrypt.compare(plain, hashed);
}

module.exports = { hash, verify };
