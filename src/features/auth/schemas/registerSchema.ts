import { z } from 'zod';

export const registerSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, { message: 'El nombre debe tener al menos 2 caracteres' })
      .max(30, { message: 'El nombre no puede tener más de 30 caracteres' })
      .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/, {
        message: 'El nombre solo puede contener letras y espacios',
      }),
    lastName: z
      .string()
      .trim()
      .min(2, { message: 'El apellido debe tener al menos 2 caracteres' })
      .max(30, { message: 'El apellido no puede tener más de 30 caracteres' })
      .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/, {
        message: 'El apellido solo puede contener letras y espacios',
      }),
    username: z
      .string()
      .trim()
      .min(3, { message: 'El nombre de usuario debe tener al menos 3 caracteres' })
      .max(30, { message: 'El nombre de usuario no puede tener más de 30 caracteres' })
      .regex(/^[a-zA-Z0-9_.]+$/, {
        message: 'Solo se permiten letras, números, puntos y guiones bajos',
      }),
    email: z
      .string()
      .trim()
      .max(100, { message: 'El correo no puede tener más de 100 caracteres' })
      .email({ message: 'Ingresa un correo electrónico válido' }),
    password: z
      .string()
      .min(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
      .regex(/[A-Z\p{Lu}]/u, {
        message: 'La contraseña debe contener al menos una letra mayúscula',
      })
      .regex(/[0-9]/, {
        message: 'La contraseña debe contener al menos un número',
      })
      .regex(/[^a-zA-Z0-9\s\p{L}]/u, {
        message: 'La contraseña debe contener al menos un carácter especial',
      }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

export type RegisterSchemaInput = z.infer<typeof registerSchema>;
