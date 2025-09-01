import { Router } from 'express';
import { z } from 'zod';
import { query, tx } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();

const PAYMENTS_ENABLED = String(process.env.PAYMENTS_ENABLED || 'false') === 'true';
const PROVIDER = (process.env.PAYMENTS_PROVIDER || 'P24').toUpperCase();
const FRONT_URL = process.env.FRONT_URL || 'http://localhost:5173';

function ensureEnabled() {
  if (!PAYMENTS_ENABLED) {
    const err = new Error('PAYMENTS_DISABLED');
    err.code = 'PAYMENTS_DISABLED';
    err.status = 503;
    throw err;
  }
}

// POST /payments/create
router.post('/create', requireAuth, async (req, res) => {
  const bschema = z.object({ courseId: z.coerce.number().int().positive() });
  const b = bschema.safeParse(req.body || {});
  if (!b.success) return res.status(400).json({ error: 'INVALID_INPUT' });
  const courseId = b.data.courseId;

  const me = await query('SELECT id FROM users WHERE email=$1', [req.user.sub]);
  if (me.rowCount === 0) return res.status(401).json({ error: 'USER_NOT_FOUND' });
  const userId = me.rows[0].id;

  const c = await query('SELECT id, title, price_cents FROM courses WHERE id=$1', [courseId]);
  if (c.rowCount === 0) return res.status(404).json({ error: 'COURSE_NOT_FOUND' });
  const course = c.rows[0];

  const enr = await query('SELECT 1 FROM enrollments WHERE user_id=$1 AND course_id=$2', [userId, courseId]);
  if (enr.rowCount > 0) return res.status(409).json({ error: 'ALREADY_ENROLLED' });

  const ins = await query(
    `INSERT INTO orders (user_id, course_id, amount_cents, currency, status, provider, provider_order_id)
     VALUES ($1,$2,$3,'PLN','pending',$4,NULL) RETURNING id`,
    [userId, courseId, course.price_cents, PROVIDER]
  );
  const orderId = ins.rows[0].id;

  await logAudit({ userId, action: 'PAYMENT_ORDER_CREATE', entity: 'order', entityId: orderId, meta: { provider: PROVIDER, courseId } });

  if (!PAYMENTS_ENABLED) {
    return res.status(503).json({
      error: 'PAYMENTS_DISABLED',
      orderId,
      message: 'Płatności chwilowo wyłączone. Zamówienie zapisane jako pending.'
    });
  }

  // TODO: integrate with provider SDK/API here
  const providerOrderId = `DEMO-${orderId}`;
  const redirectUrl = `${FRONT_URL}/platnosc.html?order=${orderId}&redirected=1`;

  await query('UPDATE orders SET provider_order_id=$1 WHERE id=$2', [providerOrderId, orderId]);
  return res.json({ ok: true, orderId, provider: PROVIDER, redirectUrl });
});

// GET /payments/return
router.get('/return', async (req, res) => {
  const qschema = z.object({ order: z.string().optional() });
  const q = qschema.safeParse(req.query || {});
  const orderId = q.success ? q.data.order : '';
  return res.redirect(`${FRONT_URL}/platnosc.html?order=${encodeURIComponent(orderId || '')}`);
});

// POST /payments/notify
router.post('/notify', async (req, res) => {
  // W realu: weryfikacja podpisu webhooka
  const bschema = z.object({
    provider_order_id: z.string().min(1),
    status: z.enum(['PAID', 'SUCCESS', 'FAILED', 'CANCELED']).or(z.string())
  });
  const b = bschema.safeParse(req.body || {});
  if (!b.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const { provider_order_id, status } = b.data;

  const ord = await query('SELECT id, user_id, course_id, status FROM orders WHERE provider_order_id=$1', [provider_order_id]);
  if (ord.rowCount === 0) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
  const order = ord.rows[0];

  if (status === 'PAID' || status === 'SUCCESS') {
    await tx(async (client) => {
      await client.query('UPDATE orders SET status=$1, paid_at=now(), notify_payload=$2 WHERE id=$3', ['paid', JSON.stringify(req.body || {}), order.id]);
      await client.query('INSERT INTO enrollments (user_id, course_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [order.user_id, order.course_id]);
    });
    await logAudit({ userId: order.user_id, action: 'PAYMENT_PAID', entity: 'order', entityId: order.id });
  } else {
    await query('UPDATE orders SET status=$1, notify_payload=$2 WHERE id=$3', [String(status).toLowerCase(), JSON.stringify(req.body || {}), order.id]);
    await logAudit({ userId: order.user_id, action: 'PAYMENT_STATUS', entity: 'order', entityId: order.id, meta: { status } });
  }

  res.json({ ok: true });
});

export default router;
