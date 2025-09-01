// src/routes/payments.js
import { Router } from 'express';
import { z } from 'zod';
import { query, tx } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/**
 * POST /payments/create
 * body: { course_id: number }
 * Tworzy zamówienie (pending). Dla kursów za 0 zł -> od razu płatne i enrollment.
 */
router.post('/create', async (req, res, next) => {
  try {
    const bs = z.object({ course_id: z.coerce.number().int().positive() }).safeParse(req.body || {});
    if (!bs.success) return res.status(400).json({ error: 'INVALID_INPUT' });

    const uid = req.user?.uid || req.user?.id;
    const courseId = bs.data.course_id;

    const c = await query('SELECT id, price_cents, title FROM courses WHERE id=$1', [courseId]);
    if (c.rowCount === 0) return res.status(404).json({ error: 'COURSE_NOT_FOUND' });

    const price = c.rows[0].price_cents ?? 0;

    const order = await tx(async (client) => {
      // jeśli istnieje paid enrollment, nie rób nowego zamówienia
      const enr = await client.query(
        'SELECT 1 FROM enrollments WHERE user_id=$1 AND course_id=$2',
        [uid, courseId]
      );
      if (enr.rowCount > 0) {
        // zwróć pseudo-order paid
        return {
          id: 0,
          status: 'paid',
          course_id: courseId,
          amount_cents: 0,
        };
      }

      // utwórz zamówienie
      const r = await client.query(
        `INSERT INTO orders (user_id, course_id, amount_cents, status, provider)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id, user_id, course_id, amount_cents, status`,
        [uid, courseId, price, 'pending', 'dev']
      );
      const ord = r.rows[0];

      // jeżeli kurs jest darmowy, od razu „opłać” i dodaj enrollment
      if (price === 0) {
        await client.query(
          `UPDATE orders SET status='paid', paid_at=now() WHERE id=$1`,
          [ord.id]
        );
        await client.query(
          `INSERT INTO enrollments (user_id, course_id)
           VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [uid, courseId]
        );
        ord.status = 'paid';
      }

      return ord;
    });

    return res.json({
      ok: true,
      order: { id: order.id, course_id: courseId, amount_cents: order.amount_cents, status: order.status },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /payments/order/:orderId
 * Zwraca stan zamówienia użytkownika (autoryzacja właściciela).
 */
router.get('/order/:orderId', async (req, res) => {
  const ps = z.object({ orderId: z.coerce.number().int().positive() }).safeParse(req.params);
  if (!ps.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const uid = req.user?.uid || req.user?.id;
  const id = ps.data.orderId;

  const r = await query(
    `SELECT id, user_id, course_id, amount_cents, status, paid_at
     FROM orders WHERE id=$1`,
    [id]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
  const o = r.rows[0];
  if (o.user_id !== (uid | 0)) return res.status(403).json({ error: 'FORBIDDEN' });

  res.json({ order: { id: o.id, course_id: o.course_id, amount_cents: o.amount_cents, status: o.status, paid_at: o.paid_at } });
});

/**
 * POST /payments/:orderId/simulate-success
 * Oznacza płatność jako „paid” i dodaje enrollment.
 */
router.post('/:orderId/simulate-success', async (req, res, next) => {
  try {
    const ps = z.object({ orderId: z.coerce.number().int().positive() }).safeParse(req.params);
    if (!ps.success) return res.status(400).json({ error: 'INVALID_INPUT' });

    const uid = req.user?.uid || req.user?.id;
    const id = ps.data.orderId;

    await tx(async (client) => {
      const r = await client.query(
        `SELECT id, user_id, course_id, status FROM orders WHERE id=$1 FOR UPDATE`,
        [id]
      );
      if (r.rowCount === 0) throw Object.assign(new Error('ORDER_NOT_FOUND'), { status: 404, code: 'ORDER_NOT_FOUND' });
      const o = r.rows[0];
      if (o.user_id !== (uid | 0)) throw Object.assign(new Error('FORBIDDEN'), { status: 403, code: 'FORBIDDEN' });
      if (o.status === 'paid') return;

      await client.query(`UPDATE orders SET status='paid', paid_at=now() WHERE id=$1`, [id]);
      await client.query(
        `INSERT INTO enrollments (user_id, course_id)
         VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [uid, o.course_id]
      );
    });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
