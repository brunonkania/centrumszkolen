// src/routes/auth.js
import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { env } from '../config/env.js';
import { setAuthCookies, clearAuthCookies, requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * POST /auth/login
 * body: { email, password }
 */
router.post('/login', async (req, res, next) => {
  try {
    const bs = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }).safeParse(req.body || {});
    if (!bs.success) return res.status(400).json({ error: 'INVALID_INPUT' });

    const { email, password } = bs.data;

    const u = await query(
      'SELECT id, email, password_hash, name, role FROM users WHERE email=$1',
      [email.toLowerCase()]
    );
    if (u.rowCount === 0) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

    const user = u.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

    const payload = { sub: user.id, role: user.role, email: user.email };
    const access = jwt.sign(payload, env.JWT_SECRET, { expiresIn: `${env.ACCESS_TTL_MIN}m` });

    setAuthCookies(res, { access });

    return res.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /auth/logout
 * Czyści cookies z tokenami i kończy sesję.
 */
router.post('/logout', (_req, res) => {
  clearAuthCookies(res);
  res.json({ ok: true });
});

/**
 * GET /auth/me
 * Zwraca bieżącego użytkownika (wymaga zalogowania).
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const uid = req.user?.uid || req.user?.id;
    const r = await query('SELECT id, email, name, role FROM users WHERE id=$1', [uid]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'USER_NOT_FOUND' });
    res.json({ user: r.rows[0] });
  } catch (e) {
    next(e);
  }
});

export default router;
