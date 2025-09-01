import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();

/**
 * GET /modules/:courseId
 * Zwraca moduły kursu dla zalogowanego użytkownika (musi mieć enrollment).
 */
router.get('/:courseId', async (req, res) => {
  const pschema = z.object({ courseId: z.coerce.number().int().positive() });
  const p = pschema.safeParse(req.params);
  if (!p.success) return res.status(400).json({ error: 'INVALID_INPUT' });
  const courseId = p.data.courseId;

  const me = await query('SELECT id FROM users WHERE email=$1', [req.user.sub]);
  if (me.rowCount === 0) return res.status(401).json({ error: 'USER_NOT_FOUND' });
  const uid = me.rows[0].id;

  const enr = await query('SELECT 1 FROM enrollments WHERE user_id=$1 AND course_id=$2', [uid, courseId]);
  if (enr.rowCount === 0) return res.status(403).json({ error: 'NO_ACCESS' });

  const mods = await query(`
    SELECT m.course_id, m.module_no, m.title, m.requires_quiz, m.pass_score, m.attempt_limit, m.status,
           m.content_html, m.video_url
    FROM modules m
    WHERE m.course_id=$1
    ORDER BY m.module_no
  `, [courseId]);

  // progres
  const prog = await query(
    'SELECT module_no FROM progress WHERE user_id=$1 AND course_id=$2',
    [uid, courseId]
  );
  const completed = new Set(prog.rows.map(r => r.module_no));

  res.json({
    modules: mods.rows.map(m => ({ ...m, completed: completed.has(m.module_no) }))
  });
});

/**
 * POST /modules/:courseId/:moduleNo/complete
 * Oznacz moduł jako ukończony (jeśli spełnione warunki – np. quiz zdany lub brak wymagania).
 */
router.post('/:courseId/:moduleNo/complete', async (req, res) => {
  const pschema = z.object({
    courseId: z.coerce.number().int().positive(),
    moduleNo: z.coerce.number().int().positive()
  });
  const p = pschema.safeParse(req.params);
  if (!p.success) return res.status(400).json({ error: 'INVALID_INPUT' });
  const { courseId, moduleNo } = p.data;

  const me = await query('SELECT id FROM users WHERE email=$1', [req.user.sub]);
  if (me.rowCount === 0) return res.status(401).json({ error: 'USER_NOT_FOUND' });
  const uid = me.rows[0].id;

  const enr = await query('SELECT 1 FROM enrollments WHERE user_id=$1 AND course_id=$2', [uid, courseId]);
  if (enr.rowCount === 0) return res.status(403).json({ error: 'NO_ACCESS' });

  const mod = await query('SELECT requires_quiz, pass_score FROM modules WHERE course_id=$1 AND module_no=$2', [courseId, moduleNo]);
  if (mod.rowCount === 0) return res.status(404).json({ error: 'MODULE_NOT_FOUND' });

  if (mod.rows[0].requires_quiz) {
    // sprawdź czy już zdany quiz
    const att = await query(
      `SELECT passed FROM quiz_attempts
       WHERE user_id=$1 AND course_id=$2 AND module_no=$3
       ORDER BY created_at DESC LIMIT 1`,
      [uid, courseId, moduleNo]
    );
    if (att.rowCount === 0 || !att.rows[0].passed) {
      return res.status(400).json({ error: 'QUIZ_REQUIRED' });
    }
  }

  await query(
    'INSERT INTO progress (user_id, course_id, module_no) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
    [uid, courseId, moduleNo]
  );
  await logAudit({ userId: uid, action: 'MODULE_COMPLETE', entity: 'module', entityId: `${courseId}:${moduleNo}` });

  res.json({ ok: true });
});

export default router;
