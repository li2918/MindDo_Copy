'use strict';

/**
 * Wrap an async Express handler so rejected promises reach the error middleware
 * without needing a try/catch in every controller.
 */
module.exports = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
