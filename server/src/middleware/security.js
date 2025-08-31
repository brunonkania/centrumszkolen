import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

// CSRF: double submit cookie pattern
export function csrfProtection(req, res, next) {
  const unsafe = /^(POST|PUT|PATCH|DELETE)$/i.test(req.method);
  if (!unsafe) return next();
  const tokenHeader = req.get('x-csrf-token');
  const tokenCookie = req.cookies['csrf'];
  if (!tokenHeader || !tokenCookie || tokenHeader !== tokenCookie) {
    return res.status(403).json({ error: 'CSRF' });
  }
  next();
}

export function attachSecurity(app) {
  app.use(helmet());
  // Basic per-IP rate-limits for auth endpoints
  const authLimiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15*60*1000),
    max: Number(process.env.RATE_LIMIT_MAX || 60),
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/auth', authLimiter);
}

export function issueCsrfCookie(res) {
  // simple random token
  const token = crypto.randomBytes(24).toString('hex');
  res.cookie('csrf', token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: false,
    path: '/'
  });
  return token;
}
