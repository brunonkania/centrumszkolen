// src/db.js
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

// Konfiguracja puli – bierze wszystko z DATABASE_URL
// Uwaga: jeśli w produkcji używasz dostawcy wymagającego SSL, ustaw PGSSLMODE=require
// lub odkomentuj ssl: { rejectUnauthorized: false } poniżej.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ssl: { rejectUnauthorized: false },
  // Dobierz w razie potrzeby:
  max: 10,            // maks. liczba jednoczesnych połączeń
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Prosta funkcja zapytań
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    if (process.env.NODE_ENV === 'development') {
      const dur = Date.now() - start;
      // odkomentuj do debugowania:
      // console.log('SQL:', { text, rows: res.rowCount, ms: dur });
    }
    return res;
  } catch (err) {
    // Możesz dodać własne mapowanie błędów (np. unique_violation)
    throw err;
  }
}

// Pobierz klienta „na ręczne sterowanie” (np. dłuższe operacje)
export async function getClient() {
  const client = await pool.connect();
  // helper do debugowania długich transakcji
  const release = client.release.bind(client);
  let timeout = null;

  if (process.env.NODE_ENV === 'development') {
    timeout = setTimeout(() => {
      console.warn('⚠️ Długi checkout klienta PG (ponad 15s) – czy transakcja została zakończona?');
    }, 15000);
  }

  client.release = () => {
    if (timeout) clearTimeout(timeout);
    return release();
  };

  return client;
}

// Helper transakcyjny: withTransaction(client => { ... })
export async function withTransaction(fn) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

// Łagodne zamykanie przy SIGINT/SIGTERM (Docker/PM2/heroku)
async function shutdown() {
  try {
    await pool.end();
    // console.log('PG pool closed');
  } catch (e) {
    // ignore
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
