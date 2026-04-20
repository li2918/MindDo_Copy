'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/membershipController');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

router.use(authenticate);

router.post('/',              validate(schemas.membership), asyncHandler(ctrl.create));
router.get ('/',              asyncHandler(ctrl.list));
router.get ('/:id',           asyncHandler(ctrl.getById));
router.post('/:id/cancel',    asyncHandler(ctrl.cancel));

module.exports = router;
