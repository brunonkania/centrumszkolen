import 'dotenv/config';
import { query } from './db.js';
import bcrypt from 'bcryptjs';

async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT DEFAULT '',
      role TEXT NOT NULL DEFAULT 'user',
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT now(),
      used_at TIMESTAMPTZ
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT now(),
      used_at TIMESTAMPTZ
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS courses (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      price_cents INTEGER NOT NULL DEFAULT 0
    );
  `);

  await query(`
    DO $$ BEGIN
      CREATE TYPE module_status AS ENUM ('draft','published');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS modules (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      module_no INTEGER NOT NULL,
      title TEXT NOT NULL,
      content_html TEXT DEFAULT '',
      video_url TEXT DEFAULT '',
      requires_quiz BOOLEAN NOT NULL DEFAULT FALSE,
      pass_score INTEGER NOT NULL DEFAULT 70,
      attempt_limit INTEGER NOT NULL DEFAULT 3,
      quiz_json TEXT DEFAULT '',
      status module_status NOT NULL DEFAULT 'published',
      published_at TIMESTAMPTZ,
      UNIQUE(course_id, module_no)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS enrollments (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (user_id, course_id)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS progress (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      module_no INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (user_id, course_id, module_no)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'PLN',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT now(),
      paid_at TIMESTAMPTZ
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      module_no INTEGER NOT NULL,
      score INTEGER NOT NULL,
      passed BOOLEAN NOT NULL,
      answers JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS certificates (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      serial TEXT UNIQUE NOT NULL,
      issued_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // Seed data
  await query(`
    INSERT INTO courses (id, title, price_cents) VALUES
      (1, 'Instruktor pływania', 29900),
      (2, 'BJJ – fundamenty', 19900)
    ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, price_cents = EXCLUDED.price_cents;
  `);

  await query(`
    INSERT INTO modules (course_id, module_no, title, content_html, requires_quiz, pass_score, attempt_limit, quiz_json, status, published_at) VALUES
      (1, 1, 'Wprowadzenie i BHP', '<p>Bezpieczeństwo na basenie...</p>', TRUE, 70, 3, '{"questions":[{"type":"single","q":"Co oznacza BHP?","options":["Bezpieczne Haki Pływackie","Bezpieczeństwo i Higiena Pracy"],"correct":1,"explain":"Standardowe rozwinięcie skrótu."}]}', 'published', now()),
      (1, 2, 'Podstawy techniki pływackiej', '<p>Pozycja ciała...</p>', FALSE, 70, 3, '', 'published', now()),
      (1, 3, 'Metodyka nauczania dzieci', '<p>Gry i zabawy...</p>', FALSE, 70, 3, '', 'draft', null),
      (1, 4, 'Planowanie treningu', '<p>Makro i mikrocykle...</p>', FALSE, 70, 3, '', 'published', now()),
      (1, 5, 'Egzamin końcowy', '<p>Test praktyczny...</p>', TRUE, 80, 2, '{"questions":[{"type":"single","q":"Ile stylów pływackich wyróżniamy?","options":["2","4","6"],"correct":1}]}', 'published', now()),
      (2, 1, 'Pozycje bazowe', '<p>Closed guard, half guard...</p>', FALSE, 70, 3, '', 'published', now()),
      (2, 2, 'Kontrole z góry', '<p>Stabilizacja pozycji...</p>', FALSE, 70, 3, '', 'published', now()),
      (2, 3, 'Ucieczki z dołu', '<p>Hip escape...</p>', FALSE, 70, 3, '', 'published', now()),
      (2, 4, 'Proste poddania', '<p>RNC, americana...</p>', FALSE, 70, 3, '', 'published', now())
    ON CONFLICT (course_id, module_no) DO NOTHING;
  `);

  // Seed admin tylko jeśli ENV
  if (process.env.SEED_ADMIN === 'true') {
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@local';
    const pass = await bcrypt.hash(process.env.SEED_ADMIN_PASS || 'admin123', 10);
    await query(`
      INSERT INTO users (email, password_hash, name, role, email_verified)
      VALUES ($1, $2, 'Admin', 'admin', TRUE)
      ON CONFLICT (email) DO NOTHING;
    `, [adminEmail, pass]);
  }

  console.log('Migration OK');
}

migrate().catch(e => {
  console.error('Migration failed:', e);
  process.exitCode = 1;
});
