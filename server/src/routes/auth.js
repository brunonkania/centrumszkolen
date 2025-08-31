import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../db.js';
import { setAuthCookies, clearAuthCookies, requireAuth } from '../middleware/auth.js';
import { issueCsrfCookie } from '../middleware/security.js';
import { z } from 'zod';
import { sendEmail } from '../util/email.js';

const router = Router();

router.get('/me', requireAuth, async (req, res) => {
  const u = await query('SELECT id, email, name, role, email_verified FROM users WHERE email=$1', [req.user.sub]);
  const user = u.rows[0];
  res.json({ user });
});

router.post('/register', async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().trim().min(1)
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_INPUT' });
  const { email, password, name } = parsed.data;

  const exists = await query('SELECT id FROM users WHERE email=$1', [email]);
  if (exists.rowCount > 0) return res.status(409).json({ error: 'User exists' });

  const hash = await bcrypt.hash(password, 10);
  const ins = await query('INSERT INTO users (email, password_hash, name) VALUES ($1,$2,$3) RETURNING id, role, email_verified', [email, hash, name]);
  const user = ins.rows[0];

  const token = crypto.randomBytes(24).toString('hex');
  await query('INSERT INTO email_verifications (user_id, token) VALUES ($1,$2)', [user.id, token]);
  const link = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify.html?token=${token}`;

  await sendEmail({
    to: email,
    subject: 'Potwierdź email – Centrum Szkoleń',
    html: `<p>Cześć ${name}, kliknij aby potwierdzić: <a href="${link}">${link}</a></p>`
  });

  // loguje automatycznie, ale email_verified=false
  await setAuthCookies(res, user.id, email, name, user.role);
  res.json({ ok: true, verify_link: link, user: { id: user.id, email, name, role: user.role, email_verified: user.email_verified } });
});

router.post('/login', async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_INPUT' });
  const { email, password } = parsed.data;

  const rs = await query('SELECT id, email, password_hash, name, role, email_verified FROM users WHERE email=$1', [email]);
  const user = rs.rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  await setAuthCookies(res, user.id, user.email, user.name, user.role);
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, email_verified: user.email_verified } });
});

router.post('/refresh', async (req, res) => {
  const refresh = req.cookies['refresh'];
  if (!refresh) return res.status(401).json({ error: 'NO_REFRESH' });
  const rs = await query('SELECT rt.user_id, u.email, u.name, u.role FROM refresh_tokens rt JOIN users u ON u.id=rt.user_id WHERE rt.token=$1 AND rt.revoked_at IS NULL AND rt.expires_at > now()', [refresh]);
  if (rs.rowCount === 0) return res.status(401).json({ error: 'INVALID_REFRESH' });
  const row = rs.rows[0];
  await setAuthCookies(res, row.user_id, row.email, row.name, row.role);
  res.json({ ok: true });
});

router.post('/logout', async (req, res) => {
  const refresh = req.cookies['refresh'];
  if (refresh) {
    await query('UPDATE refresh_tokens SET revoked_at=now() WHERE token=$1', [refresh]);
  }
  clearAuthCookies(res);
  res.json({ ok: true });
});

router.post('/verify', async (req, res) => {
  const token = String(req.body?.token || '');
  if (!token) return res.status(400).json({ error: 'token required' });
  const rs = await query('SELECT user_id FROM email_verifications WHERE token=$1 AND used_at IS NULL', [token]);
  if (rs.rowCount === 0) return res.status(400).json({ error: 'INVALID_TOKEN' });
  const userId = rs.rows[0].user_id;
  await query('UPDATE users SET email_verified=TRUE WHERE id=$1', [userId]);
  await query('UPDATE email_verifications SET used_at=now() WHERE token=$1', [token]);
  res.json({ ok: true });
});

router.post('/password/forgot', async (req, res) => {
  const email = String(req.body?.email || '');
  if (!email) return res.status(400).json({ error: 'email required' });
  const u = await query('SELECT id, name FROM users WHERE email=$1', [email]);
  if (u.rowCount === 0) return res.json({ ok: true });
  const userId = u.rows[0].id;
  const token = crypto.randomBytes(24).toString('hex');
  await query('INSERT INTO password_resets (user_id, token) VALUES ($1,$2)', [userId, token]);
  const link = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset.html?token=${token}`;
  await sendEmail({
    to: email,
    subject: 'Reset hasła – Centrum Szkoleń',
    html: `<p>Użyj linku aby ustawić nowe hasło: <a href="${link}">${link}</a></p>`
  });
  res.json({ ok: true, reset_link: link });
});

router.post('/password/reset', async (req, res) => {
  const schema = z.object({ token: z.string().min(1), password: z.string().min(6) });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_INPUT' });
  const { token, password } = parsed.data;

  const rs = await query('SELECT user_id FROM password_resets WHERE token=$1 AND used_at IS NULL', [token]);
  if (rs.rowCount === 0) return res.status(400).json({ error: 'INVALID_TOKEN' });
  const userId = rs.rows[0].user_id;
  const hash = await bcrypt.hash(password, 10);
  await query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, userId]);
  await query('UPDATE password_resets SET used_at=now() WHERE token=$1', [token]);
  res.json({ ok: true });
});

export default router;
