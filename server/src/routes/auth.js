import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';

import { query, tx } from '../db.js';
import { setAuthCookies, clearAuthCookies, requireAuth } from '../middleware/auth.js';
import { sendEmail, renderTemplate } from '../util/email.js';
import { resendVerificationLimiter, passwordForgotLimiter } from '../middleware/ratelimits.js';

const router = Router();
const APP_URL = process.env.APP_URL || 'http://localhost:3001';
const APP_NAME = process.env.APP_NAME || 'Centrum Szkoleń';

// /auth/me
router.get('/me', requireAuth, async (req, res) => {
  const u = await query('SELECT id, email, name, role, email_verified FROM users WHERE email=$1', [req.user.sub]);
  if (u.rowCount === 0) return res.status(404).json({ error: 'USER_NOT_FOUND' });
  res.json({ user: u.rows[0] });
});

// /auth/register
router.post('/register', async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().trim().min(1)
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_INPUT' });
  const { email, password, name } = parsed.data;

  const exists = await query('SELECT 1 FROM users WHERE email=$1', [email]);
  if (exists.rowCount > 0) return res.status(409).json({ error: 'EMAIL_TAKEN' });

  const hash = await bcrypt.hash(password, 10);
  const ins = await query(
    'INSERT INTO users (email, password_hash, name, role, email_verified) VALUES ($1,$2,$3,$4,$5) RETURNING id, email, name, role, email_verified',
    [email, hash, name, 'user', false]
  );
  const user = ins.rows[0];

  const token = crypto.randomBytes(32).toString('hex');
  await query('INSERT INTO email_verifications (user_id, token) VALUES ($1,$2)', [user.id, token]);
  const verifyLink = `${APP_URL}/auth/verify?token=${encodeURIComponent(token)}`;

  const html = renderTemplate('verify', {
    subject: 'Potwierdź swój adres e-mail',
    user: { name: user.name || '' },
    links: { verify: verifyLink },
    app: { name: APP_NAME }
  });
  await sendEmail({ to: email, subject: 'Potwierdź swój adres e-mail', html });

  res.status(201).json({ ok: true, user: { email: user.email, name: user.name, role: user.role, email_verified: user.email_verified } });
});

// /auth/verify/resend  (limitowane)
router.post('/verify/resend', resendVerificationLimiter, async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const { email } = parsed.data;
  const rs = await query('SELECT id, name, email_verified FROM users WHERE email=$1', [email]);
  if (rs.rowCount === 0) return res.json({ ok: true });
  const user = rs.rows[0];
  if (user.email_verified) return res.json({ ok: true });

  await query('UPDATE email_verifications SET used_at=now() WHERE user_id=$1 AND used_at IS NULL', [user.id]);
  const token = crypto.randomBytes(32).toString('hex');
  await query('INSERT INTO email_verifications (user_id, token) VALUES ($1,$2)', [user.id, token]);

  const verifyLink = `${APP_URL}/auth/verify?token=${encodeURIComponent(token)}`;
  const html = renderTemplate('verify', {
    subject: 'Twój nowy link do weryfikacji e-maila',
    user: { name: user.name || '' },
    links: { verify: verifyLink },
    app: { name: APP_NAME }
  });
  await sendEmail({ to: email, subject: 'Twój nowy link do weryfikacji e-maila', html });

  res.json({ ok: true });
});

// /auth/login
router.post('/login', async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6)
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const { email, password } = parsed.data;
  const rs = await query('SELECT id, email, password_hash, name, role, email_verified FROM users WHERE email=$1', [email]);
  if (rs.rowCount === 0) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  const user = rs.rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  if (!user.email_verified) return res.status(403).json({ error: 'EMAIL_NOT_VERIFIED' });

  await setAuthCookies(res, user.id, user.email, user.name, user.role);
  res.json({ ok: true, user: { email: user.email, name: user.name, role: user.role, email_verified: user.email_verified } });
});

// /auth/refresh  — rotacja refresh tokenów (jak wcześniej)
router.post('/refresh', async (req, res) => {
  const oldToken = req.cookies['refresh'];
  if (!oldToken) return res.status(401).json({ error: 'NO_REFRESH' });

  try {
    await tx(async (client) => {
      const rs = await client.query(
        `SELECT rt.user_id, u.email, u.name, u.role
           FROM refresh_tokens rt
           JOIN users u ON u.id = rt.user_id
          WHERE rt.token=$1
            AND rt.revoked_at IS NULL
            AND rt.expires_at > now()
          FOR UPDATE`,
        [oldToken]
      );
      if (rs.rowCount === 0) {
        const e = new Error('INVALID_REFRESH');
        e.status = 401;
        throw e;
      }
      const row = rs.rows[0];
      await client.query('UPDATE refresh_tokens SET revoked_at=now() WHERE token=$1', [oldToken]);
      res.locals._newUserRow = row;
    });

    const row = res.locals._newUserRow;
    await setAuthCookies(res, row.user_id, row.email, row.name, row.role);
    return res.json({ ok: true });
  } catch (e) {
    const status = e.status || 500;
    return res.status(status).json({ error: e.message || 'ERROR' });
  }
});

// /auth/logout
router.post('/logout', async (req, res) => {
  const refresh = req.cookies['refresh'];
  if (refresh) {
    await query('UPDATE refresh_tokens SET revoked_at=now() WHERE token=$1', [refresh]);
  }
  clearAuthCookies(res);
  res.json({ ok: true });
});

// /auth/verify
router.post('/verify', async (req, res) => {
  const schema = z.object({ token: z.string().min(1) });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const { token } = parsed.data;
  const rs = await query('SELECT user_id FROM email_verifications WHERE token=$1 AND used_at IS NULL', [token]);
  if (rs.rowCount === 0) return res.status(400).json({ error: 'INVALID_TOKEN' });

  const userId = rs.rows[0].user_id;
  await query('UPDATE users SET email_verified=TRUE WHERE id=$1', [userId]);
  await query('UPDATE email_verifications SET used_at=now() WHERE token=$1', [token]);

  const u = await query('SELECT email, name, role FROM users WHERE id=$1', [userId]);
  const user = u.rows[0];
  await setAuthCookies(res, userId, user.email, user.name, user.role);

  res.json({ ok: true });
});

// /auth/password/forgot (limitowane)
router.post('/password/forgot', passwordForgotLimiter, async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const { email } = parsed.data;
  const rs = await query('SELECT id, name FROM users WHERE email=$1', [email]);
  if (rs.rowCount === 0) return res.json({ ok: true });

  const user = rs.rows[0];
  const token = crypto.randomBytes(32).toString('hex');
  await query('INSERT INTO password_resets (user_id, token) VALUES ($1,$2)', [user.id, token]);

  const resetLink = `${APP_URL}/auth/reset?token=${encodeURIComponent(token)}`;
  const html = renderTemplate('reset', {
    subject: 'Reset hasła',
    user: { name: user.name || '' },
    links: { reset: resetLink },
    app: { name: APP_NAME }
  });
  await sendEmail({ to: email, subject: 'Reset hasła', html });

  res.json({ ok: true });
});

// /auth/password/reset
router.post('/password/reset', async (req, res) => {
  const schema = z.object({
    token: z.string().min(1),
    password: z.string().min(6)
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_INPUT' });

  const { token, password } = parsed.data;
  const rs = await query(
    `SELECT user_id
       FROM password_resets
      WHERE token=$1
        AND used_at IS NULL
        AND created_at > now() - interval '24 hours'`,
    [token]
  );
  if (rs.rowCount === 0) return res.status(400).json({ error: 'INVALID_TOKEN' });

  const userId = rs.rows[0].user_id;
  const hash = await bcrypt.hash(password, 10);
  await query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, userId]);
  await query('UPDATE password_resets SET used_at=now() WHERE token=$1', [token]);

  res.json({ ok: true });
});

export default router;
