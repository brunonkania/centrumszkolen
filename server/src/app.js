import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import * as Sentry from '@sentry/node';
import { Registry, collectDefaultMetrics, Counter } from 'prom-client';

import { attachSecurity, csrfProtection } from './middleware/security.js';
import { requireAuth } from './middleware/auth.js';
import { requireMetricsAuth } from './middleware/metricsAuth.js';

import authRouter from './routes/auth.js';
import catalogRouter from './routes/catalog.js';
import coursesRouter from './routes/courses.js';
import modulesRouter from './routes/modules.js';
import quizRouter from './routes/quiz.js';
import progressRouter from './routes/progress.js';
import certificatesRouter from './routes/certificates.js';
import adminRouter from './routes/admin.js';
import accountRouter from './routes/account.js';
import paymentsRouter from './routes/payments.js';

import { pool } from './db.js';

const app = express();

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
  app.use(Sentry.Handlers.requestHandler());
}

app.use(morgan('tiny'));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// CORS whitelist
const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (corsOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS_BLOCKED'), false);
  },
  credentials: true
}));

attachSecurity(app);

// Metrics
const registry = new Registry();
collectDefaultMetrics({ register: registry });
const httpCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [registry]
});
app.use((req, res, next) => {
  res.on('finish', () => {
    httpCounter.labels(req.method, req.path, String(res.statusCode)).inc();
  });
  next();
});

app.get('/healthz', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'up' });
  } catch (e) {
    res.status(500).json({ ok: false, db: 'down' });
  }
});

// ZABEZPIECZONE /metrics nagłówkiem Bearer
app.get('/metrics', requireMetricsAuth, async (_req, res) => {
  res.setHeader('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});

// Public
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/auth', authRouter);
app.use('/catalog', catalogRouter);

// CSRF dla metod modyfikujących
app.use(csrfProtection);

// Protected
app.use('/courses', requireAuth, coursesRouter);
app.use('/modules', requireAuth, modulesRouter);
app.use('/quiz', requireAuth, quizRouter);
app.use('/progress', requireAuth, progressRouter);
app.use('/certificates', requireAuth, certificatesRouter);
app.use('/admin', requireAuth, adminRouter);
app.use('/account', requireAuth, accountRouter);

// Payments (create wymaga auth; return/notify public)
app.use('/payments', paymentsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.code || 'Internal error' });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`API listening on :${port}`));
