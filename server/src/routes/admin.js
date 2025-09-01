import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();

// Wszystkie endpointy poniżej wymagają roli admin (app.js już woła requireAuth na /admin)
router.use(requireAdmin);

// GET /admin/courses
router.get('/courses', async (_req, res) => {
  const rs = await query('SELECT id, title, price_cents FROM courses ORDER BY id');
  res.json({ courses: rs.rows });
});

// POST /admin/courses
router.post('/courses', async (req, res) => {
  const schema = z.object({
    title: z.string().trim().min(3),
    price_cents: z.coerce.number().int().min(0)
  });
  const b = schema.safeParse(req.body || {});
  if (!b.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const { title, price_cents } = b.data;
  const ins = await query('INSERT INTO courses (title, price_cents) VALUES ($1,$2) RETURNING id', [title, price_cents]);
  await logAudit({ userId: req.user?.uid ?? null, action: 'COURSE_CREATE', entity: 'course', entityId: ins.rows[0].id, meta: { title, price_cents } });

  res.status(201).json({ ok: true, id: ins.rows[0].id });
});

// PUT /admin/courses/:id
router.put('/courses/:id', async (req, res) => {
  const ps = z.object({ id: z.coerce.number().int().positive() }).safeParse(req.params);
  if (!ps.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const bs = z.object({
    title: z.string().trim().min(3),
    price_cents: z.coerce.number().int().min(0)
  }).safeParse(req.body || {});
  if (!bs.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const { id } = ps.data;
  const { title, price_cents } = bs.data;

  const upd = await query('UPDATE courses SET title=$1, price_cents=$2 WHERE id=$3', [title, price_cents, id]);
  if (upd.rowCount === 0) return res.status(404).json({ error: 'COURSE_NOT_FOUND' });

  await logAudit({ userId: req.user?.uid ?? null, action: 'COURSE_UPDATE', entity: 'course', entityId: id, meta: { title, price_cents } });
  res.json({ ok: true });
});

// DELETE /admin/courses/:id
router.delete('/courses/:id', async (req, res) => {
  const ps = z.object({ id: z.coerce.number().int().positive() }).safeParse(req.params);
  if (!ps.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const { id } = ps.data;
  const del = await query('DELETE FROM courses WHERE id=$1', [id]);
  if (del.rowCount === 0) return res.status(404).json({ error: 'COURSE_NOT_FOUND' });

  await logAudit({ userId: req.user?.uid ?? null, action: 'COURSE_DELETE', entity: 'course', entityId: id });
  res.json({ ok: true });
});

// GET /admin/modules?courseId=...
router.get('/modules', async (req, res) => {
  const qs = z.object({ courseId: z.coerce.number().int().positive() }).safeParse(req.query || {});
  if (!qs.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const { courseId } = qs.data;
  const rs = await query(
    'SELECT id, course_id, module_no, title, status, requires_quiz, pass_score, attempt_limit FROM modules WHERE course_id=$1 ORDER BY module_no',
    [courseId]
  );
  res.json({ modules: rs.rows });
});

// POST /admin/modules
router.post('/modules', async (req, res) => {
  const bs = z.object({
    course_id: z.coerce.number().int().positive(),
    module_no: z.coerce.number().int().positive(),
    title: z.string().trim().min(3),
    content_html: z.string().optional().default(''),
    video_url: z.string().url().optional().or(z.literal('').transform(() => '')),
    requires_quiz: z.coerce.boolean().optional().default(false),
    pass_score: z.coerce.number().int().min(0).max(100).optional().default(70),
    attempt_limit: z.coerce.number().int().min(1).max(10).optional().default(3),
    quiz_json: z.string().optional().default(''),
    status: z.enum(['draft', 'published']).optional().default('published')
  }).safeParse(req.body || {});
  if (!bs.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const v = bs.data;
  const ins = await query(
    `INSERT INTO modules (course_id, module_no, title, content_html, video_url, requires_quiz, pass_score, attempt_limit, quiz_json, status, published_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, CASE WHEN $10='published' THEN now() ELSE NULL END)
     RETURNING id`,
    [v.course_id, v.module_no, v.title, v.content_html, v.video_url || '', v.requires_quiz, v.pass_score, v.attempt_limit, v.quiz_json || '', v.status]
  );

  await logAudit({ userId: req.user?.uid ?? null, action: 'MODULE_CREATE', entity: 'module', entityId: ins.rows[0].id, meta: { course_id: v.course_id, module_no: v.module_no } });
  res.status(201).json({ ok: true, id: ins.rows[0].id });
});

// PUT /admin/modules/:id
router.put('/modules/:id', async (req, res) => {
  const ps = z.object({ id: z.coerce.number().int().positive() }).safeParse(req.params);
  if (!ps.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const bs = z.object({
    title: z.string().trim().min(3),
    content_html: z.string().optional().default(''),
    video_url: z.string().url().optional().or(z.literal('').transform(() => '')),
    requires_quiz: z.coerce.boolean(),
    pass_score: z.coerce.number().int().min(0).max(100),
    attempt_limit: z.coerce.number().int().min(1).max(10),
    quiz_json: z.string().optional().default(''),
    status: z.enum(['draft', 'published'])
  }).safeParse(req.body || {});
  if (!bs.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const v = bs.data;
  const upd = await query(
    `UPDATE modules
     SET title=$1, content_html=$2, video_url=$3, requires_quiz=$4, pass_score=$5, attempt_limit=$6, quiz_json=$7, status=$8,
         published_at = CASE WHEN $8='published' THEN COALESCE(published_at, now()) ELSE NULL END
     WHERE id=$9`,
    [v.title, v.content_html || '', v.video_url || '', v.requires_quiz, v.pass_score, v.attempt_limit, v.quiz_json || '', v.status, ps.data.id]
  );
  if (upd.rowCount === 0) return res.status(404).json({ error: 'MODULE_NOT_FOUND' });

  await logAudit({ userId: req.user?.uid ?? null, action: 'MODULE_UPDATE', entity: 'module', entityId: ps.data.id });
  res.json({ ok: true });
});

// DELETE /admin/modules/:id
router.delete('/modules/:id', async (req, res) => {
  const ps = z.object({ id: z.coerce.number().int().positive() }).safeParse(req.params);
  if (!ps.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const del = await query('DELETE FROM modules WHERE id=$1', [ps.data.id]);
  if (del.rowCount === 0) return res.status(404).json({ error: 'MODULE_NOT_FOUND' });

  await logAudit({ userId: req.user?.uid ?? null, action: 'MODULE_DELETE', entity: 'module', entityId: ps.data.id });
  res.json({ ok: true });
});

export default router;
