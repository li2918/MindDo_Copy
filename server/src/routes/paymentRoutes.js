'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');
const { authorize, STAFF_ROLES } = require('../middleware/roles');
const { validate, schemas } = require('../middleware/validation');

router.use(authenticate);

router.post('/',                 validate(schemas.payment), asyncHandler(ctrl.create));
router.get ('/',                 asyncHandler(ctrl.list));
router.patch('/:id/status',      authorize(...STAFF_ROLES), asyncHandler(ctrl.updateStatus));

module.exports = router;
