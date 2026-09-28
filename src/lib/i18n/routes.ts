import type { Locale } from '@/lib/i18n/locale';

export type LocalizedRoute =
  | 'landing'
  | 'app'
  | 'login'
  | 'register'
  | 'onboarding'
  | 'verifyEmail'
  | 'forgotPassword'
  | 'resetPassword'
  | 'projects'
  | 'newProject'
  | 'topics'
  | 'calendar'
  | 'analytics'
  | 'assistant'
  | 'profile'
  | 'certifications'
  | 'privacy'
  | 'terms';

const routeSegments: Record<Locale, Record<LocalizedRoute, string>> = {
  es: {
    landing: '',
    app: 'app',
    login: 'login',
    register: 'registro',
    onboarding: 'onboarding',
    verifyEmail: 'verificar-correo',
    forgotPassword: 'recuperar-contrasena',
    resetPassword: 'restablecer-contrasena',
    projects: 'proyectos',
    newProject: 'proyectos/nuevo',
    topics: 'temas',
    calendar: 'calendario',
    analytics: 'analitica',
    assistant: 'ia',
    profile: 'perfil',
    certifications: 'certificaciones',
    privacy: 'privacidad',
    terms: 'terminos',
  },
  en: {
    landing: '',
    app: 'app',
    login: 'login',
    register: 'register',
    onboarding: 'onboarding',
    verifyEmail: 'verify-email',
    forgotPassword: 'forgot-password',
    resetPassword: 'reset-password',
    projects: 'projects',
    newProject: 'projects/new',
    topics: 'topics',
    calendar: 'calendar',
    analytics: 'analytics',
    assistant: 'ai',
    profile: 'profile',
    certifications: 'certifications',
    privacy: 'privacy',
    terms: 'terms',
  },
};

export function localizedHref(locale: Locale, route: LocalizedRoute): string {
  const segment = routeSegments[locale][route];
  return segment ? `/${locale}/${segment}` : `/${locale}`;
}

export function localizedProjectHref(locale: Locale, projectId: string): string {
  return `${localizedHref(locale, 'projects')}/${encodeURIComponent(projectId)}`;
}

export function getLocalizedLegacyPath(locale: Locale, pathname: string): string | null {
  const staticRoutes: Record<string, LocalizedRoute> = {
    '/app': 'app',
    '/login': 'login',
    '/register': 'register',
    '/onboarding': 'onboarding',
    '/verificar-correo': 'verifyEmail',
    '/recuperar-contrasena': 'forgotPassword',
    '/restablecer-contrasena': 'resetPassword',
    '/proyectos/nuevo': 'newProject',
    '/proyectos': 'projects',
    '/temas': 'topics',
    '/calendario': 'calendar',
    '/analitica': 'analytics',
    '/ia': 'assistant',
    '/perfil': 'profile',
    '/certificaciones': 'certifications',
    '/privacy': 'privacy',
    '/terms': 'terms',
  };

  if (staticRoutes[pathname]) return localizedHref(locale, staticRoutes[pathname]);

  if (pathname.startsWith('/proyectos/')) {
    const projectId = pathname.slice('/proyectos/'.length);
    return projectId ? localizedProjectHref(locale, projectId) : null;
  }

  return null;
}
