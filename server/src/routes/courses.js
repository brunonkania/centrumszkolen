import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();

/**
 * GET /courses
 * Zwraca kursy użytkownika (z enrollments) z opcją include=modules (tylko meta).
 */
router.get('/', async (req, res) => {
  const qschema = z.object({
    include: z.string().optional()
  });
  const parsed = qschema.safeParse(req.query || {});
  const includeModules = parsed.success && parsed.data.include === 'modules';

  const me = await query('SELECT id FROM users WHERE email=$1', [req.user.sub]);
  if (me.rowCount === 0) return res.status(401).json({ error: 'USER_NOT_FOUND' });
  const uid = me.rows[0].id;

  const rs = await query(`
    SELECT c.id, c.title, c.price_cents, e.created_at AS enrolled_at
    FROM enrollments e
    JOIN courses c ON c.id=e.course_id
    WHERE e.user_id=$1
    ORDER BY c.id
  `, [uid]);

  const courses = rs.rows;

  if (!includeModules) return res.json({ courses });

  const ids = courses.map(c => c.id);
  if (ids.length === 0) return res.json({ courses: [] });

  const ms = await query(`
    SELECT m.course_id, m.module_no, m.title, m.requires_quiz, m.status
    FROM modules m
    WHERE m.course_id = ANY($1::int[])
    ORDER BY m.course_id, m.module_no
  `, [ids]);
  const byCourse = new Map();
  for (const m of ms.rows) {
    if (!byCourse.has(m.course_id)) byCourse.set(m.course_id, []);
    byCourse.get(m.course_id).push(m);
  }

  for (const c of courses) c.modules = byCourse.get(c.id) || [];
  res.json({ courses });
});

/**
 * POST /courses/:courseId/enroll
 * Ręczne przypisanie dostępu (np. kurs darmowy / admin nadaje dostęp).
 */
router.post('/:courseId/enroll', async (req, res) => {
  const pschema = z.object({ courseId: z.coerce.number().int().positive() });
  const p = pschema.safeParse(req.params);
  if (!p.success) return res.status(400).json({ error: 'INVALID_INPUT' });
  const courseId = p.data.courseId;

  const me = await query('SELECT id FROM users WHERE email=$1', [req.user.sub]);
  if (me.rowCount === 0) return res.status(401).json({ error: 'USER_NOT_FOUND' });
  const uid = me.rows[0].id;

  const c = await query('SELECT id FROM courses WHERE id=$1', [courseId]);
  if (c.rowCount === 0) return res.status(404).json({ error: 'COURSE_NOT_FOUND' });

  await query('INSERT INTO enrollments (user_id, course_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [uid, courseId]);
  await logAudit({ userId: uid, action: 'ENROLL_CREATE', entity: 'course', entityId: courseId });

  res.json({ ok: true });
});

export default router;
