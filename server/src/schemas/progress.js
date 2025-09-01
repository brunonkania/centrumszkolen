import { z } from 'zod';

export const completeModuleParams = z.object({
  courseId: z.coerce.number().int().positive(),
});

export const completeModuleBody = z.object({
  moduleIndex: z.coerce.number().int().nonnegative(),
});
