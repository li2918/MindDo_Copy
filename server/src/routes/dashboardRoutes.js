'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');
const { authorize, STAFF_ROLES } = require('../middleware/roles');

router.use(authenticate, authorize(...STAFF_ROLES));

router.get('/overview', asyncHandler(ctrl.overview));

module.exports = router;
