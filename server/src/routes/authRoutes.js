'use strict';

const router = require('express').Router();
const Joi = require('joi');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimit');

const logoutSchema = Joi.object({ refreshToken: Joi.string().optional() });

router.post('/register', authLimiter, validate(schemas.register), asyncHandler(ctrl.register));
router.post('/login',    authLimiter, validate(schemas.login),    asyncHandler(ctrl.login));
router.post('/refresh',  authLimiter, validate(schemas.refresh),  asyncHandler(ctrl.refresh));
router.post('/logout',                 validate(logoutSchema),    asyncHandler(ctrl.logout));
router.get ('/me',       authenticate, asyncHandler(ctrl.me));

module.exports = router;
