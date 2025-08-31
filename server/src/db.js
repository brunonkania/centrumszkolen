import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

export async function tx(run) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await run(client);
    await client.query('COMMIT');
    return res;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
