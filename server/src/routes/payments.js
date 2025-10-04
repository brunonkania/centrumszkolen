import { Router } from 'express';
import { q } from '../db.js';
import { z } from 'zod';
import {
  PAYMENTS_PROVIDER, PAYU_CLIENT_ID, PAYU_CLIENT_SECRET, PAYU_POS_ID, PAYU_SANDBOX,
  PUBLIC_BASE_URL, FRONTEND_BASE_URL, MAGIC_LINK_TTL_HOURS
} from '../config.js';
import { randomBytes } from 'crypto';
import fetch from 'node-fetch';
import { sendMagicLinkEmail } from '../util/email.js';

export const paymentsRouter = Router();

const payuUrls = PAYU_SANDBOX ? {
  oauth: 'https://secure.snd.payu.com/pl/standard/user/oauth/authorize',
  orders: 'https://secure.snd.payu.com/api/v2_1/orders'
} : {
  oauth: 'https://secure.payu.com/pl/standard/user/oauth/authorize',
  orders: 'https://secure.payu.com/api/v2_1/orders'
};

async function payuToken() {
  const res = await fetch(payuUrls.oauth, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: PAYU_CLIENT_ID,
      client_secret: PAYU_CLIENT_SECRET
    })
  });
  if (!res.ok) throw new Error(`PayU OAuth failed: ${res.status}`);
  return res.json();
}

// POST /api/payments/create  { orderId }
paymentsRouter.post('/create', async (req, res, next) => {
  try {
    const schema = z.object({ orderId: z.string().uuid() });
    const { orderId } = schema.parse(req.body);

    const { rows: ords } = await q(
      `select o.id, o.amount_cents, o.currency, o.email, c.title
       from orders o join courses c on c.id=o.course_id where o.id=$1`,
      [orderId]
    );
    if (!ords.length) return res.status(404).json({ ok: false, error: { message: 'Order not found' } });
    const ord = ords[0];

    // FAKE provider — natychmiast potwierdzamy i generujemy magic link
    if (PAYMENTS_PROVIDER === 'fake') {
      await q('update orders set status=$1 where id=$2', ['paid', orderId]);

      // NIE BLOKUJ ODPOWIEDZI: wygeneruj link i wyślij e-mail „best-effort”
      generateAndSendMagicLink(orderId)
        .catch((err) => console.error('[PAYMENTS] generateAndSendMagicLink error:', err?.message || err));

      return res.json({ ok: true, data: { redirectUrl: `${FRONTEND_BASE_URL}/thank-you.html?order=${orderId}` } });
    }

    // PAYU – zbuduj zamówienie i zwróć redirectUri
    const oauth = await payuToken();
    const body = {
      notifyUrl: `${PUBLIC_BASE_URL}/api/payments/webhook`,
      continueUrl: `${FRONTEND_BASE_URL}/thank-you.html?order=${orderId}`,
      customerIp: '127.0.0.1',
      merchantPosId: PAYU_POS_ID,
      description: `Dostęp do kursu`,
      currencyCode: ord.currency,
      totalAmount: String(ord.amount_cents),
      buyer: { email: ord.email },
      products: [{
        name: ord.title,
        unitPrice: String(ord.amount_cents),
        quantity: '1'
      }],
      extOrderId: orderId
    };

    const r = await fetch(payuUrls.orders, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${oauth.access_token}`
      },
      body: JSON.stringify(body)
    });

    const data = await r.json();
    if (!r.ok) {
      console.error('[PayU Error]', data);
      return res.status(400).json({ ok: false, error: { message: 'PayU create order failed' } });
    }

    await q('update orders set payu_order_id=$1 where id=$2', [data.orderId, orderId]);
    res.json({ ok: true, data: { redirectUrl: data.redirectUri } });
  } catch (e) { next(e); }
});

// Webhook PayU
paymentsRouter.post('/webhook', async (req, res, next) => {
  try {
    const body = req.body;
    const order = body?.order;
    if (!order?.orderId || !order?.status) return res.status(400).json({ ok: false });

    const { rows } = await q('select id, status from orders where payu_order_id=$1', [order.orderId]);
    if (!rows.length) return res.status(200).json({ ok: true }); // ignoruj nieznane

    const local = rows[0];
    if (order.status === 'COMPLETED' && local.status !== 'paid') {
      await q('update orders set status=$1 where id=$2', ['paid', local.id]);
      generateAndSendMagicLink(local.id)
        .catch((err) => console.error('[PAYMENTS] generateAndSendMagicLink error:', err?.message || err));
    }

    res.status(200).json({ ok: true });
  } catch (e) { next(e); }
});

async function generateAndSendMagicLink(orderId) {
  const token = randomBytes(32).toString('hex');
  const { rows: ords } = await q(
    `select o.id, o.email, c.title
     from orders o join courses c on c.id=o.course_id where o.id=$1`,
    [orderId]
  );
  if (!ords.length) return;

  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_HOURS * 3600 * 1000);
  await q(
    'insert into magic_links (order_id, token, expires_at) values ($1,$2,$3)',
    [orderId, token, expiresAt.toISOString()]
  );

  const linkUrl = `${PUBLIC_BASE_URL}/access/${token}`;
  // Nie przerywaj flow jeśli e-mail padnie – tylko zaloguj
  try {
    const r = await sendMagicLinkEmail({
      to: ords[0].email,
      courseTitle: ords[0].title,
      linkUrl,
      expiresAt: expiresAt.toLocaleString('pl-PL')
    });
    if (!r?.ok) console.warn('[EMAIL] wysyłka pominięta/nieudana:', r?.reason || r);
  } catch (err) {
    console.error('[EMAIL] wyjatek wysylki:', err?.message || err);
  }
}
