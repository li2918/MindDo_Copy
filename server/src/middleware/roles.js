'use strict';

const { ApiError } = require('../utils/errors');

/**
 * Gate a route to one or more roles.
 *   router.get('/admin', authenticate, authorize('admin', 'staff'), handler)
 */
function authorize(...allowed) {
  const set = new Set(allowed);
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!set.has(req.user.role)) return next(ApiError.forbidden('Insufficient role'));
    next();
  };
}

const STAFF_ROLES = ['admin', 'staff'];
const INTERNAL_ROLES = ['admin', 'staff', 'teacher'];

module.exports = { authorize, STAFF_ROLES, INTERNAL_ROLES };
