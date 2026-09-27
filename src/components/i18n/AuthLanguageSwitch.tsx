'use client';

import Link from 'next/link';
import { Languages } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { defaultLocale, getLocaleFromPathname, type Locale } from '@/lib/i18n/locale';
import { localizedHref, type LocalizedRoute } from '@/lib/i18n/routes';

type AuthLanguageSwitchProps = {
  route: Extract<
    LocalizedRoute,
    'login' | 'register' | 'forgotPassword' | 'resetPassword' | 'verifyEmail' | 'onboarding'
  >;
};

export function AuthLanguageSwitch({ route }: AuthLanguageSwitchProps) {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname) ?? defaultLocale;
  const alternateLocale: Locale = locale === 'es' ? 'en' : 'es';
  const label = locale === 'es' ? 'Cambiar a inglés' : 'Switch to Spanish';

  return (
    <Link
      href={localizedHref(alternateLocale, route)}
      lang={alternateLocale}
      aria-label={label}
      className="absolute right-5 top-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-outline-variant/70 bg-surface-container-lowest px-3 text-xs font-bold text-primary shadow-sm transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:right-7 sm:top-7"
    >
      <Languages className="size-3.5" aria-hidden="true" />
      {alternateLocale.toUpperCase()}
    </Link>
  );
}
