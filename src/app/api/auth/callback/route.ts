import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { type EmailOtpType } from '@supabase/supabase-js';

import {
  encryptTokens,
  exchangeCodeForTokens,
  GCAL_COOKIE_NAME,
  type GoogleCalendarTokens,
} from '@/lib/google-calendar';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/';

  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocalEnv = process.env.NODE_ENV === 'development';

  const getRedirectUrl = (path: string) => {
    if (isLocalEnv) {
      return `${origin}${path}`;
    } else if (forwardedHost) {
      return `https://${forwardedHost}${path}`;
    } else {
      return `${origin}${path}`;
    }
  };

  const supabase = await createClient();

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const response = NextResponse.redirect(getRedirectUrl(next));
      response.cookies.delete('just_registered_email');

      // Si Google proveyó tokens de proveedor OAuth, guardarlos cifrados para Google Calendar
      if (data?.session?.provider_token) {
        const gcalTokens: GoogleCalendarTokens = {
          access_token: data.session.provider_token,
          refresh_token: data.session.provider_refresh_token || undefined,
          token_type: data.session.token_type || 'Bearer',
          expiry_date: data.session.expires_at ? data.session.expires_at * 1000 : null,
          expires_in: data.session.expires_in,
        };
        const encryptedTokens = encryptTokens(gcalTokens);
        response.cookies.set({
          name: GCAL_COOKIE_NAME,
          value: encryptedTokens,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 30 * 24 * 60 * 60, // 30 días
        });
      }

      return response;
    } else {
      // Fallback de resiliencia: Si el usuario o consola de Google redirigió a /api/auth/callback para Google Calendar
      try {
        const baseUrl = getRedirectUrl('');
        const gcalTokens = await exchangeCodeForTokens(
          code,
          getRedirectUrl('/api/auth/callback'),
          baseUrl,
        );
        if (gcalTokens?.access_token) {
          const encryptedTokens = encryptTokens(gcalTokens);
          const response = NextResponse.redirect(
            getRedirectUrl('/calendario?calendar_connected=true&gcal_success=true'),
          );
          response.cookies.set({
            name: GCAL_COOKIE_NAME,
            value: encryptedTokens,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 30 * 24 * 60 * 60,
          });
          return response;
        }
      } catch {
        // Continuar con el manejo normal de error si no era un código de Google Calendar
      }
    }
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });

    if (!error) {
      const response = NextResponse.redirect(getRedirectUrl(next));
      response.cookies.delete('just_registered_email');
      return response;
    }
  }

  // Si ocurre un error, redirigir al login con el parámetro de error correspondiente
  const isResetFlow = next.includes('restablecer');
  const isOnboardingFlow = next.includes('onboarding');
  const errorParam = isResetFlow
    ? 'reset_link_expired'
    : isOnboardingFlow
      ? 'verification_link_expired'
      : 'oauth_error';

  return NextResponse.redirect(getRedirectUrl(`/login?error=${errorParam}`));
}
