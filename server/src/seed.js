import { query, pool } from './db.js';

async function seed() {
  // kurs bazowy
  const { rows: courses } = await query('select id from courses where slug=$1', ['instruktor-plywania']);
  if (!courses.length) {
    throw new Error('Brak kursu seedowego — odpal najpierw migracje (001_init.sql).');
  }
  const courseId = courses[0].id;

  // jeśli już są pytania – nic nie rób
  const { rows: qs } = await query('select id from quiz_questions where course_id=$1', [courseId]);
  if (qs.length) {
    console.log('[DB] Seed skipped (quiz already present)');
    return;
  }

  // pytanie 1
  const { rows: q1 } = await query(
    'insert into quiz_questions (course_id, text) values ($1,$2) returning id',
    [courseId, 'Który styl pływacki wymaga naprzemiennej pracy rąk i nóg na boku?']
  );
  await query(
    'insert into quiz_answers (question_id, text, is_correct) values ($1,$2,$3),($1,$4,$5),($1,$6,$7)',
    [q1[0].id, 'Żabka', false, 'Kraul (styl dowolny)', true, 'Delfin', false]
  );

  console.log('[DB] Seed completed');
}

seed()
  .then(async () => {
    await pool.end();
  })
  .catch(async (e) => {
    console.error('[DB] Seed error:', e);
    await pool.end();
    process.exit(1);
  });
