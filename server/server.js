'use strict';

const app = require('./src/app');
const config = require('./src/config/env');
const logger = require('./src/utils/logger');
const db = require('./src/database');

const server = app.listen(config.port, () => {
  logger.info('api listening', { port: config.port, env: config.env, prefix: config.apiPrefix });
});

// Graceful shutdown — stop accepting new connections, finish in-flight requests,
// then close the DB pool. SIGTERM is sent by PaaS platforms (Render, Fly,
// Kubernetes, etc.) before killing the process.
function shutdown(signal) {
  return async () => {
    logger.info('shutdown: received signal', { signal });
    server.close(async err => {
      if (err) {
        logger.error('server close error', { message: err.message });
        process.exit(1);
      }
      try {
        await db.close();
        logger.info('shutdown: clean');
        process.exit(0);
      } catch (e) {
        logger.error('db close error', { message: e.message });
        process.exit(1);
      }
    });
    setTimeout(() => {
      logger.warn('shutdown: timeout, forcing exit');
      process.exit(1);
    }, 15_000).unref();
  };
}

process.on('SIGTERM', shutdown('SIGTERM'));
process.on('SIGINT',  shutdown('SIGINT'));

process.on('uncaughtException', err => {
  logger.error('uncaughtException', { message: err.message, stack: err.stack });
  process.exit(1);
});
process.on('unhandledRejection', reason => {
  logger.error('unhandledRejection', { reason: String(reason) });
});
