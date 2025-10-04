import { Router } from 'express';
import { q } from '../db.js';
import { z } from 'zod';

export const quizRouter = Router();

// GET /api/quiz/:slug – pobierz pytania i odpowiedzi (prosty format)
quizRouter.get('/:slug', async (req, res, next) => {
  try {
    const { rows: c } = await q('select id from courses where slug=$1', [req.params.slug]);
    if (!c.length) return res.status(404).json({ ok: false, error: { message: 'Course not found' } });
    const courseId = c[0].id;

    const { rows: questions } = await q('select id, text from quiz_questions where course_id=$1 order by id', [courseId]);
    const ids = questions.map(qr => qr.id);
    let answers = [];
    if (ids.length) {
      const { rows } = await q(`select id, question_id, text from quiz_answers where question_id = any($1)`, [ids]);
      answers = rows;
    }
    const data = questions.map(qr => ({ id: qr.id, text: qr.text, answers: answers.filter(a => a.question_id === qr.id) }));
    res.json({ ok: true, data });
  } catch (e) { next(e); }
});

// POST /api/quiz/:slug/submit { orderId, answers: [{questionId, answerId}] }
quizRouter.post('/:slug/submit', async (req, res, next) => {
  try {
    const schema = z.object({
      orderId: z.string().uuid(),
      answers: z.array(z.object({ questionId: z.number(), answerId: z.number() })).nonempty()
    });
    const { orderId, answers } = schema.parse(req.body);

    const { rows: ords } = await q(
      `select o.id, o.status, c.id as course_id
       from orders o join courses c on c.id=o.course_id
       where o.id=$1`, [orderId]
    );
    if (!ords.length) return res.status(404).json({ ok: false, error: { message: 'Order not found' } });
    if (ords[0].status !== 'paid') return res.status(403).json({ ok: false, error: { message: 'Order not paid' } });

    // Sprawdź poprawność
    const ids = answers.map(a => a.answerId);
    const { rows: corr } = await q(
      `select qa.id from quiz_answers qa
       join quiz_questions qq on qq.id = qa.question_id
       where qa.id = any($1) and qa.is_correct = true and qq.course_id = $2`,
      [ids, ords[0].course_id]
    );
    const correctCount = corr.length;
    const score = Math.round((correctCount / answers.length) * 100);
    const passed = score >= 80;

    await q(
      'insert into quiz_attempts (order_id, score_percent, passed) values ($1,$2,$3)',
      [orderId, score, passed]
    );

    res.json({ ok: true, data: { score, passed } });
  } catch (e) { next(e); }
});
