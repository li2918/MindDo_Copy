'use strict';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const active = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function emit(level, msg, meta) {
  if (LEVELS[level] > active) return;
  const entry = {
    t: new Date().toISOString(),
    level,
    msg,
    ...(meta ? { meta } : {})
  };
  const line = JSON.stringify(entry);
  if (level === 'error') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

module.exports = {
  error: (msg, meta) => emit('error', msg, meta),
  warn:  (msg, meta) => emit('warn',  msg, meta),
  info:  (msg, meta) => emit('info',  msg, meta),
  debug: (msg, meta) => emit('debug', msg, meta)
};
