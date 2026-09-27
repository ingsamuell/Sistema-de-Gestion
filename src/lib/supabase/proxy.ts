import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  getLocaleFromPathname,
  getPathWithoutLocale,
  getPreferredLocale,
  localeCookieName,
} from '@/lib/i18n/locale';
import { getLocalizedLegacyPath, localizedHref } from '@/lib/i18n/routes';
import { getSupabaseEnv } from '@/lib/supabase/env';

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const localeFromPathname = getLocaleFromPathname(pathname);
  const preferredLocale =
    localeFromPathname ??
    getPreferredLocale({
      cookieLocale: request.cookies.get(localeCookieName)?.value,
      acceptLanguage: request.headers.get('accept-language'),
    });
  const localizedPathname = getPathWithoutLocale(pathname);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-komorebi-locale', preferredLocale);

  const createResponse = () => {
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    if (localeFromPathname) {
      response.cookies.set(localeCookieName, localeFromPathname, {
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    return response;
  };

  let supabaseResponse = createResponse();

  let env;
  try {
    env = getSupabaseEnv();
  } catch {
    // Si no están configuradas las variables en desarrollo, dejar pasar
    return supabaseResponse;
  }

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = createResponse();
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Validar sesión con Supabase Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isServerAction = request.headers.has('next-action');
  const legacyLocalizedPath = getLocalizedLegacyPath(preferredLocale, pathname);

  if (!localeFromPathname && !isServerAction && legacyLocalizedPath) {
    const url = request.nextUrl.clone();
    url.pathname = legacyLocalizedPath;
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  const isAuthRoute =
    localizedPathname.startsWith('/login') ||
    localizedPathname.startsWith('/register') ||
    localizedPathname.startsWith('/registro') ||
    localizedPathname.startsWith('/recuperar-contrasena') ||
    localizedPathname.startsWith('/forgot-password') ||
    localizedPathname.startsWith('/verificar-correo') ||
    localizedPathname.startsWith('/verify-email');
  const isAuthCallback = localizedPathname.startsWith('/auth') || pathname.startsWith('/api/auth');
  const isApiRoute = pathname.startsWith('/api/');
  const isPasswordResetRoute =
    localizedPathname.startsWith('/restablecer-contrasena') ||
    localizedPathname.startsWith('/reset-password');
  const isPublicRoute =
    localizedPathname === '/' ||
    localizedPathname.startsWith('/validar-certificado') ||
    localizedPathname.startsWith('/privacy') ||
    localizedPathname.startsWith('/privacidad') ||
    localizedPathname.startsWith('/terms') ||
    localizedPathname.startsWith('/terminos');

  const isRegisteredRecently = Boolean(request.cookies.get('just_registered_email')?.value);
  const isPendingVerification = (user && !user.email_confirmed_at) || isRegisteredRecently;

  // La página de confirmación ÚNICAMENTE debe ser visible tras registrar un correo
  if (
    (localizedPathname.startsWith('/verificar-correo') ||
      localizedPathname.startsWith('/verify-email')) &&
    !isPendingVerification &&
    !isServerAction
  ) {
    const url = request.nextUrl.clone();
    url.pathname = localizedHref(preferredLocale, 'register');
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // Si no está autenticado y no es una ruta de autenticación/callback/restablecimiento ni una Server Action:
  // Siempre redirigir al login
  if (
    !user &&
    !isAuthRoute &&
    !isAuthCallback &&
    !isApiRoute &&
    !isPasswordResetRoute &&
    !isPublicRoute &&
    !isServerAction
  ) {
    const url = request.nextUrl.clone();
    url.pathname = localizedHref(preferredLocale, 'login');
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // Si está autenticado pero NO ha confirmado su correo electrónico:
  // Bloquear acceso a onboarding, dashboard u otras rutas protegidas y dirigir a /verificar-correo
  if (
    user &&
    !user.email_confirmed_at &&
    !localizedPathname.startsWith('/verificar-correo') &&
    !localizedPathname.startsWith('/verify-email') &&
    !isAuthCallback &&
    !isApiRoute &&
    !isServerAction
  ) {
    const url = request.nextUrl.clone();
    url.pathname = localizedHref(preferredLocale, 'verifyEmail');
    if (user.email) {
      url.searchParams.set('email', user.email);
    }
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  if (user && user.email_confirmed_at && localizedPathname === '/' && !isServerAction) {
    const url = request.nextUrl.clone();
    const hasCompletedOnboarding = Boolean(user.user_metadata?.onboarding_completed);
    url.pathname = hasCompletedOnboarding
      ? localizedHref(preferredLocale, 'app')
      : localizedHref(preferredLocale, 'onboarding');
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  if (!user && pathname === '/' && !isServerAction) {
    const url = request.nextUrl.clone();
    url.pathname = localizedHref(preferredLocale, 'landing');
    return NextResponse.redirect(url);
  }

  // Si ya está autenticado con correo confirmado e intenta navegar a rutas de autenticación:
  // Redirigir a /onboarding (si no ha completado la encuesta) o al dashboard (/app)
  if (user && user.email_confirmed_at && isAuthRoute && !isServerAction) {
    // Si acaba de registrarse, permitirle ver la pantalla de confirmación
    if (
      (localizedPathname.startsWith('/verificar-correo') ||
        localizedPathname.startsWith('/verify-email')) &&
      isRegisteredRecently
    ) {
      return supabaseResponse;
    }

    const url = request.nextUrl.clone();
    const hasCompletedOnboarding = Boolean(user.user_metadata?.onboarding_completed);
    url.pathname = hasCompletedOnboarding
      ? localizedHref(preferredLocale, 'app')
      : localizedHref(preferredLocale, 'onboarding');
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  return supabaseResponse;
}
