'use strict';

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/studentController');
const { authenticate } = require('../middleware/auth');
const { authorize, STAFF_ROLES } = require('../middleware/roles');
const { validate, schemas } = require('../middleware/validation');

router.use(authenticate);

// Student-self shortcut.
router.get('/me',              asyncHandler(ctrl.snapshot));

router.get('/',                authorize(...STAFF_ROLES), asyncHandler(ctrl.list));
router.get('/:id',             asyncHandler(ctrl.getById));
router.get('/:id/snapshot',    asyncHandler(ctrl.snapshot));
router.patch('/:id', validate(schemas.updateStudent), asyncHandler(ctrl.update));

module.exports = router;
