'use strict';

const Joi = require('joi');
const { ApiError } = require('../utils/errors');

const opts = { abortEarly: false, stripUnknown: true, convert: true };

function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const { value, error } = schema.validate(req[source], opts);
    if (error) {
      const details = error.details.map(d => ({ field: d.path.join('.'), message: d.message }));
      return next(ApiError.unprocessable('Validation failed', details));
    }
    req[source] = value;
    next();
  };
}

// ---------------- Schemas ----------------

const phone = Joi.string().pattern(/^\+?[\d\s\-()]{6,32}$/).messages({
  'string.pattern.base': 'Phone must contain 6-32 digits / spaces / + - ( )'
});

const register = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  name: Joi.string().min(1).max(255).required(),
  phone: phone.allow('', null),
  grade: Joi.string().max(50).allow('', null),
  parentName: Joi.string().max(255).allow('', null),
  city: Joi.string().max(120).allow('', null),
  leadSource: Joi.string().valid('trial', 'signup', 'referral', 'campaign', 'organic').default('signup'),
  provider: Joi.string().valid('email', 'google', 'microsoft', 'apple').default('email')
});

const login = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(1).max(128).required()
});

const refresh = Joi.object({
  refreshToken: Joi.string().required()
});

const updateStudent = Joi.object({
  studentName: Joi.string().max(255),
  parentName: Joi.string().max(255).allow('', null),
  phone: phone.allow('', null),
  city: Joi.string().max(120).allow('', null),
  grade: Joi.string().max(50).allow('', null),
  birthday: Joi.date().iso().allow(null),
  learningStyle: Joi.string().max(100).allow('', null),
  goal: Joi.string().max(500).allow('', null),
  stage: Joi.string().valid('lead','trial','signup','assessment','payment','membership','feedback','churned'),
  status: Joi.string().valid('NEW','ACTIVE','PAUSED','CHURNED'),
  tags: Joi.array().items(Joi.string().max(50)),
  metadata: Joi.object()
}).min(1);

const trialLead = Joi.object({
  studentName: Joi.string().max(255).allow('', null),
  parentName: Joi.string().max(255).allow('', null),
  email: Joi.string().email().allow('', null),
  phone: phone.required(),
  city: Joi.string().max(120).allow('', null),
  grade: Joi.string().max(50).allow('', null),
  subject: Joi.string().max(120).allow('', null),
  subjectLabel: Joi.string().max(120).allow('', null),
  trialDate: Joi.date().iso().allow(null),
  trialTime: Joi.string().max(20).allow('', null),
  channel: Joi.string().max(60).allow('', null),
  channelLabel: Joi.string().max(120).allow('', null),
  goal: Joi.string().max(500).allow('', null),
  timeNote: Joi.string().max(500).allow('', null),
  consent: Joi.boolean().default(false),
  metadata: Joi.object().default({})
});

const assessment = Joi.object({
  quizScore: Joi.number().integer().min(0).max(100).allow(null),
  level: Joi.string().max(60).allow('', null),
  goal: Joi.string().max(200).allow('', null),
  notes: Joi.string().max(2000).allow('', null),
  recommendedCourse: Joi.string().max(500).allow('', null),
  assessmentData: Joi.object().default({})
});

const payment = Joi.object({
  studentId: Joi.string().uuid().required(),
  amount: Joi.number().positive().precision(2).required(),
  currency: Joi.string().length(3).uppercase().default('USD'),
  paymentMethod: Joi.string().max(100).allow('', null),
  provider: Joi.string().max(50).allow('', null),
  transactionId: Joi.string().max(255).allow('', null),
  status: Joi.string().valid('pending','succeeded','failed','refunded','cancelled').default('succeeded'),
  metadata: Joi.object().default({})
});

const sessionSelection = Joi.object({
  offeringId: Joi.string().max(100).required(),
  courseName: Joi.string().max(255).allow('', null),
  weekday: Joi.string().max(20).allow('', null),
  timeSlot: Joi.string().max(50).allow('', null),
  teacher: Joi.string().max(120).allow('', null),
  classMode: Joi.string().max(20).allow('', null)
}).unknown(true);

const membership = Joi.object({
  tier: Joi.string().max(100).required(),
  plan: Joi.string().max(100).allow('', null),
  classMode: Joi.string().valid('small', '1v1', 'group').allow('', null),
  billingCycle: Joi.string().valid('monthly', 'quarterly', 'annual').required(),
  timePreferences: Joi.object().default({}),
  addOns: Joi.array().items(Joi.string().max(60)).default([]),
  sessions: Joi.array().items(sessionSelection).default([]),
  totalAmount: Joi.number().positive().precision(2).required(),
  currency: Joi.string().length(3).uppercase().default('USD'),
  startsAt: Joi.date().iso().allow(null),
  endsAt: Joi.date().iso().allow(null)
});

const feedback = Joi.object({
  type: Joi.string().valid('progress', 'parent', 'semester', 'trial').required(),
  subject: Joi.string().max(200).allow('', null),
  rating: Joi.number().integer().min(1).max(5).allow(null),
  highlights: Joi.string().max(2000).allow('', null),
  suggestion: Joi.string().max(2000).allow('', null),
  nextStep: Joi.string().max(500).allow('', null),
  content: Joi.string().max(2000).allow('', null),
  sessionId: Joi.string().uuid().allow(null),
  metadata: Joi.object().default({})
});

const scheduleRequest = Joi.object({
  requestType: Joi.string().valid('leave', 'reschedule').required(),
  targetLabel: Joi.string().max(255).allow('', null),
  reason: Joi.string().min(2).max(1000).required(),
  requestedDate: Joi.date().iso().allow(null),
  sessionId: Joi.string().uuid().allow(null)
});

const scheduleRequestStatus = Joi.object({
  status: Joi.string().valid('pending', 'approved', 'rejected', 'completed', 'cancelled').required(),
  adminNotes: Joi.string().max(1000).allow('', null)
});

const offering = Joi.object({
  id: Joi.string().max(100).required(),
  courseName: Joi.object({ zh: Joi.string(), en: Joi.string() }).unknown(true).required(),
  level: Joi.object({ zh: Joi.string(), en: Joi.string() }).unknown(true).required(),
  teacherId: Joi.string().uuid().allow(null),
  classMode: Joi.string().valid('small', '1v1', 'group').required(),
  dayKey: Joi.string().valid('mon','tue','wed','thu','fri','sat','sun').required(),
  slotKey: Joi.string().max(20).required(),
  weekday: Joi.object({ zh: Joi.string(), en: Joi.string() }).unknown(true).required(),
  timeSlot: Joi.string().max(60).required(),
  seatsTotal: Joi.number().integer().min(1).max(200).default(6),
  seatsTaken: Joi.number().integer().min(0).default(0),
  isActive: Joi.boolean().default(true)
});

const session = Joi.object({
  studentId: Joi.string().uuid().required(),
  offeringId: Joi.string().max(100).allow(null),
  teacherId: Joi.string().uuid().allow(null),
  courseName: Joi.string().max(255).allow('', null),
  sessionDate: Joi.date().iso().required(),
  startTime: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).required(),
  endTime: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).required(),
  status: Joi.string().valid('scheduled','completed','cancelled','rescheduled','no_show').default('scheduled'),
  notes: Joi.string().max(1000).allow('', null)
});

module.exports = {
  validate,
  schemas: {
    register,
    login,
    refresh,
    updateStudent,
    trialLead,
    assessment,
    payment,
    membership,
    feedback,
    scheduleRequest,
    scheduleRequestStatus,
    offering,
    session
  }
};
