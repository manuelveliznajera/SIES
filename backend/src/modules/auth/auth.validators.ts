import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    identifier: z
      .string()
      .min(3, 'El usuario o correo es obligatorio')
      .max(255)
      .trim(),
    password: z
      .string()
      .min(1, 'La contraseña es obligatoria')
      .max(128, 'Contraseña demasiado larga'),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'El refresh token es obligatorio'),
  }),
});

export type LoginInput = z.infer<typeof loginSchema>['body'];
export type RefreshInput = z.infer<typeof refreshSchema>['body'];
