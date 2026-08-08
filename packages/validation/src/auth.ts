import { z } from 'zod';
import { USER_ROLE } from '@stc/types';
import { cuidSchema, slugSchema } from './common.js';

/**
 * Password policy: length beats composition rules. NIST guidance and every
 * usability study agree — forcing a symbol produces "Password1!" and nothing
 * more secure.
 */
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(128)
  .refine((p) => !/^\s|\s$/.test(p), 'Cannot start or end with a space');

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(1024),
});

export const userCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: passwordSchema,
  name: z.string().trim().min(2).max(120),
  slug: slugSchema.optional(),
  role: z.enum(USER_ROLE).default('AUTHOR'),
  designation: z.string().trim().max(120).nullish(),
  bio: z.string().max(2000).nullish(),
});

export const userUpdateSchema = userCreateSchema.omit({ password: true, email: true }).partial();

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'New password must differ from the current one',
    path: ['newPassword'],
  });

export const userIdParamSchema = z.object({ userId: cuidSchema });

export type LoginInput = z.infer<typeof loginSchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
