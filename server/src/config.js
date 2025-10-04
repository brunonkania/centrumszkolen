import 'dotenv/config';

const required = (key, def = undefined) => {
  const v = process.env[key] ?? def;
  if (v === undefined || v === '') throw new Error(`Missing env ${key}`);
  return v;
};

export const NODE_ENV = process.env.NODE_ENV ?? 'development';
export const isProd = NODE_ENV === 'production';

export const PORT = parseInt(process.env.PORT ?? '4000', 10);

export const DATABASE_URL = required('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/centrumszkolen');

export const PUBLIC_BASE_URL = required('PUBLIC_BASE_URL', 'http://localhost:4000');

/**
 * Front teraz serwujemy z backendu (ten sam host:port),
 * więc domyślnie FRONTEND_BASE_URL = PUBLIC_BASE_URL.
 * Jeśli kiedyś wrócisz do Vite/oddzielnej domeny – ustaw zmienną w .env.
 */
export const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL ?? PUBLIC_BASE_URL;

export const PAYMENTS_PROVIDER = process.env.PAYMENTS_PROVIDER ?? 'payu'; // 'payu' | 'fake'
export const PAYU_POS_ID = process.env.PAYU_POS_ID ?? '';
export const PAYU_CLIENT_ID = process.env.PAYU_CLIENT_ID ?? '';
export const PAYU_CLIENT_SECRET = process.env.PAYU_CLIENT_SECRET ?? '';
export const PAYU_SANDBOX = (process.env.PAYU_SANDBOX ?? 'true') === 'true';

export const SMTP_HOST = process.env.SMTP_HOST ?? '';
export const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? '587', 10);
export const SMTP_SECURE = (process.env.SMTP_SECURE ?? 'false') === 'true';
export const SMTP_USER = process.env.SMTP_USER ?? '';
export const SMTP_PASS = process.env.SMTP_PASS ?? '';
export const SMTP_FROM = process.env.SMTP_FROM ?? 'no-reply@centrumszkolen.pl';

export const MAGIC_LINK_TTL_HOURS = parseInt(process.env.MAGIC_LINK_TTL_HOURS ?? '72', 10);
