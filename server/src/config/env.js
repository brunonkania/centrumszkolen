import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  APP_URL: z.string().url().optional(),
  FRONT_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  COOKIE_SECURE: z
    .union([z.literal('true'), z.literal('false')])
    .default('false'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
});

export const env = (() => {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid ENV:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  // uspójnij typy
  const e = parsed.data;
  return {
    ...e,
    COOKIE_SECURE: e.COOKIE_SECURE === 'true',
  };
})();
