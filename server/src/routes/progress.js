// src/routes/progress.js
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /progress/:courseId
 * Zwraca listę ukończonych modułów użytkownika.
 */
router.get('/:courseId', async (req, res, next) => {
  try {
    const ps = z.object({ courseId: z.coerce.number().int().positive() }).safeParse(req.params);
    if (!ps.success) return res.status(400).json({ error: 'INVALID_INPUT' });
    const uid = req.user?.uid || req.user?.id;
    const { courseId } = ps.data;

    const enr = await query('SELECT 1 FROM enrollments WHERE user_id=$1 AND course_id=$2', [uid, courseId]);
    if (enr.rowCount === 0) return res.status(403).json({ error: 'NO_ENROLLMENT' });

    const r = await query(
      'SELECT module_no FROM progress WHERE user_id=$1 AND course_id=$2 ORDER BY module_no',
      [uid, courseId]
    );
    res.json({ completed: r.rows.map(x => x.module_no) });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /progress/:courseId/:moduleNo/complete
 * Oznacza moduł jako ukończony (jeśli spełnione warunki).
 */
router.post('/:courseId/:moduleNo/complete', async (req, res, next) => {
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
      `SELECT requires_quiz FROM modules WHERE course_id=$1 AND module_no=$2`,
      [courseId, moduleNo]
    );
    if (mod.rowCount === 0) return res.status(404).json({ error: 'MODULE_NOT_FOUND' });

    // Jeśli moduł wymaga quizu — sprawdź zaliczenie
    if (mod.rows[0].requires_quiz) {
      const quiz = await query(
        `SELECT passed FROM quiz_results
         WHERE user_id=$1 AND course_id=$2 AND module_no=$3
         ORDER BY id DESC LIMIT 1`,
        [uid, courseId, moduleNo]
      );
      if (quiz.rowCount === 0 || quiz.rows[0].passed !== true) {
        return res.status(400).json({ error: 'QUIZ_REQUIRED' });
      }
    }

    // Wstaw progress (idempotentnie)
    await query(
      `INSERT INTO progress (user_id, course_id, module_no)
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [uid, courseId, moduleNo]
    );

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
