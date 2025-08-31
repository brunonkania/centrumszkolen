import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.post('/:courseId/complete', async (req, res) => {
  const courseId = Number(req.params.courseId);
  const { moduleId } = req.body || {};
  if (!moduleId) return res.status(400).json({ error: 'moduleId required' });

  const email = req.user?.sub;
  const u = await query('SELECT id FROM users WHERE email=$1', [email]);
  if (u.rowCount === 0) return res.status(401).json({ error: 'User not found' });
  const userId = u.rows[0].id;

  const enr = await query('SELECT 1 FROM enrollments WHERE user_id=$1 AND course_id=$2', [userId, courseId]);
  if (enr.rowCount === 0) return res.status(403).json({ error: 'NOT_ENROLLED' });

  const moduleRs = await query('SELECT requires_quiz, status FROM modules WHERE course_id=$1 AND module_no=$2', [courseId, moduleId]);
  if (moduleRs.rowCount === 0) return res.status(404).json({ error: 'MODULE_NOT_FOUND' });
  if (moduleRs.rows[0].status !== 'published') return res.status(403).json({ error: 'MODULE_DRAFT' });
  if (moduleRs.rows[0].requires_quiz) return res.status(409).json({ error: 'QUIZ_REQUIRED' });

  const doneRs = await query('SELECT COUNT(*)::int AS done FROM progress WHERE user_id=$1 AND course_id=$2', [userId, courseId]);
  const done = doneRs.rows[0].done;
  if (Number(moduleId) > done + 1) {
    return res.status(409).json({ error: 'LOCKED' });
  }

  await query('INSERT INTO progress (user_id, course_id, module_no) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
    [userId, courseId, moduleId]);

  const m = await query(`SELECT module_no, title, requires_quiz FROM modules WHERE course_id=$1 AND status='published' ORDER BY module_no`, [courseId]);
  const completedRows = await query('SELECT module_no FROM progress WHERE user_id=$1 AND course_id=$2', [userId, courseId]);
  const completedSet = new Set(completedRows.rows.map(r => Number(r.module_no)));
  const completedCount = completedSet.size;
  const total = m.rowCount;
  const percent = total ? Math.round((completedCount / total) * 100) : 0;

  const modules = m.rows.map(row => ({
    id: Number(row.module_no),
    title: row.title + (row.requires_quiz ? ' 📝' : ''),
    completed: completedSet.has(Number(row.module_no)),
    locked: Number(row.module_no) > completedCount + 1
  }));

  const title = (await query('SELECT title FROM courses WHERE id=$1', [courseId])).rows[0].title;
  res.json({ id: courseId, title, percent, modules });
});

export default router;
