import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import crypto from 'crypto';
import { issueCsrfCookie } from './security.js';

const ACCESS_TTL_MIN = Number(process.env.ACCESS_TTL_MIN || 15);
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 7);

function signAccess(user) {
  const payload = { sub: user.email, uid: user.id, name: user.name || '', role: user.role || 'user' };
  return jwt.sign(payload, process.env.JWT_SECRET || 'changeme', { expiresIn: `${ACCESS_TTL_MIN}m` });
}

export async function setAuthCookies(res, userId, email, name, role) {
  const access = signAccess({ id: userId, email, name, role });
  const refresh = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + REFRESH_TTL_DAYS*24*60*60*1000);
  await query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1,$2,$3) ON CONFLICT(token) DO NOTHING', [userId, refresh, expires]);

  res.cookie('access', access, { httpOnly: true, sameSite: 'lax', secure: false, path: '/' });
  res.cookie('refresh', refresh, { httpOnly: true, sameSite: 'lax', secure: false, path: '/' });
  issueCsrfCookie(res);
}

export function clearAuthCookies(res) {
  res.clearCookie('access', { path: '/' });
  res.clearCookie('refresh', { path: '/' });
  res.clearCookie('csrf', { path: '/' });
}

export function requireAuth(req, res, next) {
  const token = req.cookies['access'];
  if (!token) return res.status(401).json({ error: 'No access token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'changeme');
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function optionalAuth(req, _res, next) {
  const token = req.cookies['access'];
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET || 'changeme');
    } catch {}
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'No token' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ADMIN_ONLY' });
  next();
}
