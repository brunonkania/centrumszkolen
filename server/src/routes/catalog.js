import { Router } from 'express';
import { q } from '../db.js';
import { z } from 'zod';
import { FRONTEND_BASE_URL } from '../config.js';

export const catalogRouter = Router();

// GET /api/catalog – lista kursów
catalogRouter.get('/', async (_req, res, next) => {
  try {
    const { rows } = await q(
      'select slug, title, description, price_gross_cents as price, currency, image_url from courses order by created_at desc'
    );
    res.json({ ok: true, data: rows });
  } catch (e) { next(e); }
});

// GET /api/catalog/:slug – szczegóły kursu
catalogRouter.get('/:slug', async (req, res, next) => {
  try {
    const { rows } = await q(
      'select id, slug, title, description, price_gross_cents as price, currency, image_url from courses where slug=$1',
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: { message: 'Course not found' } });
    res.json({ ok: true, data: rows[0] });
  } catch (e) { next(e); }
});

// POST /api/catalog/:slug/order – tworzy zamówienie PENDING (bez płatności)
catalogRouter.post('/:slug/order', async (req, res, next) => {
  try {
    const schema = z.object({ email: z.string().email() });
    const { email } = schema.parse(req.body);

    const { rows: c } = await q('select id, price_gross_cents, currency, title from courses where slug=$1', [req.params.slug]);
    if (!c.length) return res.status(404).json({ ok: false, error: { message: 'Course not found' } });

    const course = c[0];
    const { rows: o } = await q(
      'insert into orders (course_id, email, amount_cents, currency) values ($1,$2,$3,$4) returning id',
      [course.id, email, course.price_gross_cents, course.currency]
    );

    res.json({
      ok: true,
      data: {
        orderId: o[0].id,
        amount_cents: course.price_gross_cents,
        currency: course.currency,
        returnUrl: `${FRONTEND_BASE_URL}/thank-you?order=${o[0].id}`
      }
    });
  } catch (e) { next(e); }
});
