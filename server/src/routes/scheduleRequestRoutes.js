'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/scheduleRequestController');
const { authenticate } = require('../middleware/auth');
const { authorize, STAFF_ROLES } = require('../middleware/roles');
const { validate, schemas } = require('../middleware/validation');

router.use(authenticate);

router.post('/',                validate(schemas.scheduleRequest), asyncHandler(ctrl.create));
router.get ('/',                asyncHandler(ctrl.list));
router.patch('/:id/status',     authorize(...STAFF_ROLES),
                                validate(schemas.scheduleRequestStatus),
                                asyncHandler(ctrl.updateStatus));
router.post ('/:id/cancel',     asyncHandler(ctrl.cancel));

module.exports = router;
