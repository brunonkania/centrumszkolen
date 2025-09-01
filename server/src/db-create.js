// src/db-create.js
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

function parseDbUrl(dbUrl) {
  if (!dbUrl) throw new Error('Brak DATABASE_URL w .env');
  const u = new URL(dbUrl);
  const dbName = (u.pathname || '').replace(/^\//, '');
  const owner = decodeURIComponent(u.username || 'postgres');

  // połączenie do bazy "postgres", żeby móc wykonać CREATE DATABASE
  const adminUrl = new URL(u.toString());
  adminUrl.pathname = '/postgres';

  return { adminUrl: adminUrl.toString(), dbName, owner };
}

async function main() {
  const { adminUrl, dbName, owner } = parseDbUrl(process.env.DATABASE_URL);

  const pool = new Pool({
    connectionString: adminUrl,
    // ssl: { rejectUnauthorized: false }, // odkomentuj, jeśli Twój hosting wymaga SSL
  });

  try {
    console.log(`🔎 Sprawdzam, czy istnieje baza "${dbName}"...`);
    const check = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (check.rowCount > 0) {
      console.log(`✅ Baza "${dbName}" już istnieje – nic nie robię.`);
      process.exit(0);
    }

    console.log(`🛠️  Tworzę bazę "${dbName}" (owner: ${owner})...`);
    // Uwaga: CREATE DATABASE nie ma IF NOT EXISTS – dlatego najpierw sprawdzamy SELECT-em
    await pool.query(`CREATE DATABASE ${pg.Client.prototype.escapeIdentifier
      ? pg.Client.prototype.escapeIdentifier(dbName)
      : `"${dbName.replace(/"/g, '""')}"`} OWNER ${pg.Client.prototype.escapeIdentifier
      ? pg.Client.prototype.escapeIdentifier(owner)
      : `"${owner.replace(/"/g, '""')}"`}`); // bezpieczny owner

    console.log('🎉 Gotowe. Możesz teraz uruchomić migracje.');
    process.exit(0);
  } catch (e) {
    console.error('❌ DB CREATE ERROR:', e.message);
    if (e.code) console.error('code:', e.code);
    console.error('Tip: jeśli to błąd uprawnień, użyj użytkownika z rolą CREATEDB (np. "postgres") w DATABASE_URL.');
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
}

main();
