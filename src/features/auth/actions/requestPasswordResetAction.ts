'use server';

import { headers } from 'next/headers';
import { forgotPasswordSchema } from '@/features/auth/schemas/forgotPasswordSchema';
import type {
  ForgotPasswordActionResponse,
  ForgotPasswordFormData,
} from '@/features/auth/types/auth.types';
import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/i18n/locale';
import { localizedHref } from '@/lib/i18n/routes';

export async function requestPasswordReset(
  formData: ForgotPasswordFormData,
  origin?: string,
  locale: Locale = 'es',
): Promise<ForgotPasswordActionResponse> {
  const validationResult = forgotPasswordSchema.safeParse(formData);

  if (!validationResult.success) {
    const flattenedErrors = validationResult.error.flatten().fieldErrors;
    return {
      success: false,
      error: 'Por favor ingresa un correo electrónico válido.',
      fieldErrors: flattenedErrors as ForgotPasswordActionResponse['fieldErrors'],
    };
  }

  const { email } = validationResult.data;

  try {
    let siteUrl = origin;

    if (!siteUrl) {
      try {
        const headersList = await headers();
        const host = headersList.get('x-forwarded-host') || headersList.get('host');
        const proto = headersList.get('x-forwarded-proto') || 'http';
        if (host) {
          siteUrl = `${proto}://${host}`;
        }
      } catch {
        // Fallback si no está disponible el contexto de headers
      }
    }

    if (!siteUrl && process.env.NEXT_PUBLIC_SITE_URL) {
      siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    }

    // Si la URL detectada es una IP de red local (ej. 172.x, 192.168.x), priorizar localhost o NEXT_PUBLIC_SITE_URL
    if (
      siteUrl &&
      (siteUrl.includes('172.') || siteUrl.includes('192.168.') || siteUrl.includes('10.'))
    ) {
      siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    }

    if (!siteUrl) {
      siteUrl = 'http://localhost:3000';
    }

    // Normalizar para remover barra final si existe
    siteUrl = siteUrl.replace(/\/$/, '');

    const supabase = await createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(localizedHref(locale, 'resetPassword'))}`,
    });

    if (error) {
      const lower = error.message.toLowerCase();
      if (lower.includes('rate limit') || lower.includes('over_email_send_rate_limit')) {
        return {
          success: false,
          error:
            'Por motivos de seguridad, debes esperar un momento antes de solicitar otro correo.',
        };
      }

      if (lower.includes('error sending recovery email')) {
        return {
          success: false,
          error:
            'No se pudo enviar el correo en este momento (límite de envíos alcanzado en Supabase o restricciones de proveedor). Puedes cambiar tu contraseña directamente ingresándola en el formulario.',
        };
      }

      return {
        success: false,
        error: error.message || 'No se pudo enviar el correo de recuperación.',
      };
    }

    return {
      success: true,
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : 'Ocurrió un error inesperado al procesar la solicitud.',
    };
  }
}
