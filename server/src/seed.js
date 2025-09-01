// src/seed.js
import { query, tx } from './db.js';
import bcrypt from 'bcryptjs';  

async function seed() {
  try {
    // Użytkownik testowy
    const email = 'test@example.com';
    const pass = 'Test123!';
    const hash = await bcrypt.hash(pass, 10);

    await tx(async (client) => {
      const u = await client.query('SELECT id FROM users WHERE email=$1', [email]);
      if (u.rowCount === 0) {
        await client.query(
          'INSERT INTO users (email, password_hash, name, role) VALUES ($1,$2,$3,$4)',
          [email, hash, 'Test User', 'user']
        );
        console.log(`✅ Użytkownik dodany: ${email} / ${pass}`);
      } else {
        console.log(`ℹ️ Użytkownik ${email} już istnieje`);
      }
    });

    // Kurs + moduły
    const courseTitle = 'Testowy kurs BJJ';
    let courseId;
    await tx(async (client) => {
      const c = await client.query('SELECT id FROM courses WHERE title=$1', [courseTitle]);
      if (c.rowCount === 0) {
        const r = await client.query(
          'INSERT INTO courses (title, description, price_cents) VALUES ($1,$2,$3) RETURNING id',
          [courseTitle, 'Kurs testowy z trzema modułami', 0]
        );
        courseId = r.rows[0].id;
        console.log(`✅ Kurs dodany: ${courseTitle}`);
      } else {
        courseId = c.rows[0].id;
        console.log(`ℹ️ Kurs ${courseTitle} już istnieje`);
      }

      // Moduł 1
      await client.query(
        `INSERT INTO modules (course_id, module_no, title, content_html, video_url, requires_quiz, status)
         VALUES ($1,1,$2,$3,$4,$5,'published')
         ON CONFLICT (course_id,module_no) DO NOTHING`,
        [courseId, 'Wprowadzenie', '<p>Witaj w kursie!</p>', '', false]
      );

      // Moduł 2 z quizem
      const quiz = JSON.stringify([
        { question: 'Ile pasów ma typowy pas BJJ?', options: ['1', '2', '3', '4'], correctIndex: 3 },
        { question: 'Jaki kolor pasa jest wyższy niż niebieski?', options: ['Biały', 'Fioletowy', 'Czarny', 'Brązowy'], correctIndex: 1 },
      ]);

      await client.query(
        `INSERT INTO modules (course_id, module_no, title, content_html, requires_quiz, pass_score, quiz_json, status)
         VALUES ($1,2,$2,$3,$4,$5,$6,'published')
         ON CONFLICT (course_id,module_no) DO NOTHING`,
        [courseId, 'Podstawowe techniki', '<p>Omówienie podstawowych pozycji.</p>', true, 70, quiz]
      );

      // Moduł 3
      await client.query(
        `INSERT INTO modules (course_id, module_no, title, content_html, video_url, requires_quiz, status)
         VALUES ($1,3,$2,$3,$4,$5,'published')
         ON CONFLICT (course_id,module_no) DO NOTHING`,
        [courseId, 'Zaawansowane techniki', '<p>Techniki dla zaawansowanych.</p>', '', false]
      );
    });

    console.log('🎉 Seed zakończony');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error', err);
    process.exit(1);
  }
}

seed();
