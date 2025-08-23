import { Router } from 'express';
import pg from 'pg';
import { requireAuth } from '../middleware/auth.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const router = Router();

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { moduleId } = req.body || {};
    if (!moduleId) return res.status(400).json({ error: 'moduleId required' });

    // znajdź courseId tego modułu
    const { rows: m } = await pool.query(
      'select course_id from course_modules where id=$1',
      [moduleId]
    );
    const courseId = m[0]?.course_id;
    if (!courseId) return res.status(404).json({ error: 'Module not found' });

    // sprawdź, czy user ma dostęp do kursu
    const { rows: a } = await pool.query(
      'select 1 from user_course_access where user_id=$1 and course_id=$2',
      [req.user.id, courseId]
    );
    if (!a[0]) return res.status(403).json({ error: 'No access to this course' });

    await pool.query(
      `insert into user_progress (user_id, module_id)
       values ($1,$2) on conflict do nothing`,
      [req.user.id, moduleId]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/:courseId', requireAuth, async (req, res, next) => {
  try {
    const { courseId } = req.params;

    // sprawdź dostęp zanim pokażesz moduły
    const { rows: a } = await pool.query(
      'select 1 from user_course_access where user_id=$1 and course_id=$2',
      [req.user.id, courseId]
    );
    if (!a[0]) return res.status(403).json({ error: 'No access to this course' });

    const { rows } = await pool.query(`
      select cm.id as module_id, cm.title, cm.position,
             (up.module_id is not null) as completed
      from course_modules cm
      left join user_progress up
        on up.module_id = cm.id and up.user_id = $1
      where cm.course_id = $2
      order by cm.position
    `, [req.user.id, courseId]);
    res.json(rows);
  } catch (e) { next(e); }
});

export default router;
