// src/middleware/security.js
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

function boolFromEnv(val, fallback) {
  if (val === true || val === false) return val;
  if (val == null) return !!fallback;
  const s = String(val).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'off'].includes(s)) return false;
  return !!fallback;
}

/**
 * Content-Security-Policy (CSP)
 */
export const securityHeaders = helmet.contentSecurityPolicy({
  useDefaults: true,
  directives: {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", "*"],
    "frame-ancestors": ["'self'"],
    "object-src": ["'none'"],
    "upgrade-insecure-requests": [],
  },
});

/**
 * CSRF – double submit cookie
 */
export function csrfProtection(req, res, next) {
  const isUnsafe = /^(POST|PUT|PATCH|DELETE)$/i.test(req.method);
  if (!isUnsafe) return next();
  const tokenHeader = req.get('x-csrf-token');
  const tokenCookie = req.cookies?.csrf;
  if (!tokenHeader || !tokenCookie || tokenHeader !== tokenCookie) {
    return res.status(403).json({ error: 'CSRF' });
  }
  next();
}

export function issueCsrfCookie(res) {
  const token = crypto.randomBytes(24).toString('hex');
  const isProd = process.env.NODE_ENV === 'production';
  const secure = boolFromEnv(process.env.COOKIE_SECURE, isProd); // <- pewny boolean
  const sameSite = process.env.COOKIE_SAMESITE || 'lax';

  res.cookie('csrf', token, {
    httpOnly: false,   // widoczne dla JS – double-submit
    secure,
    sameSite,
    path: '/',
  });
  return token;
}

/**
 * Rate limiter – 100 zapytań / 10 min
 */
export const apiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
