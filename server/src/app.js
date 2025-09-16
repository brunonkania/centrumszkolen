// src/app.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';

import { securityHeaders, csrfProtection, issueCsrfCookie, apiLimiter } from './middleware/security.js';
import { attachUserFromAccessCookie } from './middleware/auth.js';

// Routers
import authRouter from './routes/auth.js';
import catalogRouter from './routes/catalog.js';
import coursesRouter from './routes/courses.js';
import modulesRouter from './routes/modules.js';
import progressRouter from './routes/progress.js';
import quizRouter from './routes/quiz.js';
import certificatesRouter from './routes/certificates.js';
import paymentsRouter from './routes/payments.js';
import guestRouter from './routes/guest.js';
import certificatesPublicRouter from './routes/certificates-public.js'; // ⬅️ NOWOŚĆ

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ----------------------------- CORS (dev) ----------------------------- */
const allowed = new Set([
  process.env.FRONT_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  // jeśli serwujesz przez nginx:8080 i front wywołuje bez proxy, dodaj poniżej
  'http://localhost:8080',
  'http://127.0.0.1:8080',
]);

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    if (origin && allowed.has(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Headers', 'Content-Type, x-csrf-token, Authorization');
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    }
    return res.sendStatus(204);
  }
  const origin = req.headers.origin;
  if (origin && allowed.has(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  next();
});

/* ----------------------------- Parsers/Logs ---------------------------- */
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());
app.use(compression());
app.use(securityHeaders);
app.use(attachUserFromAccessCookie);

/* --------------------------------- CSRF --------------------------------- */
app.get('/csrf', (req, res) => {
  const token = issueCsrfCookie(res);
  res.json({ csrf: token });
});

/* --------------------------------- API ---------------------------------- */
// Auth (mutacje → CSRF + limiter)
app.use('/auth', apiLimiter, csrfProtection, authRouter);

// Publiczny katalog (GET)
app.use('/catalog', catalogRouter);

// Guest checkout (bez CSRF na GET /guest/access)
app.use('/guest', guestRouter);

// 🔓 Publiczna weryfikacja certyfikatu (BEZ CSRF/BEZ AUTH)
app.use('/certificates', certificatesPublicRouter);

// Kursy użytkownika, moduły, progres, quizy, płatności, certyfikaty (WYMAGAJĄ CSRF)
app.use('/courses', apiLimiter, csrfProtection, coursesRouter);
app.use('/modules', apiLimiter, csrfProtection, modulesRouter);
app.use('/progress', apiLimiter, csrfProtection, progressRouter);
app.use('/quiz', apiLimiter, csrfProtection, quizRouter);
app.use('/payments', apiLimiter, csrfProtection, paymentsRouter);
app.use('/certificates', apiLimiter, csrfProtection, certificatesRouter);

/* --------------------------------- 404 ---------------------------------- */
app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND' });
});

/* ------------------------------ Error handler --------------------------- */
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message =
    process.env.NODE_ENV === 'development' ? (err.message || String(err)) : undefined;

  if (process.env.NODE_ENV !== 'test') {
    console.error(err);
  }

  res.status(status).json({ error: code, message });
});

export default app;
