// src/migrate.js
import * as db from './db.js';
const { query } = db;

async function migrate() {
  try {
    // USERS
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // REFRESH TOKENS
    await query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        user_agent TEXT,
        ip TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_token ON refresh_tokens(token);
    `);

    // COURSES
    await query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        price_cents INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // MODULES
    await query(`
      CREATE TABLE IF NOT EXISTS modules (
        id SERIAL PRIMARY KEY,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        module_no INTEGER NOT NULL,
        title TEXT NOT NULL,
        content_html TEXT DEFAULT '',
        video_url TEXT DEFAULT '',
        requires_quiz BOOLEAN NOT NULL DEFAULT false,
        pass_score INTEGER NOT NULL DEFAULT 70,
        attempt_limit INTEGER NOT NULL DEFAULT 3,
        quiz_json TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'published',
        UNIQUE (course_id, module_no)
      );
      CREATE INDEX IF NOT EXISTS idx_modules_course ON modules(course_id);
    `);

    // ENROLLMENTS
    await query(`
      CREATE TABLE IF NOT EXISTS enrollments (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT now(),
        PRIMARY KEY (user_id, course_id)
      );
    `);

    // PROGRESS
    await query(`
      CREATE TABLE IF NOT EXISTS progress (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        module_no INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        PRIMARY KEY (user_id, course_id, module_no)
      );
    `);

    // QUIZ RESULTS
    await query(`
      CREATE TABLE IF NOT EXISTS quiz_results (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        module_no INTEGER NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        passed BOOLEAN NOT NULL DEFAULT false,
        answers_json TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_quiz_user_course_mod
        ON quiz_results(user_id, course_id, module_no);
    `);

    // ORDERS
    await query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        amount_cents INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        provider TEXT DEFAULT '',
        provider_order_id TEXT DEFAULT '',
        provider_payload JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT now(),
        paid_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_provider_order ON orders(provider_order_id);
    `);

    // CERTIFICATES
    await query(`
      CREATE TABLE IF NOT EXISTS certificates (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        serial TEXT UNIQUE NOT NULL,
        pdf_url TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // AUDIT
    await query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER,
        action TEXT NOT NULL,
        entity TEXT,
        entity_id TEXT,
        meta JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
    `);

    console.log('✅ Migracje zakończone powodzeniem');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
