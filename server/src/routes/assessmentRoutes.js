'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/assessmentController');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

router.use(authenticate);

router.post('/',    validate(schemas.assessment), asyncHandler(ctrl.create));
router.get ('/',    asyncHandler(ctrl.list));
router.get ('/:id', asyncHandler(ctrl.getById));

module.exports = router;
