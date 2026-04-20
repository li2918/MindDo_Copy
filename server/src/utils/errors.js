'use strict';

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    if (details) this.details = details;
    this.isOperational = true;
  }

  static badRequest(msg = 'Bad request', details)        { return new ApiError(400, 'bad_request', msg, details); }
  static unauthorized(msg = 'Authentication required')   { return new ApiError(401, 'unauthorized', msg); }
  static forbidden(msg = 'Forbidden')                    { return new ApiError(403, 'forbidden', msg); }
  static notFound(msg = 'Not found')                     { return new ApiError(404, 'not_found', msg); }
  static conflict(msg = 'Conflict', details)             { return new ApiError(409, 'conflict', msg, details); }
  static unprocessable(msg = 'Unprocessable', details)   { return new ApiError(422, 'unprocessable', msg, details); }
  static tooMany(msg = 'Too many requests')              { return new ApiError(429, 'rate_limited', msg); }
  static internal(msg = 'Internal server error')         { return new ApiError(500, 'internal', msg); }
}

module.exports = { ApiError };
