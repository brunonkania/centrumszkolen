// src/app.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { env } from './config/env.js';
import authRouter from './routes/auth.js';
import coursesRouter from './routes/courses.js';
import progressRouter from './routes/progress.js';
import purchaseRouter from './routes/purchase.js';
import { notFound, errorHandler } from './middleware/error.js';

const app = express();

/**
 * Jeśli kiedyś uruchomisz za proxy (np. Docker/Nginx/Render/Heroku),
 * odkomentuj poniższe, aby poprawnie działały ciasteczka Secure:
 */
// if (env.COOKIE_SECURE) app.set('trust proxy', 1);

// Bezpieczne nagłówki (CSP dopasujesz później, gdy ustalisz dokładne źródła skryptów/stylów)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS – dopuszczamy wyłącznie front z FRONT_URL i przekazujemy ciasteczka
app.use(
  cors({
    origin: env.FRONT_URL,
    credentials: true,
  })
);

// Kompresja odpowiedzi
app.use(compression());

// Parsowanie ciała żądania
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// ----------------- ROUTERY API -----------------
app.use('/auth', authRouter);
app.use('/courses', coursesRouter);
app.use('/progress', progressRouter);
app.use('/purchase', purchaseRouter);

// 404 + globalny handler błędów (na końcu łańcucha)
app.use(notFound);
app.use(errorHandler);

export default app;
