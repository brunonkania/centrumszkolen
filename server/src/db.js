import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({ connectionString: config.db.url });

export async function query(q, params = []) {
  const client = await pool.connect();
  try { return await client.query(q, params); }
  finally { client.release(); }
}
