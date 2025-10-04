import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { security } from './middleware/security.js';
import { errorHandler } from './middleware/error.js';
import { catalogRouter } from './routes/catalog.js';
import { paymentsRouter } from './routes/payments.js';
import { accessRouter } from './routes/access.js';
import { quizRouter } from './routes/quiz.js';
import { recipientRouter } from './routes/recipient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Statyczny front
const WEB_DIR = resolve(__dirname, '../../web');

export function createApp() {
  const app = express();

  app.use(pinoHttp());
  app.use(...security);
  app.use(bodyParser.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Health
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // API
  app.use('/api/catalog', catalogRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/quiz', quizRouter);
  app.use('/api/orders', recipientRouter); // <<<< NOWE

  // Publiczny dostęp po magic linku (SSR)
  app.use('/access', accessRouter);

  // Frontend
  app.use(express.static(WEB_DIR, { extensions: ['html'], index: 'index.html' }));
  app.get('/', (_req, res) => res.sendFile(resolve(WEB_DIR, 'index.html')));

  // 404 (front)
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    try { return res.status(404).sendFile(resolve(WEB_DIR, '404.html')); }
    catch { return res.status(404).send('Not Found'); }
  });

  // Errors (JSON)
  app.use(errorHandler);
  return app;
}
