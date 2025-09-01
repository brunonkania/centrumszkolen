// src/config/env.js
import 'dotenv/config';

function requireEnv(name) {
  const v = process.env[name];
  if (!v || v === '') {
    throw new Error(`Missing required env: ${name}`);
  }
  return v;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',

  APP_URL: process.env.APP_URL || 'http://localhost:3000',
  FRONT_URL: process.env.FRONT_URL || 'http://localhost:5173',
  PORT: Number(process.env.PORT || 3000),

  DATABASE_URL: requireEnv('DATABASE_URL'),

  // Cookies / CSRF
  COOKIE_SECURE: (process.env.COOKIE_SECURE || 'false') === 'true',
  COOKIE_SAMESITE: process.env.COOKIE_SAMESITE || 'lax',

  // Auth
  JWT_SECRET: requireEnv('JWT_SECRET'),
  ACCESS_TTL_MIN: Number(process.env.ACCESS_TTL_MIN || 15),
  REFRESH_TTL_DAYS: Number(process.env.REFRESH_TTL_DAYS || 30),
  MAX_ACTIVE_REFRESH: Number(process.env.MAX_ACTIVE_REFRESH || 5),

  // Payments
  PAYMENTS_ENABLED: (process.env.PAYMENTS_ENABLED || 'true') === 'true',
  PAYMENTS_PROVIDER: process.env.PAYMENTS_PROVIDER || 'fake', // 'fake' | 'payu' | 'p24'
  PAYMENTS_RETURN_URL: process.env.PAYMENTS_RETURN_URL || '/platnosc.html',
  PAYMENTS_WEBHOOK_SECRET: process.env.PAYMENTS_WEBHOOK_SECRET || 'dev-secret',

  // SMTP (dev: log do konsoli)
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: Number(process.env.SMTP_PORT || 587),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'no-reply@example.com',
};
