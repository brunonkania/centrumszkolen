// src/routes/modules.js
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /modules/:courseId
 * Lista modułów kursu (dla zalogowanego użytkownika z enrollmentem).
 */
router.get('/:courseId', async (req, res, next) => {
  try {
    const ps = z.object({ courseId: z.coerce.number().int().positive() }).safeParse(req.params);
    if (!ps.success) return res.status(400).json({ error: 'INVALID_INPUT' });
    const uid = req.user?.uid || req.user?.id;
    const { courseId } = ps.data;

    // czy user ma dostęp do kursu?
    const enr = await query('SELECT 1 FROM enrollments WHERE user_id=$1 AND course_id=$2', [uid, courseId]);
    if (enr.rowCount === 0) return res.status(403).json({ error: 'NO_ENROLLMENT' });

    const mods = await query(
      `SELECT module_no, title, requires_quiz, pass_score, attempt_limit, video_url, content_html, status
       FROM modules
       WHERE course_id=$1
       ORDER BY module_no ASC`,
      [courseId]
    );

    res.json({ modules: mods.rows });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /modules/:courseId/:moduleNo
 * Szczegóły pojedynczego modułu.
 */
router.get('/:courseId/:moduleNo', async (req, res, next) => {
  try {
    const ps = z.object({
      courseId: z.coerce.number().int().positive(),
      moduleNo: z.coerce.number().int().positive(),
    }).safeParse(req.params);
    if (!ps.success) return res.status(400).json({ error: 'INVALID_INPUT' });
    const uid = req.user?.uid || req.user?.id;
    const { courseId, moduleNo } = ps.data;

    const enr = await query('SELECT 1 FROM enrollments WHERE user_id=$1 AND course_id=$2', [uid, courseId]);
    if (enr.rowCount === 0) return res.status(403).json({ error: 'NO_ENROLLMENT' });

    const mod = await query(
      `SELECT module_no, title, requires_quiz, pass_score, attempt_limit, video_url, content_html, status
       FROM modules WHERE course_id=$1 AND module_no=$2`,
      [courseId, moduleNo]
    );
    if (mod.rowCount === 0) return res.status(404).json({ error: 'MODULE_NOT_FOUND' });

    // postęp usera
    const done = await query(
      'SELECT module_no FROM progress WHERE user_id=$1 AND course_id=$2',
      [uid, courseId]
    );
    const completedSet = new Set(done.rows.map(r => r.module_no));

    // prosty gating: moduł N jest „odblokowany”, jeśli N==1 lub (N-1) ukończony
    const unlocked = moduleNo === 1 || completedSet.has(moduleNo - 1);

    res.json({ module: mod.rows[0], unlocked });
  } catch (e) {
    next(e);
  }
});

export default router;
