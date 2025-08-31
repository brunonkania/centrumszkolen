import { Router } from 'express';
import { query } from '../db.js';
import sanitizeHtml from 'sanitize-html';

const router = Router();

router.get('/', async (req, res) => {
  const email = req.user?.sub;
  const u = await query('SELECT id FROM users WHERE email=$1', [email]);
  if (u.rowCount === 0) return res.status(401).json({ error: 'User not found' });
  const userId = u.rows[0].id;

  const rs = await query(`
    SELECT c.id, c.title,
           COUNT(m.id)::int AS total,
           COALESCE(SUM(CASE WHEN p.user_id IS NULL THEN 0 ELSE 1 END),0)::int AS done
    FROM enrollments e
    JOIN courses c ON c.id = e.course_id
    LEFT JOIN modules m ON m.course_id = c.id AND m.status='published'
    LEFT JOIN progress p
      ON p.course_id = c.id
     AND p.module_no = m.module_no
     AND p.user_id = $1
    WHERE e.user_id = $1
    GROUP BY c.id, c.title
    ORDER BY c.id;
  `, [userId]);

  const list = rs.rows.map(r => ({
    id: r.id,
    title: r.title,
    progress: r.total ? Math.round((r.done / r.total) * 100) : 0
  }));

  res.json(list);
});

router.get('/:id', async (req, res) => {
  const courseId = Number(req.params.id);
  const email = req.user?.sub;
  const u = await query('SELECT id FROM users WHERE email=$1', [email]);
  if (u.rowCount === 0) return res.status(401).json({ error: 'User not found' });
  const userId = u.rows[0].id;

  const enr = await query('SELECT 1 FROM enrollments WHERE user_id=$1 AND course_id=$2', [userId, courseId]);
  if (enr.rowCount === 0) return res.status(403).json({ error: 'NOT_ENROLLED' });

  const c = await query('SELECT id, title FROM courses WHERE id=$1', [courseId]);
  if (c.rowCount === 0) return res.status(404).json({ error: 'Course not found' });
  const course = c.rows[0];

  const m = await query(`
    SELECT module_no, title, requires_quiz
    FROM modules
    WHERE course_id=$1 AND status='published'
    ORDER BY module_no
  `, [courseId]);
  const completed = await query('SELECT module_no FROM progress WHERE user_id=$1 AND course_id=$2', [userId, courseId]);

  const completedSet = new Set(completed.rows.map(r => Number(r.module_no)));
  const completedCount = completedSet.size;
  const total = m.rowCount;
  const percent = total ? Math.round((completedCount / total) * 100) : 0;

  const modules = m.rows.map(row => ({
    id: Number(row.module_no),
    title: row.title + (row.requires_quiz ? ' 📝' : ''),
    completed: completedSet.has(Number(row.module_no)),
    locked: Number(row.module_no) > completedCount + 1
  }));

  res.json({ id: course.id, title: course.title, percent, modules });
});

export default router;
