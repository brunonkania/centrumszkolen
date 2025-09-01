// server/src/middleware/ratelimits.js
import rateLimit from 'express-rate-limit';

// Bardziej restrykcyjne limity dla wrażliwych akcji:
export const resendVerificationLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: 5, // max 5 prób / 15 min
  standardHeaders: true,
  legacyHeaders: false
});

export const passwordForgotLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: 5, // max 5 prób / 15 min
  standardHeaders: true,
  legacyHeaders: false
});
