// src/middleware/auth.js
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// bezpieczny parser boola z ENV
function boolFromEnv(val, fallback) {
  if (val === true || val === false) return val;
  if (val == null) return !!fallback;
  const s = String(val).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'off'].includes(s)) return false;
  return !!fallback;
}

/**
 * Pomocniczo: odczyt Bearer <token> z nagłówka
 */
function parseBearerToken(req) {
  const hdr = req.get('authorization') || '';
  if (!hdr.toLowerCase().startsWith('bearer ')) return null;
  return hdr.slice(7).trim();
}

/**
 * Wstrzykuje req.user jeśli jest poprawny access token
 * (z ciasteczka 'access' albo nagłówka Bearer).
 */
export function attachUserFromAccessCookie(req, _res, next) {
  try {
    const cookieToken = req.cookies?.access || null;
    const bearer = parseBearerToken(req);
    const token = bearer || cookieToken;
    if (!token) return next();
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = {
      id: payload.sub,
      uid: payload.sub,
      role: payload.role || 'user',
      email: payload.email,
    };
  } catch {
    // ignorujemy błędy JWT — użytkownik traktowany jako niezalogowany
  }
  next();
}

/**
 * optionalAuth – nigdy nie blokuje.
 */
export function optionalAuth(_req, _res, next) {
  next();
}

/**
 * Wymaga zalogowania.
 */
export function requireAuth(req, res, next) {
  if (!req.user?.id && !req.user?.uid) {
    return res.status(401).json({ error: 'UNAUTHENTICATED' });
  }
  next();
}

/**
 * Wymaga roli admin.
 */
export function requireAdmin(req, res, next) {
  const role = req.user?.role || 'user';
  if (role !== 'admin') {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }
  next();
}

/**
 * Ustawia cookies z tokenami (access/refresh).
 * W DEV/HTTP: COOKIE_SECURE=false (albo NODE_ENV != 'production')
 */
export function setAuthCookies(res, { access, refresh } = {}) {
  const isProd = env.NODE_ENV === 'production';
  const secure = boolFromEnv(env.COOKIE_SECURE, isProd); // <- KLUCZOWA ZMIANA
  const sameSite = env.COOKIE_SAMESITE || 'lax';

  if (access) {
    const accessMs = Math.max(1, Number(env.ACCESS_TTL_MIN || 15)) * 60 * 1000;
    res.cookie('access', access, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      maxAge: accessMs,
    });
  }

  if (refresh) {
    const refreshMs = Math.max(1, Number(env.REFRESH_TTL_DAYS || 30)) * 24 * 60 * 60 * 1000;
    res.cookie('refresh', refresh, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      maxAge: refreshMs,
    });
  }
}

/**
 * Czyści cookies z tokenami.
 */
export function clearAuthCookies(res) {
  const isProd = env.NODE_ENV === 'production';
  const secure = boolFromEnv(env.COOKIE_SECURE, isProd); // <- KLUCZOWA ZMIANA
  const sameSite = env.COOKIE_SAMESITE || 'lax';

  res.cookie('access', '', {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: 0,
  });
  res.cookie('refresh', '', {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: 0,
  });
}
