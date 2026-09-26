import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseEnv } from '@/lib/supabase/env';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

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
        supabaseResponse = NextResponse.next({
          request,
        });
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

  const pathname = request.nextUrl.pathname;

  const isServerAction = request.headers.has('next-action');
  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/recuperar-contrasena') ||
    pathname.startsWith('/verificar-correo');
  const isAuthCallback = pathname.startsWith('/auth') || pathname.startsWith('/api/auth');
  const isApiRoute = pathname.startsWith('/api/');
  const isPasswordResetRoute = pathname.startsWith('/restablecer-contrasena');
  const isPublicRoute = pathname.startsWith('/validar-certificado');

  const isRegisteredRecently = Boolean(request.cookies.get('just_registered_email')?.value);
  const isPendingVerification = (user && !user.email_confirmed_at) || isRegisteredRecently;

  // La página de confirmación ÚNICAMENTE debe ser visible tras registrar un correo
  if (pathname.startsWith('/verificar-correo') && !isPendingVerification && !isServerAction) {
    const url = request.nextUrl.clone();
    url.pathname = '/register';
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
    url.pathname = '/login';
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
    !pathname.startsWith('/verificar-correo') &&
    !isAuthCallback &&
    !isApiRoute &&
    !isServerAction
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/verificar-correo';
    if (user.email) {
      url.searchParams.set('email', user.email);
    }
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // Si ya está autenticado con correo confirmado e intenta navegar a rutas de autenticación:
  // Redirigir a /onboarding (si no ha completado la encuesta) o al dashboard (/)
  if (user && user.email_confirmed_at && isAuthRoute && !isServerAction) {
    // Si acaba de registrarse, permitirle ver la pantalla de confirmación
    if (pathname.startsWith('/verificar-correo') && isRegisteredRecently) {
      return supabaseResponse;
    }

    const url = request.nextUrl.clone();
    const hasCompletedOnboarding = Boolean(user.user_metadata?.onboarding_completed);
    url.pathname = hasCompletedOnboarding ? '/' : '/onboarding';
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  return supabaseResponse;
}
