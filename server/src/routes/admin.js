import { Router } from 'express';
import { z } from 'zod';
import { query, tx } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();

// Wszystko poniżej: tylko zalogowany admin
router.use(requireAuth, requireAdmin);

// GET /admin/courses
router.get('/courses', async (_req, res) => {
  const rs = await query('SELECT id, title, price_cents FROM courses ORDER BY id');
  res.json({ courses: rs.rows });
});

// POST /admin/courses
router.post('/courses', async (req, res) => {
  const bs = z.object({
    title: z.string().trim().min(3),
    price_cents: z.coerce.number().int().min(0),
    description: z.string().trim().optional().default(''),
  }).safeParse(req.body || {});
  if (!bs.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const { title, price_cents, description } = bs.data;
  const r = await query(
    'INSERT INTO courses (title, price_cents, description) VALUES ($1,$2,$3) RETURNING id, title, price_cents',
    [title, price_cents, description]
  );

  await logAudit({ userId: req.user.uid || req.user.id, action: 'COURSE_CREATE', entity: 'course', entityId: String(r.rows[0].id) });
  res.status(201).json({ course: r.rows[0] });
});

// GET /admin/modules?course_id=1
router.get('/modules', async (req, res) => {
  const qs = z.object({ course_id: z.coerce.number().int().positive() }).safeParse(req.query || {});
  if (!qs.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const r = await query(
    'SELECT course_id, module_no, title, status, requires_quiz, pass_score, attempt_limit FROM modules WHERE course_id=$1 ORDER BY module_no',
    [qs.data.course_id]
  );
  res.json({ modules: r.rows });
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
    status: z.enum(['draft', 'published']).optional().default('published'),
  }).safeParse(req.body || {});
  if (!bs.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const {
    course_id, module_no, title, content_html, video_url,
    requires_quiz, pass_score, attempt_limit, quiz_json, status,
  } = bs.data;

  await tx(async (client) => {
    await client.query(
      `INSERT INTO modules
       (course_id, module_no, title, content_html, video_url, requires_quiz, pass_score, attempt_limit, quiz_json, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (course_id, module_no)
       DO UPDATE SET title=EXCLUDED.title, content_html=EXCLUDED.content_html, video_url=EXCLUDED.video_url,
                     requires_quiz=EXCLUDED.requires_quiz, pass_score=EXCLUDED.pass_score,
                     attempt_limit=EXCLUDED.attempt_limit, quiz_json=EXCLUDED.quiz_json, status=EXCLUDED.status`,
      [course_id, module_no, title, content_html, video_url || '', requires_quiz, pass_score, attempt_limit, quiz_json, status]
    );
  });

  await logAudit({ userId: req.user.uid || req.user.id, action: 'MODULE_UPSERT', entity: 'module', entityId: `${course_id}:${module_no}` });
  res.status(201).json({ ok: true });
});

export default router;
