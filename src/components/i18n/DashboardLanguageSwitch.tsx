'use client';

import Link from 'next/link';
import { Languages } from 'lucide-react';
import { usePathname } from 'next/navigation';
import {
  defaultLocale,
  getLocaleFromPathname,
  getPathWithoutLocale,
  type Locale,
} from '@/lib/i18n/locale';
import { localizedHref, localizedProjectHref, type LocalizedRoute } from '@/lib/i18n/routes';

type DashboardLanguageSwitchProps = {
  compact?: boolean;
};

const routesByPath: Record<string, LocalizedRoute> = {
  '/app': 'app',
  '/proyectos': 'projects',
  '/projects': 'projects',
  '/proyectos/nuevo': 'newProject',
  '/projects/new': 'newProject',
  '/temas': 'topics',
  '/topics': 'topics',
  '/calendario': 'calendar',
  '/calendar': 'calendar',
  '/analitica': 'analytics',
  '/analytics': 'analytics',
  '/ia': 'assistant',
  '/ai': 'assistant',
  '/perfil': 'profile',
  '/profile': 'profile',
  '/certificaciones': 'certifications',
  '/certifications': 'certifications',
};

function getAlternateDashboardPath(pathname: string, targetLocale: Locale): string {
  const pathWithoutLocale = getPathWithoutLocale(pathname);
  const exactRoute = routesByPath[pathWithoutLocale];
  if (exactRoute) return localizedHref(targetLocale, exactRoute);

  for (const prefix of ['/proyectos/', '/projects/']) {
    if (pathWithoutLocale.startsWith(prefix)) {
      const projectId = pathWithoutLocale.slice(prefix.length);
      if (projectId) return localizedProjectHref(targetLocale, projectId);
    }
  }

  return localizedHref(targetLocale, 'app');
}

export function DashboardLanguageSwitch({ compact = false }: DashboardLanguageSwitchProps) {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname) ?? defaultLocale;
  const alternateLocale: Locale = locale === 'es' ? 'en' : 'es';
  const label = locale === 'es' ? 'Cambiar a inglés' : 'Switch to Spanish';

  return (
    <Link
      href={getAlternateDashboardPath(pathname, alternateLocale)}
      lang={alternateLocale}
      aria-label={label}
      title={label}
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-2.5 text-xs font-bold text-primary transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${compact ? 'min-w-9 px-2' : ''}`}
    >
      <Languages className="size-3.5" aria-hidden="true" />
      <span>{alternateLocale.toUpperCase()}</span>
    </Link>
  );
}
