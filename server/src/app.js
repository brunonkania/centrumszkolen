import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import authRouter from './routes/auth.js';
import coursesRouter from './routes/courses.js';
import progressRouter from './routes/progress.js';
import purchaseRouter from './routes/purchase.js';
import myCoursesRouter from './routes/my-courses.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// 🔹 Serwuj pliki frontendowe z folderu "public"
app.use(express.static('public'));

// testowe endpointy
app.get('/', (_, res) => res.send('API is up ✅'));
app.get('/health', (_, res) => res.json({ ok: true }));

// 🔹 API routes
app.use('/api/auth', authRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/progress', progressRouter);
app.use('/api/purchase', purchaseRouter);
app.use('/api/my-courses', myCoursesRouter);

// 🔹 Obsługa błędów
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server listening on http://localhost:${PORT}`)
);
