'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart2,
  Calendar,
  FolderKanban,
  HelpCircle,
  Home,
  LibraryBig,
  Menu,
  Sparkles,
  X,
} from 'lucide-react';
import { defaultLocale, getLocaleFromPathname } from '@/lib/i18n/locale';
import { localizedHref } from '@/lib/i18n/routes';
import { useTourContext } from '@/contexts/TourContext';

function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname) ?? defaultLocale;
  const { hasTour, startCurrentTour } = useTourContext();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const isMounted = useIsMounted();

  useEffect(() => {
    if (!isMoreOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverscrollBehavior = document.body.style.overscrollBehavior;
    const previousHtmlOverscrollBehavior = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscrollBehavior;
    };
  }, [isMoreOpen]);

  const copy =
    locale === 'es'
      ? {
          home: 'Inicio',
          projects: 'Proyectos',
          topics: 'Temas',
          calendar: 'Calendario',
          analytics: 'Analítica',
          assistant: 'IA',
          more: 'Más',
          moreTitle: 'Más opciones',
          help: 'Ayuda',
          close: 'Cerrar menú',
        }
      : {
          home: 'Home',
          projects: 'Projects',
          topics: 'Topics',
          calendar: 'Calendar',
          analytics: 'Analytics',
          assistant: 'AI',
          more: 'More',
          moreTitle: 'More options',
          help: 'Help',
          close: 'Close menu',
        };

  const primaryItems = [
    { href: localizedHref(locale, 'app'), icon: Home, label: copy.home },
    { href: localizedHref(locale, 'projects'), icon: FolderKanban, label: copy.projects },
    { href: localizedHref(locale, 'calendar'), icon: Calendar, label: copy.calendar },
  ];
  const secondaryItems = [
    { href: localizedHref(locale, 'topics'), icon: LibraryBig, label: copy.topics },
    { href: localizedHref(locale, 'analytics'), icon: BarChart2, label: copy.analytics },
    { href: localizedHref(locale, 'assistant'), icon: Sparkles, label: copy.assistant },
  ];
  const isMoreActive = secondaryItems.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <>
      {isMoreOpen && (
        <div className="md:hidden fixed inset-0 z-[60] flex flex-col justify-end overscroll-none touch-none">
          <button
            type="button"
            aria-label={copy.close}
            className="absolute inset-0 animate-in fade-in duration-200 bg-on-surface/40 motion-reduce:animate-none"
            onClick={() => setIsMoreOpen(false)}
          />
          <section
            id="mobile-more-menu"
            role="dialog"
            aria-modal="true"
            aria-label={copy.moreTitle}
            className="relative w-full shrink-0 overflow-hidden touch-auto animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out rounded-t-[28px] border-t border-outline-variant/30 bg-surface-container-lowest px-5 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] pt-4 shadow-2xl motion-reduce:animate-none"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-outline-variant/70" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-on-surface">{copy.moreTitle}</h2>
              <button
                type="button"
                aria-label={copy.close}
                onClick={() => setIsMoreOpen(false)}
                className="rounded-full p-2 text-outline transition-colors hover:bg-surface-container hover:text-on-surface"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {secondaryItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMoreOpen(false)}
                    className="last:col-span-2 flex w-full items-center gap-3 rounded-2xl border border-outline-variant/30 bg-surface px-4 py-3.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container"
                  >
                    <Icon className="size-5 text-primary" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      )}

      <nav
        id="tour-mobile-nav"
        aria-label={locale === 'es' ? 'Navegación principal' : 'Primary navigation'}
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between border-t border-outline-variant/30 bg-surface/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-1.5 backdrop-blur"
      >
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 transition-colors ${isActive ? 'text-primary' : 'text-outline hover:text-on-surface'}`}
            >
              <Icon className={`size-5 ${isActive ? 'stroke-[2.4]' : ''}`} />
              <span
                className={`text-[10px] leading-tight ${isActive ? 'font-bold' : 'font-medium'}`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={startCurrentTour}
          disabled={isMounted ? !hasTour : undefined}
          suppressHydrationWarning
          aria-label={copy.help}
          className="flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-outline transition-colors hover:text-on-surface disabled:cursor-default disabled:opacity-50"
        >
          <HelpCircle className="size-5" />
          <span className="text-[10px] font-medium leading-tight">{copy.help}</span>
        </button>
        <button
          type="button"
          aria-expanded={isMoreOpen}
          aria-controls="mobile-more-menu"
          onClick={() => setIsMoreOpen(true)}
          className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 transition-colors ${isMoreActive ? 'text-primary' : 'text-outline hover:text-on-surface'}`}
        >
          <Menu
            className={`size-5 transition-transform duration-200 ${isMoreOpen ? 'rotate-90' : ''} ${isMoreActive ? 'stroke-[2.4]' : ''}`}
          />
          <span
            className={`text-[10px] leading-tight ${isMoreActive ? 'font-bold' : 'font-medium'}`}
          >
            {copy.more}
          </span>
        </button>
      </nav>
    </>
  );
}
