'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FolderKanban, Calendar, BarChart2, Sparkles, LibraryBig } from 'lucide-react';
import { defaultLocale, getLocaleFromPathname } from '@/lib/i18n/locale';
import { localizedHref } from '@/lib/i18n/routes';

export function MobileNav() {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname) ?? defaultLocale;
  const copy =
    locale === 'es'
      ? {
          home: 'Inicio',
          projects: 'Proyectos',
          topics: 'Temas',
          calendar: 'Calendario',
          analytics: 'Analítica',
          assistant: 'IA',
        }
      : {
          home: 'Home',
          projects: 'Projects',
          topics: 'Topics',
          calendar: 'Calendar',
          analytics: 'Analytics',
          assistant: 'AI',
        };

  const navItems = [
    { href: localizedHref(locale, 'app'), icon: Home, label: copy.home },
    { href: localizedHref(locale, 'projects'), icon: FolderKanban, label: copy.projects },
    { href: localizedHref(locale, 'topics'), icon: LibraryBig, label: copy.topics },
    { href: localizedHref(locale, 'calendar'), icon: Calendar, label: copy.calendar },
    { href: localizedHref(locale, 'analytics'), icon: BarChart2, label: copy.analytics },
    { href: localizedHref(locale, 'assistant'), icon: Sparkles, label: copy.assistant },
  ];

  return (
    <nav
      id="tour-mobile-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-outline-variant/30 px-2 py-2 pb-safe flex items-center justify-between z-50"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1 ${
              isActive ? 'text-primary' : 'text-outline hover:text-on-surface'
            }`}
          >
            <div
              className={`${isActive ? 'bg-surface-container-high' : ''} p-1.5 rounded-full transition-colors`}
            >
              <Icon className="size-5" />
            </div>
            <span
              className={`text-[10px] font-medium leading-tight ${isActive ? 'font-semibold' : ''}`}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
