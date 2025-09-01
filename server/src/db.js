import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Możesz dodać ssl: { rejectUnauthorized: false } na niektórych hostingach
});

export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    return res;
  } finally {
    const ms = Date.now() - start;
    if (ms > 300) {
      // proste logowanie wolnych zapytań
      console.warn('[slow query]', ms + 'ms', text.replace(/\s+/g, ' ').slice(0, 120));
    }
  }
}

export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ret = await fn(client);
    await client.query('COMMIT');
    return ret;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    client.release();
  }
}
