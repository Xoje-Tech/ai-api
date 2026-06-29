import { z } from 'zod';

/**
 * Zod schema for POST /users body. Validates at the HTTP boundary
 * before any use-case runs.
 */
export const CreateUserDto = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
});

export type CreateUserBody = z.infer<typeof CreateUserDto>;
