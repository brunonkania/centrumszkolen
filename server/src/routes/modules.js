import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.get('/:courseId/:moduleNo', async (req, res) => {
  const courseId = Number(req.params.courseId);
  const moduleNo = Number(req.params.moduleNo);
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
    SELECT module_no, title, content_html, video_url, requires_quiz, pass_score, attempt_limit, status
    FROM modules
    WHERE course_id=$1 AND module_no=$2
  `, [courseId, moduleNo]);
  if (m.rowCount === 0) return res.status(404).json({ error: 'MODULE_NOT_FOUND' });
  const mod = m.rows[0];
  if (mod.status !== 'published') return res.status(403).json({ error: 'MODULE_DRAFT' });

  const doneRows = await query('SELECT module_no FROM progress WHERE user_id=$1 AND course_id=$2 ORDER BY module_no', [userId, courseId]);
  const doneSet = new Set(doneRows.rows.map(r => Number(r.module_no)));
  const completedCount = doneSet.size;
  const totalRs = await query("SELECT COUNT(*)::int AS total FROM modules WHERE course_id=$1 AND status='published'", [courseId]);
  const total = totalRs.rows[0].total;
  const percent = total ? Math.round((completedCount / total) * 100) : 0;

  const locked = moduleNo > completedCount + 1;
  const completed = doneSet.has(moduleNo);

  if (locked && !completed) {
    return res.status(403).json({ error: 'LOCKED' });
  }

  const prev = moduleNo > 1 ? moduleNo - 1 : null;
  const next = moduleNo < total ? moduleNo + 1 : null;

  res.json({
    course: { id: course.id, title: course.title, percent },
    module: {
      id: moduleNo,
      title: mod.title,
      contentHtml: mod.content_html || '',
      videoUrl: mod.video_url || '',
      requiresQuiz: mod.requires_quiz,
      passScore: Number(mod.pass_score),
      attemptLimit: Number(mod.attempt_limit),
      completed,
      locked: false
    },
    nav: { prev, next }
  });
});

export default router;
