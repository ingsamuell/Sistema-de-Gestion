'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FolderKanban, Calendar, BarChart2, Sparkles, Award } from 'lucide-react';

export function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', icon: Home, label: 'Inicio' },
    { href: '/proyectos', icon: FolderKanban, label: 'Proyectos' },
    { href: '/calendario', icon: Calendar, label: 'Calendario' },
    { href: '/analitica', icon: BarChart2, label: 'Analítica' },
    { href: '/certificaciones', icon: Award, label: 'Certif.' },
    { href: '/ia', icon: Sparkles, label: 'IA' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-outline-variant/30 px-2 py-2 pb-safe flex items-center justify-between z-50">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

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
