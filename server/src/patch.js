// src/patch.js
import { query } from './db.js';

async function patch() {
  try {
    // --- COURSES: description ---
    await query(`
      ALTER TABLE IF EXISTS courses
      ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
    `);

    // --- MODULES: kolumny pod quiz/wideo/treść/status ---
    await query(`
      ALTER TABLE IF EXISTS modules
      ADD COLUMN IF NOT EXISTS content_html TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS requires_quiz BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS pass_score INTEGER NOT NULL DEFAULT 70,
      ADD COLUMN IF NOT EXISTS attempt_limit INTEGER NOT NULL DEFAULT 3,
      ADD COLUMN IF NOT EXISTS quiz_json TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';
    `);

    // --- ORDERS: payload JSON + paid_at (na wszelki wypadek) ---
    await query(`
      ALTER TABLE IF EXISTS orders
      ADD COLUMN IF NOT EXISTS provider_payload JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
    `);

    // --- CERTIFICATES: pdf_url (jeśli kiedyś było bez) ---
    await query(`
      ALTER TABLE IF EXISTS certificates
      ADD COLUMN IF NOT EXISTS pdf_url TEXT DEFAULT '';
    `);

    // --- QUIZ_RESULTS: answers_json (gdyby brakowało) ---
    await query(`
      ALTER TABLE IF EXISTS quiz_results
      ADD COLUMN IF NOT EXISTS answers_json TEXT DEFAULT '';
    `);

    console.log('✅ Patch wykonany pomyślnie (schemat zaktualizowany).');
    process.exit(0);
  } catch (err) {
    console.error('❌ Patch failed:', err);
    process.exit(1);
  }
}

patch();
// src/patch.js
import { query } from './db.js';

async function patch() {
  try {
    // --- COURSES: description ---
    await query(`
      ALTER TABLE IF EXISTS courses
      ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
    `);

    // --- MODULES: kolumny pod quiz/wideo/treść/status ---
    await query(`
      ALTER TABLE IF EXISTS modules
      ADD COLUMN IF NOT EXISTS content_html TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS requires_quiz BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS pass_score INTEGER NOT NULL DEFAULT 70,
      ADD COLUMN IF NOT EXISTS attempt_limit INTEGER NOT NULL DEFAULT 3,
      ADD COLUMN IF NOT EXISTS quiz_json TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';
    `);

    // --- ORDERS: payload JSON + paid_at (na wszelki wypadek) ---
    await query(`
      ALTER TABLE IF EXISTS orders
      ADD COLUMN IF NOT EXISTS provider_payload JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
    `);

    // --- CERTIFICATES: pdf_url (jeśli kiedyś było bez) ---
    await query(`
      ALTER TABLE IF EXISTS certificates
      ADD COLUMN IF NOT EXISTS pdf_url TEXT DEFAULT '';
    `);

    // --- QUIZ_RESULTS: answers_json (gdyby brakowało) ---
    await query(`
      ALTER TABLE IF EXISTS quiz_results
      ADD COLUMN IF NOT EXISTS answers_json TEXT DEFAULT '';
    `);

    console.log('✅ Patch wykonany pomyślnie (schemat zaktualizowany).');
    process.exit(0);
  } catch (err) {
    console.error('❌ Patch failed:', err);
    process.exit(1);
  }
}

patch();
