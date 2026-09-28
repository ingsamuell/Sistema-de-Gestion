export const locales = ['es', 'en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'es';

export const localeCookieName = 'komorebi_locale';

export function isLocale(value: string | undefined | null): value is Locale {
  return Boolean(value && locales.includes(value as Locale));
}

export function getLocaleFromPathname(pathname: string): Locale | null {
  const segment = pathname.split('/')[1];
  return isLocale(segment) ? segment : null;
}

export function getPathWithoutLocale(pathname: string): string {
  const locale = getLocaleFromPathname(pathname);
  if (!locale) return pathname || '/';

  const pathWithoutLocale = pathname.slice(locale.length + 1);
  return pathWithoutLocale || '/';
}

export function getPreferredLocale({
  cookieLocale,
  acceptLanguage,
}: {
  cookieLocale?: string;
  acceptLanguage?: string | null;
}): Locale {
  if (isLocale(cookieLocale)) return cookieLocale;

  const acceptedLanguages = (acceptLanguage ?? '')
    .split(',')
    .map((entry) => {
      const [language, qualityPart] = entry.trim().toLowerCase().split(';q=');
      const quality = qualityPart ? Number.parseFloat(qualityPart) : 1;
      return { language: language.split('-')[0], quality: Number.isFinite(quality) ? quality : 0 };
    })
    .sort((a, b) => b.quality - a.quality);

  const preferred = acceptedLanguages.find(({ language }) => isLocale(language));
  return preferred && isLocale(preferred.language) ? preferred.language : defaultLocale;
}
