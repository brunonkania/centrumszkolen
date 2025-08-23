import { Router } from 'express';
import pg from 'pg';
import { requireAuth } from '../middleware/auth.js';

const { Pool } = pg;
// pojedyncza pula – nie twórz wielu połączeń po każdej zmianie pliku
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const router = Router();

/**
 * POST /api/purchase
 * Body: { "courseId": "<uuid>" }
 * Wymaga: Bearer <JWT>
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { courseId } = req.body || {};
    if (!courseId || typeof courseId !== 'string') {
      return res.status(400).json({ error: 'courseId required' });
    }

    const looseUuidRe = /^[0-9a-f-]{36}$/i;
if (!looseUuidRe.test(courseId)) {
  return res.status(400).json({ error: 'Invalid courseId format' });
}

    // kurs istnieje i aktywny?
    const course = await pool.query(
      'select id from courses where id = $1 and is_active = true',
      [courseId]
    );
    if (course.rowCount === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // nadaj dostęp (idempotentnie)
    await pool.query(
      `insert into user_course_access (user_id, course_id)
       values ($1, $2)
       on conflict do nothing`,
      [req.user.id, courseId]
    );

    // odpowiedź kontrolna – pokaż bieżący status
    const after = await pool.query(
      `select exists (
         select 1 from user_course_access where user_id=$1 and course_id=$2
       ) as has_access`,
      [req.user.id, courseId]
    );

    return res.json({ ok: true, has_access: after.rows[0].has_access });
  } catch (err) {
    // zaloguj do konsoli – zobaczysz w oknie serwera
    console.error('Purchase error:', err);
    return next(err);
  }
});

export default router;
