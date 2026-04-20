'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/sessionController');
const { authenticate } = require('../middleware/auth');
const { authorize, INTERNAL_ROLES } = require('../middleware/roles');
const { validate, schemas } = require('../middleware/validation');

router.use(authenticate);

router.get('/',                       asyncHandler(ctrl.list));
router.post('/',                      authorize(...INTERNAL_ROLES),
                                      validate(schemas.session),
                                      asyncHandler(ctrl.create));
router.patch('/:id/status',           authorize(...INTERNAL_ROLES),
                                      asyncHandler(ctrl.updateStatus));

module.exports = router;
