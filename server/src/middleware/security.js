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
  // Minimalny CSP – można rozbudować wg potrzeb
  const isProd = process.env.NODE_ENV === 'production';
  const connectSrc = (process.env.CSP_CONNECT_SRC || '').split(',').map(s => s.trim()).filter(Boolean);
  const imgSrc = (process.env.CSP_IMG_SRC || '').split(',').map(s => s.trim()).filter(Boolean);
  const frameSrc = (process.env.CSP_FRAME_SRC || '').split(',').map(s => s.trim()).filter(Boolean);

  const csp = {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "img-src": ["'self'", "data:", "blob:", ...imgSrc],
      "style-src": ["'self'", "'unsafe-inline'"],   // bo używasz inline w HTML/CSS
      "script-src": ["'self'"],                      // jeżeli dodasz zewn. skrypty – dopisz tu
      "connect-src": ["'self'", ...connectSrc],      // np. API/WS
      "frame-src": ["'self'", ...frameSrc],          // jeżeli osadzisz bramkę płatności w iframe
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"]
    },
    reportOnly: !isProd // w DEV: tylko raportuj
  };

  app.use(helmet({
    contentSecurityPolicy: csp,
    crossOriginEmbedderPolicy: false, // jeśli osadzasz zewnętrzne treści
  }));

  // Basic per-IP rate-limits dla /auth
  const authLimiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX || 60),
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/auth', authLimiter);
}

export function issueCsrfCookie(res) {
  const token = crypto.randomBytes(24).toString('hex');
  const isProd = process.env.NODE_ENV === 'production';
  const sameSite = process.env.COOKIE_SAMESITE || 'lax';
  const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd;

  res.cookie('csrf', token, {
    httpOnly: false,
    sameSite,
    secure,
    path: '/'
  });
  return token;
}
