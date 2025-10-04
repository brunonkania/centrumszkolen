import { Router } from 'express';
import { q } from '../db.js';

export const recipientRouter = Router();

// GET /api/orders/:orderId/recipient
recipientRouter.get('/:orderId/recipient', async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const { rows: ords } = await q(
      `select o.id, o.email, c.title as course_title
       from orders o join courses c on c.id=o.course_id
       where o.id=$1`,
      [orderId]
    );
    if (!ords.length) {
      return res.status(404).json({ ok: false, error: { message: 'Order not found' } });
    }

    const { rows: rec } = await q('select * from order_recipients where order_id=$1', [orderId]);

    if (rec.length) {
      const r = rec[0];
      return res.json({ ok: true, data: {
        order_id: r.order_id,
        first_name: r.first_name,
        last_name:  r.last_name,
        email:      r.email,
        phone:      r.phone,
        address_line1: r.address_line1,
        address_line2: r.address_line2,
        postal_code:   r.postal_code,
        city:          r.city,
        country:       r.country,
        shipping_method: r.shipping_method,
        company_name:  r.company_name,
        company_nip:   r.company_nip
      }});
    }

    // brak rekordu – prefill tylko email
    return res.json({ ok: true, data: {
      order_id: orderId,
      first_name: '',
      last_name: '',
      email: ords[0].email,
      phone: '',
      address_line1: '',
      address_line2: '',
      postal_code: '',
      city: '',
      country: 'Polska',
      shipping_method: 'standard',
      company_name: '',
      company_nip: ''
    }});
  } catch (e) { next(e); }
});

// PUT /api/orders/:orderId/recipient
recipientRouter.put('/:orderId/recipient', async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const b = Object.fromEntries(
      Object.entries(req.body || {}).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
    );

    // minimalna walidacja
    const required = ['first_name','last_name','email','address_line1','postal_code','city'];
    const missing = required.filter(k => !b[k] || String(b[k]).trim() === '');
    if (missing.length) {
      return res.status(400).json({ ok: false, error: { message: `Brak pól: ${missing.join(', ')}` } });
    }
    if (!/^\d{2}-\d{3}$/.test(b.postal_code)) {
      return res.status(400).json({ ok: false, error: { message: 'Zły format kodu pocztowego (12-345)' } });
    }

    const { rows: ords } = await q('select id from orders where id=$1', [orderId]);
    if (!ords.length) return res.status(404).json({ ok: false, error: { message: 'Order not found' } });

    const params = [
      orderId,
      b.first_name,
      b.last_name,
      b.email,
      b.phone || null,
      b.address_line1,
      b.address_line2 || null,
      b.postal_code,
      b.city,
      b.country || 'Polska',
      b.shipping_method || 'standard',
      b.company_name || null,
      b.company_nip || null
    ];

    const { rows } = await q(
      `insert into order_recipients
        (order_id, first_name, last_name, email, phone, address_line1, address_line2, postal_code, city, country, shipping_method, company_name, company_nip)
       values
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       on conflict (order_id) do update set
        first_name=excluded.first_name,
        last_name=excluded.last_name,
        email=excluded.email,
        phone=excluded.phone,
        address_line1=excluded.address_line1,
        address_line2=excluded.address_line2,
        postal_code=excluded.postal_code,
        city=excluded.city,
        country=excluded.country,
        shipping_method=excluded.shipping_method,
        company_name=excluded.company_name,
        company_nip=excluded.company_nip
       returning *`,
      params
    );

    return res.json({ ok: true, data: rows[0] });
  } catch (e) {
    console.error('[recipient.put] error:', e);
    next(e);
  }
});
