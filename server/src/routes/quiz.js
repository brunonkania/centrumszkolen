// src/routes/quiz.js
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /quiz/:courseId/:moduleNo
 * Zwraca pytania quizu.
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

    const r = await query(
      `SELECT requires_quiz, pass_score, attempt_limit, quiz_json
       FROM modules WHERE course_id=$1 AND module_no=$2`,
      [courseId, moduleNo]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'MODULE_NOT_FOUND' });
    if (!r.rows[0].requires_quiz) return res.status(400).json({ error: 'NO_QUIZ' });

    const quiz = r.rows[0].quiz_json ? JSON.parse(r.rows[0].quiz_json) : [];
    res.json({
      quiz,
      pass_score: r.rows[0].pass_score || 70,
      attempt_limit: r.rows[0].attempt_limit || 3,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /quiz/:courseId/:moduleNo
 * body: { answers: number[] } – indeksy zaznaczonych odpowiedzi
 * Zalicza quiz i zapisuje wynik.
 */
router.post('/:courseId/:moduleNo', async (req, res, next) => {
  try {
    const ps = z.object({
      courseId: z.coerce.number().int().positive(),
      moduleNo: z.coerce.number().int().positive(),
    }).safeParse(req.params);
    if (!ps.success) return res.status(400).json({ error: 'INVALID_INPUT' });

    const bs = z.object({
      answers: z.array(z.number().int().nonnegative()),
    }).safeParse(req.body || {});
    if (!bs.success) return res.status(400).json({ error: 'INVALID_INPUT' });

    const uid = req.user?.uid || req.user?.id;
    const { courseId, moduleNo } = ps.data;
    const { answers } = bs.data;

    const enr = await query('SELECT 1 FROM enrollments WHERE user_id=$1 AND course_id=$2', [uid, courseId]);
    if (enr.rowCount === 0) return res.status(403).json({ error: 'NO_ENROLLMENT' });

    const r = await query(
      `SELECT pass_score, attempt_limit, quiz_json
       FROM modules WHERE course_id=$1 AND module_no=$2`,
      [courseId, moduleNo]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'MODULE_NOT_FOUND' });

    const passScore = r.rows[0].pass_score || 70;
    const attemptLimit = r.rows[0].attempt_limit || 3;
    const quiz = r.rows[0].quiz_json ? JSON.parse(r.rows[0].quiz_json) : [];

    // próby
    const attempts = await query(
      `SELECT COUNT(*)::int AS n FROM quiz_results WHERE user_id=$1 AND course_id=$2 AND module_no=$3`,
      [uid, courseId, moduleNo]
    );
    if (attempts.rows[0].n >= attemptLimit) {
      return res.status(429).json({ error: 'ATTEMPT_LIMIT' });
    }

    // policz wynik
    let correct = 0;
    quiz.forEach((q, i) => {
      if (typeof q.correctIndex === 'number' && answers[i] === q.correctIndex) correct++;
    });
    const total = quiz.length || 1;
    const scorePct = Math.round((correct / total) * 100);
    const passed = scorePct >= passScore;

    const ins = await query(
      `INSERT INTO quiz_results (user_id, course_id, module_no, score, passed, answers_json)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, score, passed, created_at`,
      [uid, courseId, moduleNo, scorePct, passed, JSON.stringify(answers)]
    );

    res.json({
      result: { score: scorePct, passed, attempt: attempts.rows[0].n + 1 },
      saved: ins.rows[0],
    });
  } catch (e) {
    next(e);
  }
});

export default router;
