'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const config = require('./config/env');
const logger = require('./utils/logger');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimit');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', config.trustProxy);
app.disable('x-powered-by');

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false // CSP belongs on the static site layer
}));

app.use(cors({
  origin(origin, cb) {
    // Allow same-origin / curl (no Origin header) and anything on the allowlist.
    if (!origin) return cb(null, true);
    if (config.cors.origins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
  maxAge: 600
}));

app.use(compression());
app.use(express.json({ limit: config.bodyLimit }));
app.use(express.urlencoded({ extended: false, limit: config.bodyLimit }));
app.use(cookieParser());

if (!config.isProd) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: line => logger.info('http', { line: line.trim() }) }
  }));
}

app.use(config.apiPrefix, apiLimiter, routes);

app.get('/', (_req, res) => {
  res.json({ name: 'minddo-api', status: 'ok', docs: `${config.apiPrefix}/health` });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
