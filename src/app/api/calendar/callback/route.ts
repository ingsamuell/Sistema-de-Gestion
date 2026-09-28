import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeCodeForTokens,
  encryptTokens,
  getBaseUrlFromRequest,
  GCAL_COOKIE_NAME,
} from '@/lib/google-calendar';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const baseUrl = getBaseUrlFromRequest(request);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state') || '/calendario';

  // Sanitizar ruta de redirección relativa para evitar Open Redirects
  const safeReturnPath = state.startsWith('/') ? state : '/calendario';
  const redirectTarget = `${baseUrl}${safeReturnPath}`;

  if (error) {
    const errorUrl = new URL(redirectTarget);
    errorUrl.searchParams.set('calendar_error', error);
    errorUrl.searchParams.set('gcal_error', 'true');
    return NextResponse.redirect(errorUrl.toString());
  }

  if (!code) {
    const errorUrl = new URL(redirectTarget);
    errorUrl.searchParams.set('calendar_error', 'missing_code');
    errorUrl.searchParams.set('gcal_error', 'true');
    return NextResponse.redirect(errorUrl.toString());
  }

  try {
    // Intercambiar código de autorización por tokens de acceso/actualización
    const tokens = await exchangeCodeForTokens(code, undefined, baseUrl);

    // Cifrar los tokens con AES-256-GCM antes de guardarlos en cookie segura (Zero-Trust)
    const encryptedTokens = encryptTokens(tokens);

    // Redirigir al usuario indicando éxito en la conexión
    const successUrl = new URL(redirectTarget);
    successUrl.searchParams.set('calendar_connected', 'true');
    successUrl.searchParams.set('gcal_success', 'true');

    const response = NextResponse.redirect(successUrl.toString());

    // Almacenar los tokens en una cookie httpOnly y segura
    response.cookies.set({
      name: GCAL_COOKIE_NAME,
      value: encryptedTokens,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 días
    });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'token_exchange_failed';
    const errorUrl = new URL(redirectTarget);
    errorUrl.searchParams.set('calendar_error', encodeURIComponent(message));
    errorUrl.searchParams.set('gcal_error', 'true');
    return NextResponse.redirect(errorUrl.toString());
  }
}
