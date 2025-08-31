import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

router.get('/:courseId/:moduleNo', async (req, res) => {
  const courseId = Number(req.params.courseId);
  const moduleNo = Number(req.params.moduleNo);
  const email = req.user?.sub;

  const u = await query('SELECT id FROM users WHERE email=$1', [email]);
  if (u.rowCount === 0) return res.status(401).json({ error: 'User not found' });
  const userId = u.rows[0].id;

  const m = await query('SELECT requires_quiz, pass_score, attempt_limit, quiz_json FROM modules WHERE course_id=$1 AND module_no=$2', [courseId, moduleNo]);
  if (m.rowCount === 0) return res.status(404).json({ error: 'MODULE_NOT_FOUND' });
  const row = m.rows[0];
  if (!row.requires_quiz) return res.status(404).json({ error: 'NO_QUIZ' });

  const attempts = await query('SELECT COUNT(*)::int AS cnt FROM quiz_attempts WHERE user_id=$1 AND course_id=$2 AND module_no=$3', [userId, courseId, moduleNo]);
  const left = Number(row.attempt_limit) - Number(attempts.rows[0].cnt);
  if (left <= 0) return res.status(403).json({ error: 'NO_ATTEMPTS_LEFT' });

  const quiz = JSON.parse(row.quiz_json || '{"questions":[]}');
  // randomize order for client
  const qs = (quiz.questions || []).map(q => {
    if (q.type === 'single' || q.type === 'multi' || Array.isArray(q.options)) {
      const idx = [...(q.options || [])].map((_, i) => i);
      const shuffledIdx = shuffle(idx);
      const options = shuffledIdx.map(i => q.options[i]);
      const correctIndices = Array.isArray(q.correct) ? q.correct : [q.correct];
      const newCorrect = correctIndices.map(ci => shuffledIdx.indexOf(ci));
      return { ...q, options, correct: newCorrect.length > 1 ? newCorrect : newCorrect[0] };
    }
    return q;
  });
  res.json({ passScore: Number(row.pass_score), attemptLimit: Number(row.attempt_limit), left, quiz: { questions: qs } });
});

router.post('/:courseId/:moduleNo/submit', async (req, res) => {
  const courseId = Number(req.params.courseId);
  const moduleNo = Number(req.params.moduleNo);
  const answers = req.body?.answers;
  const email = req.user?.sub;

  if (!Array.isArray(answers)) return res.status(400).json({ error: 'answers required' });

  const u = await query('SELECT id FROM users WHERE email=$1', [email]);
  if (u.rowCount === 0) return res.status(401).json({ error: 'User not found' });
  const userId = u.rows[0].id;

  const m = await query('SELECT requires_quiz, pass_score, attempt_limit, quiz_json FROM modules WHERE course_id=$1 AND module_no=$2', [courseId, moduleNo]);
  if (m.rowCount === 0) return res.status(404).json({ error: 'MODULE_NOT_FOUND' });
  const row = m.rows[0];
  if (!row.requires_quiz) return res.status(400).json({ error: 'NO_QUIZ' });

  const attempts = await query('SELECT COUNT(*)::int AS cnt FROM quiz_attempts WHERE user_id=$1 AND course_id=$2 AND module_no=$3', [userId, courseId, moduleNo]);
  if (Number(attempts.rows[0].cnt) >= Number(row.attempt_limit)) return res.status(403).json({ error: 'NO_ATTEMPTS_LEFT' });

  const quiz = JSON.parse(row.quiz_json || '{"questions":[]}');
  const qs = quiz.questions || [];
  let correct = 0;
  const norm = (v) => (Array.isArray(v) ? v.map(Number).sort().join(',') : String(Number(v)));
  qs.forEach((q, i) => {
    const ans = answers[i];
    const corr = q.type === 'multi' ? (q.correct || []) : [q.correct];
    if (norm(ans) === norm(corr)) correct++;
  });

  const score = qs.length ? Math.round((correct / qs.length) * 100) : 0;
  const passed = score >= Number(row.pass_score);

  await query('INSERT INTO quiz_attempts (user_id, course_id, module_no, score, passed, answers) VALUES ($1,$2,$3,$4,$5,$6)',
    [userId, courseId, moduleNo, score, passed, JSON.stringify(answers)]);

  if (passed) {
    await query('INSERT INTO progress (user_id, course_id, module_no) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [userId, courseId, moduleNo]);
  }

  res.json({ score, passed, required: Number(row.pass_score) });
});

export default router;
