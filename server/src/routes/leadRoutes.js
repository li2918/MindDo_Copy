'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/leadController');
const { optionalAuth, authenticate } = require('../middleware/auth');
const { authorize, STAFF_ROLES } = require('../middleware/roles');
const { validate, schemas } = require('../middleware/validation');

// Public intake — anyone visiting trial.html can submit. optionalAuth lets
// logged-in users attach to their own record.
router.post('/', optionalAuth, validate(schemas.trialLead), asyncHandler(ctrl.create));

router.get ('/',      authenticate, authorize(...STAFF_ROLES), asyncHandler(ctrl.list));
router.get ('/:id',   authenticate, authorize(...STAFF_ROLES), asyncHandler(ctrl.getById));

module.exports = router;
