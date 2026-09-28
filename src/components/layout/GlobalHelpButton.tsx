'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { HelpCircle } from 'lucide-react';
import { defaultLocale, getLocaleFromPathname } from '@/lib/i18n/locale';
import { useTourContext } from '@/contexts/TourContext';

export function GlobalHelpButton() {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname) ?? defaultLocale;
  const label = locale === 'es' ? 'Ayuda de esta página' : 'Help with this page';
  const { hasTour, startCurrentTour } = useTourContext();

  if (!hasTour) return null;

  return (
    <button
      type="button"
      onClick={startCurrentTour}
      aria-label={label}
      title={label}
      className="p-1.5 md:p-2 text-outline hover:text-primary transition-colors cursor-pointer rounded-full hover:bg-primary/5 flex items-center justify-center shrink-0"
    >
      <HelpCircle className="size-5 md:size-6" />
    </button>
  );
}
