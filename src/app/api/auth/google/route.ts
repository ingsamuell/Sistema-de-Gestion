import { NextRequest, NextResponse } from 'next/server';
import {
  getGoogleAuthUrl,
  exchangeCodeForTokens,
  encryptTokens,
  decryptTokens,
  getBaseUrlFromRequest,
  GCAL_COOKIE_NAME,
  type GoogleCalendarTokens,
} from '@/lib/google-calendar';

/**
 * Sanitiza la ruta de redirección para evitar ataques de redirección abierta (Open Redirect).
 */
function getSafeReturnPath(state: string | null): string {
  if (!state || !state.startsWith('/') || state.startsWith('//')) {
    return '/calendario';
  }
  return state;
}

/**
 * GET /api/auth/google
 *
 * Casos de uso:
 * 1. Conexión desde el botón: window.location.href = '/api/auth/google'
 *    -> Redirige a la pantalla de consentimiento de Google OAuth2.
 * 2. Petición API JSON: fetch('/api/auth/google', { headers: { Accept: 'application/json' } })
 *    -> Retorna la URL de autorización en JSON { success: true, url }.
 * 3. Consulta de estado/tokens: GET /api/auth/google?action=status
 *    -> Retorna los tokens activos o el estado de conexión actual.
 * 4. Recepción de código OAuth (si se configura como redirect URI): GET /api/auth/google?code=...
 *    -> Intercambia el código por tokens, guarda la cookie segura y redirige a /calendario.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const baseUrl = getBaseUrlFromRequest(request);
  const action = searchParams.get('action');
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const mode = searchParams.get('mode');
  const isJsonRequest =
    mode === 'json' || request.headers.get('accept')?.includes('application/json');

  // --- Caso 1: Consulta de estado o tokens existentes ---
  if (action === 'status' || action === 'tokens') {
    const cookie = request.cookies.get(GCAL_COOKIE_NAME);
    if (!cookie?.value) {
      return NextResponse.json({
        success: false,
        connected: false,
        message: 'No hay cuenta de Google Calendar vinculada.',
      });
    }

    const tokens = decryptTokens(cookie.value);
    if (!tokens) {
      return NextResponse.json({
        success: false,
        connected: false,
        message: 'Tokens inválidos o corruptos en la sesión.',
      });
    }

    return NextResponse.json({
      success: true,
      connected: true,
      tokens: {
        access_token: tokens.access_token,
        expiry_date: tokens.expiry_date,
        token_type: tokens.token_type,
        scope: tokens.scope,
      },
    });
  }

  // --- Caso 2: Error retornado por Google en el flujo OAuth ---
  if (error) {
    const state = searchParams.get('state');
    const safePath = getSafeReturnPath(state);
    if (isJsonRequest) {
      return NextResponse.json(
        {
          success: false,
          error,
        },
        { status: 400 },
      );
    }
    const redirectUrl = new URL(`${baseUrl}${safePath}`);
    redirectUrl.searchParams.set('gcal_error', 'true');
    redirectUrl.searchParams.set('calendar_error', error);
    return NextResponse.redirect(redirectUrl.toString());
  }

  // --- Caso 3: Recepción de código de autorización (intercambio por tokens) ---
  if (code) {
    const state = searchParams.get('state');
    const safePath = getSafeReturnPath(state);

    try {
      let tokens: GoogleCalendarTokens;
      try {
        // Primero intentamos intercambiar usando esta misma ruta como redirect_uri
        tokens = await exchangeCodeForTokens(code, `${baseUrl}/api/auth/google`, baseUrl);
      } catch {
        // Fallback al redirect_uri por defecto configurado (/api/calendar/callback)
        tokens = await exchangeCodeForTokens(code, undefined, baseUrl);
      }

      // Cifrado AES-256-GCM para almacenamiento seguro de tokens en cookie
      const encryptedTokens = encryptTokens(tokens);

      if (isJsonRequest) {
        const response = NextResponse.json({
          success: true,
          connected: true,
          tokens,
        });

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
      }

      const redirectUrl = new URL(`${baseUrl}${safePath}`);
      redirectUrl.searchParams.set('gcal_success', 'true');
      redirectUrl.searchParams.set('calendar_connected', 'true');

      const response = NextResponse.redirect(redirectUrl.toString());
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
    } catch (exchangeErr) {
      const message =
        exchangeErr instanceof Error ? exchangeErr.message : 'Error al intercambiar código';

      if (isJsonRequest) {
        return NextResponse.json(
          {
            success: false,
            error: message,
          },
          { status: 500 },
        );
      }

      const redirectUrl = new URL(`${baseUrl}${safePath}`);
      redirectUrl.searchParams.set('gcal_error', 'true');
      redirectUrl.searchParams.set('calendar_error', encodeURIComponent(message));
      return NextResponse.redirect(redirectUrl.toString());
    }
  }

  // --- Caso 4: Inicio del flujo de autenticación (Click en botón Conectar) ---
  try {
    const returnTo = searchParams.get('returnTo') || searchParams.get('state') || '/calendario';
    const customRedirect = searchParams.get('redirect_uri') || undefined;

    // Generar la URL de Google OAuth2 con los permisos requeridos
    const authUrl = getGoogleAuthUrl(returnTo, customRedirect, baseUrl);

    if (isJsonRequest) {
      return NextResponse.json({
        success: true,
        url: authUrl,
      });
    }

    // Redirección inmediata hacia la pantalla de consentimiento de Google
    return NextResponse.redirect(authUrl);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al generar URL de autenticación con Google';

    if (isJsonRequest) {
      return NextResponse.json(
        {
          success: false,
          error: message,
        },
        { status: 500 },
      );
    }

    const redirectUrl = new URL(`${baseUrl}/calendario`);
    redirectUrl.searchParams.set('gcal_error', 'true');
    redirectUrl.searchParams.set('calendar_error', encodeURIComponent(message));
    return NextResponse.redirect(redirectUrl.toString());
  }
}

/**
 * POST /api/auth/google
 *
 * Permite interactuar con la API mediante peticiones programáticas:
 * - { action: 'url', returnTo?: string } -> Obtiene la URL de autenticación
 * - { code: string, redirect_uri?: string } -> Intercambia un código y devuelve los tokens
 * - { action: 'disconnect' } -> Elimina la sesión y la cookie
 * - { action: 'status' } -> Verifica el estado de conexión
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, code, returnTo, redirect_uri } = body;

    // Desconectar cuenta
    if (action === 'disconnect') {
      const response = NextResponse.json({
        success: true,
        connected: false,
        message: 'Google Calendar desconectado correctamente.',
      });
      response.cookies.delete(GCAL_COOKIE_NAME);
      return response;
    }

    // Consultar estado o tokens
    if (action === 'status' || action === 'tokens') {
      const cookie = request.cookies.get(GCAL_COOKIE_NAME);
      if (!cookie?.value) {
        return NextResponse.json({
          success: false,
          connected: false,
          message: 'No hay cuenta conectada.',
        });
      }

      const tokens = decryptTokens(cookie.value);
      return NextResponse.json({
        success: true,
        connected: !!tokens,
        tokens,
      });
    }

    // Intercambiar código por tokens directamente
    if (code) {
      const baseUrl = getBaseUrlFromRequest(request);
      const tokens = await exchangeCodeForTokens(code, redirect_uri, baseUrl);
      const encryptedTokens = encryptTokens(tokens);

      const response = NextResponse.json({
        success: true,
        connected: true,
        tokens,
      });

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

    // Obtener URL de consentimiento
    const baseUrl = getBaseUrlFromRequest(request);
    const authUrl = getGoogleAuthUrl(returnTo || '/calendario', redirect_uri, baseUrl);
    return NextResponse.json({
      success: true,
      url: authUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error en la petición POST de Google Auth';
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/auth/google
 *
 * Desconecta Google Calendar borrando la cookie encriptada.
 */
export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    connected: false,
    message: 'Google Calendar desconectado correctamente.',
  });

  response.cookies.delete(GCAL_COOKIE_NAME);
  return response;
}
