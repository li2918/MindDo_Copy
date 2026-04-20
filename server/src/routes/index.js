'use strict';

const router = require('express').Router();
const db = require('../database');

router.use('/auth',              require('./authRoutes'));
router.use('/students',          require('./studentRoutes'));
router.use('/trial-leads',       require('./leadRoutes'));
router.use('/assessments',       require('./assessmentRoutes'));
router.use('/payments',          require('./paymentRoutes'));
router.use('/memberships',       require('./membershipRoutes'));
router.use('/feedback',          require('./feedbackRoutes'));
router.use('/schedule-requests', require('./scheduleRequestRoutes'));
router.use('/offerings',         require('./offeringRoutes'));
router.use('/sessions',          require('./sessionRoutes'));
router.use('/dashboard',         require('./dashboardRoutes'));

router.get('/health', async (_req, res) => {
  const ok = await db.healthCheck().catch(() => false);
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    db: ok,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
