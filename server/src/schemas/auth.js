import { z } from 'zod';

export const email = z.string().email().max(254);
export const password = z.string().min(6).max(200);

export const registerSchema = z.object({
  email,
  password,
  name: z.string().min(2).max(100),
});

export const loginSchema = z.object({
  email,
  password,
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});
