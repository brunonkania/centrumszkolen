// src/routes/guest.js
import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, tx } from '../db.js';
import { env } from '../config/env.js';
import { apiLimiter } from '../middleware/security.js';
import { sendEmail, renderTemplate } from '../util/email.js';
import { setAuthCookies } from '../middleware/auth.js';

const router = Router();

/**
 * POST /guest/checkout
 * body: { email: string, name?: string, course_id: number }
 * Tworzy "ciche" konto (bez hasła używalnego przez UI), zamówienie opłacone (na razie fake),
 * enrollment i link z tokenem do natychmiastowego wejścia w kurs.
 */
router.post('/checkout', apiLimiter, async (req, res, next) => {
  try {
    const bs = z.object({
      email: z.string().email(),
      name: z.string().trim().min(1).max(120).optional(),
      course_id: z.coerce.number().int().positive(),
    }).safeParse(req.body || {});
    if (!bs.success) return res.status(400).json({ error: 'INVALID_INPUT' });

    const { email, name, course_id } = bs.data;
    const emailLc = email.toLowerCase();

    const result = await tx(async (client) => {
      // 1) Kurs i cena
      const cr = await client.query(
        'SELECT id, title, price_cents FROM courses WHERE id=$1',
        [course_id]
      );
      if (cr.rowCount === 0) throw Object.assign(new Error('COURSE_NOT_FOUND'), { status: 404, code: 'COURSE_NOT_FOUND' });
      const course = cr.rows[0];

      // 2) Użytkownik: znajdź lub załóż "ciche konto" (z losowym hashem)
      let userId;
      const ur = await client.query('SELECT id, email, name FROM users WHERE email=$1', [emailLc]);
      if (ur.rowCount > 0) {
        userId = ur.rows[0].id;
      } else {
        const randPass = crypto.randomBytes(16).toString('hex');
        const password_hash = await bcrypt.hash(randPass, 10);
        const defaultName = name || emailLc.split('@')[0];
        const ins = await client.query(
          `INSERT INTO users (email, password_hash, name, role)
           VALUES ($1,$2,$3,'user') RETURNING id`,
          [emailLc, password_hash, defaultName]
        );
        userId = ins.rows[0].id;
      }

      // 3) Zamówienie: na razie oznaczamy jako paid (fake provider)
      const ord = await client.query(
        `INSERT INTO orders (user_id, course_id, amount_cents, status, provider)
         VALUES ($1,$2,$3,'paid','fake') RETURNING id`,
        [userId, course.id, course.price_cents | 0]
      );

      // 4) Enrollment
      await client.query(
        `INSERT INTO enrollments (user_id, course_id)
         VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [userId, course.id]
      );

      // 5) Magic link (stały dostęp przez token w URL; można dodać expires_at)
      const token = crypto.randomBytes(24).toString('hex');
      await client.query(
        `INSERT INTO magic_links (token, user_id, course_id, created_at)
         VALUES ($1,$2,$3, now())`,
        [token, userId, course.id]
      );

      return { userId, course, orderId: ord.rows[0].id, token };
    });

    // 6) E-mail z linkiem
    const front = env.FRONT_URL || 'http://localhost:8080';
    const link = `${front}/guest.html?token=${result.token}`;
    const html = renderTemplate('guest_link', {
      course: { title: result.course.title },
      link,
    });
    await sendEmail({
      to: emailLc,
      subject: `Dostęp do kursu: ${result.course.title}`,
      html,
      text: `Dostęp do kursu: ${result.course.title}\n\nOtwórz link: ${link}`
    });

    return res.json({
      ok: true,
      message: 'Wysłaliśmy link z dostępem do kursu na podany e-mail.',
      order_id: result.orderId
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /guest/access/:token
 * Weryfikuje magiczny token, wystawia standardowy access cookie (JWT) i zwraca docelowy kurs.
 * Ten endpoint NIE wymaga CSRF i może być klikany bezpośrednio z maila.
 */
router.get('/access/:token', async (req, res, next) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(400).json({ error: 'INVALID_TOKEN' });

    const r = await query(
      `SELECT ml.user_id, ml.course_id, u.email, u.role
       FROM magic_links ml
       JOIN users u ON u.id = ml.user_id
       WHERE ml.token=$1`,
      [token]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'TOKEN_NOT_FOUND' });

    const row = r.rows[0];
    // (opcjonalnie: sprawdź expires_at/used_at)

    // Wystaw zwykły access cookie – wtedy cały obecny frontend działa "jak zalogowany".
    const payload = { sub: row.user_id, role: row.role || 'user', email: row.email };
    const access = jwt.sign(payload, env.JWT_SECRET, { expiresIn: `${env.ACCESS_TTL_MIN}m` });
    setAuthCookies(res, { access });

    return res.json({ ok: true, course_id: row.course_id });
  } catch (e) {
    next(e);
  }
});

export default router;
