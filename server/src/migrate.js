import 'dotenv/config';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.join(__dirname, 'migrations');
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Brak DATABASE_URL w .env');
  process.exit(1);
}

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      create table if not exists _migrations (
        id serial primary key,
        name text unique not null,
        run_at timestamptz default now()
      );
    `);

    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const exists = await client.query('select 1 from _migrations where name=$1', [file]);
      if (exists.rowCount) {
        console.log(`✔ Pomijam (już wykonana): ${file}`);
        continue;
      }
      const sql = readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`▶ Uruchamiam: ${file}`);
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('insert into _migrations (name) values ($1)', [file]);
      await client.query('COMMIT');
      console.log(`✔ OK: ${file}`);
    }

    console.log('🎉 Migracje zakończone powodzeniem.');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Błąd migracji:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
