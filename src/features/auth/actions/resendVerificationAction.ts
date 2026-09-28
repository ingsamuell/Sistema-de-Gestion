'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/i18n/locale';
import { localizedHref } from '@/lib/i18n/routes';

export interface ResendVerificationResponse {
  success: boolean;
  error?: string;
}

export async function resendVerificationEmail(
  email: string,
  locale: Locale = 'es',
): Promise<ResendVerificationResponse> {
  const trimmedEmail = email?.trim().toLowerCase();

  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    return {
      success: false,
      error: 'Por favor ingresa un correo electrónico válido.',
    };
  }

  try {
    let siteUrl = '';
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

    if (!siteUrl && process.env.NEXT_PUBLIC_SITE_URL) {
      siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    }

    if (
      siteUrl &&
      (siteUrl.includes('172.') || siteUrl.includes('192.168.') || siteUrl.includes('10.'))
    ) {
      siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    }

    if (!siteUrl) {
      siteUrl = 'http://localhost:3000';
    }

    siteUrl = siteUrl.replace(/\/$/, '');

    const supabase = await createClient();

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: trimmedEmail,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(localizedHref(locale, 'onboarding'))}`,
      },
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

      return {
        success: false,
        error: error.message || 'No se pudo reenviar el correo de verificación.',
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
