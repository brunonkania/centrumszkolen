import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query, pool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGR_DIR = resolve(__dirname, '../migrations');

async function migrate() {
  const files = readdirSync(MIGR_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  if (!files.length) throw new Error('No migration files in migrations/');

  for (const f of files) {
    const full = resolve(MIGR_DIR, f);
    const sql = readFileSync(full, 'utf8');
    console.log(`[DB] Running ${f} ...`);
    await query(sql);
  }
  console.log('[DB] Migration completed');
}

migrate()
  .then(async () => { await pool.end(); })
  .catch(async (e) => { console.error('❌ Migration failed:', e); await pool.end(); process.exit(1); });
