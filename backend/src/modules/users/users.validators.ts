import { z } from 'zod';

const userRoleSchema = z.enum(['ADMIN', 'SUPERVISOR', 'ENUMERATOR']);

export const createUserSchema = z.object({
  username: z.string().trim().min(3).max(80),
  email: z.string().trim().email().max(255),
  fullName: z.string().trim().min(1).max(255),
  phone: z.string().trim().max(30).optional().default(''),
  role: userRoleSchema,
  password: z.string().min(12).max(128),
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional().default(''),
  role: userRoleSchema,
  password: z.string().min(12).max(128).optional(),
});

export const userIdSchema = z.string().uuid();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
