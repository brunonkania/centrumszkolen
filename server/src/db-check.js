import { query } from './db.js';

(async () => {
  try {
    const v = await query('SELECT version() AS version, now() AS now');
    const c = await query('SELECT COUNT(*)::int AS n FROM courses');
    console.log('✅ DB OK');
    console.log('version:', v.rows[0].version);
    console.log('time   :', v.rows[0].now);
    console.log('courses:', c.rows[0].n);
    process.exit(0);
  } catch (e) {
    console.error('❌ DB ERROR:', e.message);
    if (e.code) console.error('code:', e.code);
    process.exit(1);
  }
})();
