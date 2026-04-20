'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/feedbackController');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

router.use(authenticate);

router.post('/', validate(schemas.feedback), asyncHandler(ctrl.create));
router.get ('/', asyncHandler(ctrl.list));

module.exports = router;
