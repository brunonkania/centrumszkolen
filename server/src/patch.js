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
      ALTER TABLE IF NOT EXISTS modules
      ADD COLUMN IF NOT EXISTS content_html TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;
    `);

    // --- QUIZ RESULTS: answers_json ---
    await query(`
      ALTER TABLE IF EXISTS quiz_results
      ADD COLUMN IF NOT EXISTS answers_json TEXT DEFAULT '';
    `);

    // --- MAGIC LINKS (NOWOŚĆ) ---
    await query(`
      CREATE TABLE IF NOT EXISTS magic_links (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT now(),
        expires_at TIMESTAMPTZ,
        used_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_magic_links_user ON magic_links(user_id);
      CREATE INDEX IF NOT EXISTS idx_magic_links_course ON magic_links(course_id);
    `);

    console.log('✅ Patch wykonany pomyślnie (schemat zaktualizowany).');
    process.exit(0);
  } catch (err) {
    console.error('❌ Patch failed:', err);
    process.exit(1);
  }
}

patch();
