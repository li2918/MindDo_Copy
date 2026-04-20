'use strict';

const { ApiError } = require('../utils/errors');
const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  // Postgres error codes → HTTP mapping.
  // PG codes are 5-char strings of A-Z0-9 (SQLSTATE), e.g. 23505, 22P02.
  if (err && typeof err.code === 'string' && /^[A-Z0-9]{5}$/.test(err.code)) {
    if (err.code === '23505') err = ApiError.conflict('Duplicate value', { constraint: err.constraint });
    else if (err.code === '23503') err = ApiError.badRequest('Related record missing', { constraint: err.constraint });
    else if (err.code === '23502') err = ApiError.badRequest('Missing required column', { column: err.column });
    else if (err.code === '22P02') err = ApiError.badRequest('Invalid input syntax');
  }

  // JSON body parse errors from express.json()
  if (err.type === 'entity.parse.failed') {
    err = ApiError.badRequest('Invalid JSON body');
  }

  if (!(err instanceof ApiError)) {
    logger.error('unhandled error', {
      message: err.message,
      stack: err.stack,
      path: req.originalUrl,
      method: req.method
    });
    err = ApiError.internal(process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message);
  } else if (err.status >= 500) {
    logger.error('api error', { code: err.code, message: err.message });
  }

  const body = {
    error: {
      code: err.code,
      message: err.message
    }
  };
  if (err.details) body.error.details = err.details;
  res.status(err.status).json(body);
}

function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

module.exports = { errorHandler, notFoundHandler };
