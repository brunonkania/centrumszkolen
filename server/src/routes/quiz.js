import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();

/**
 * POST /quiz/:courseId/:moduleNo/attempt
 * Body: { answers: Array } (format zależny od modules.quiz_json)
 */
router.post('/:courseId/:moduleNo/attempt', async (req, res) => {
  const pschema = z.object({
    courseId: z.coerce.number().int().positive(),
    moduleNo: z.coerce.number().int().positive()
  });
  const bschema = z.object({
    answers: z.array(z.any()).min(1) // akceptujemy różne typy pytań – walidacja semantyczna niżej
  });

  const p = pschema.safeParse(req.params);
  if (!p.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const b = bschema.safeParse(req.body || {});
  if (!b.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const { courseId, moduleNo } = p.data;
  const answers = b.data.answers;

  const me = await query('SELECT id FROM users WHERE email=$1', [req.user.sub]);
  if (me.rowCount === 0) return res.status(401).json({ error: 'USER_NOT_FOUND' });
  const uid = me.rows[0].id;

  const enr = await query('SELECT 1 FROM enrollments WHERE user_id=$1 AND course_id=$2', [uid, courseId]);
  if (enr.rowCount === 0) return res.status(403).json({ error: 'NO_ACCESS' });

  const mod = await query(
    `SELECT requires_quiz, pass_score, attempt_limit, quiz_json
     FROM modules
     WHERE course_id=$1 AND module_no=$2`,
    [courseId, moduleNo]
  );
  if (mod.rowCount === 0) return res.status(404).json({ error: 'MODULE_NOT_FOUND' });

  const { requires_quiz, pass_score, attempt_limit, quiz_json } = mod.rows[0];
  if (!requires_quiz) return res.status(400).json({ error: 'QUIZ_NOT_REQUIRED' });

  const attempts = await query(
    `SELECT COUNT(*)::int AS cnt FROM quiz_attempts WHERE user_id=$1 AND course_id=$2 AND module_no=$3`,
    [uid, courseId, moduleNo]
  );
  if (attempts.rows[0].cnt >= attempt_limit) {
    return res.status(429).json({ error: 'ATTEMPT_LIMIT_REACHED' });
  }

  // Prosta ewaluacja odpowiadająca polu quiz_json (JSON string z polem questions[])
  let spec = null;
  try { spec = JSON.parse(quiz_json || '{}'); } catch {}
  const questions = Array.isArray(spec?.questions) ? spec.questions : [];

  // liczenie punktów (prosty wariant: single-choice)
  let correct = 0;
  for (let i = 0; i < questions.length && i < answers.length; i++) {
    const q = questions[i];
    const a = answers[i];
    if (q?.type === 'single' && typeof q.correct === 'number') {
      if (a === q.correct) correct++;
    }
    // Możesz rozbudować o multi, input itd.
  }
  const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
  const passed = score >= pass_score;

  await query(
    `INSERT INTO quiz_attempts (user_id, course_id, module_no, score, passed, answers)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [uid, courseId, moduleNo, score, passed, JSON.stringify(answers)]
  );

  if (passed) {
    // auto-oznaczenie modułu jako ukończonego (jeśli jeszcze nie)
    await query(
      'INSERT INTO progress (user_id, course_id, module_no) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [uid, courseId, moduleNo]
    );
    await logAudit({ userId: uid, action: 'QUIZ_PASS', entity: 'module', entityId: `${courseId}:${moduleNo}`, meta: { score } });
  } else {
    await logAudit({ userId: uid, action: 'QUIZ_FAIL', entity: 'module', entityId: `${courseId}:${moduleNo}`, meta: { score } });
  }

  res.json({ ok: true, score, passed });
});

export default router;
