import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import crypto from 'crypto';
import { issueCsrfCookie } from './security.js';

if (!process.env.JWT_SECRET) {
  throw new Error('Missing JWT_SECRET');
}

const ACCESS_TTL_MIN = Number(process.env.ACCESS_TTL_MIN || 15);
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 7);
const MAX_ACTIVE_REFRESH = Number(process.env.MAX_ACTIVE_REFRESH || 5);

function signAccess(user) {
  const payload = { sub: user.email, uid: user.id, name: user.name || '', role: user.role || 'user' };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: `${ACCESS_TTL_MIN}m` });
}

async function insertRefresh(userId) {
  const refresh = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1,$2,$3) ON CONFLICT(token) DO NOTHING',
    [userId, refresh, expires]
  );
  return { refresh, expires };
}

async function pruneRefresh(userId) {
  // zostaw maksymalnie MAX_ACTIVE_REFRESH najnowszych aktywnych tokenów
  await query(`
    WITH active AS (
      SELECT token
      FROM refresh_tokens
      WHERE user_id=$1 AND revoked_at IS NULL AND expires_at > now()
      ORDER BY created_at DESC
      OFFSET $2
    )
    UPDATE refresh_tokens SET revoked_at = now()
    WHERE token IN (SELECT token FROM active)
  `, [userId, Math.max(MAX_ACTIVE_REFRESH - 1, 0)]);
}

export async function setAuthCookies(res, userId, email, name, role) {
  const access = signAccess({ id: userId, email, name, role });
  const { refresh } = await insertRefresh(userId);

  const isProd = process.env.NODE_ENV === 'production';
  const sameSite = process.env.COOKIE_SAMESITE || 'lax';
  const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd;

  res.cookie('access', access, {
    httpOnly: true,
    sameSite,
    secure,
    path: '/',
    maxAge: ACCESS_TTL_MIN * 60 * 1000
  });

  res.cookie('refresh', refresh, {
    httpOnly: true,
    sameSite,
    secure,
    path: '/',
    maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000
  });

  await pruneRefresh(userId);
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
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function optionalAuth(req, _res, next) {
  const token = req.cookies['access'];
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {}
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'No token' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ADMIN_ONLY' });
  next();
}
