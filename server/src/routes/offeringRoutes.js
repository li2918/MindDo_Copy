'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/offeringController');
const { optionalAuth, authenticate } = require('../middleware/auth');
const { authorize, STAFF_ROLES } = require('../middleware/roles');
const { validate, schemas } = require('../middleware/validation');

// Public read — course-selection.html renders this for anonymous visitors.
router.get('/',      optionalAuth, asyncHandler(ctrl.list));
router.get('/:id',   optionalAuth, asyncHandler(ctrl.getById));

router.post  ('/',     authenticate, authorize(...STAFF_ROLES),
                       validate(schemas.offering), asyncHandler(ctrl.upsert));
router.put   ('/:id',  authenticate, authorize(...STAFF_ROLES),
                       validate(schemas.offering), asyncHandler(ctrl.upsert));
router.delete('/:id',  authenticate, authorize(...STAFF_ROLES), asyncHandler(ctrl.remove));

module.exports = router;
