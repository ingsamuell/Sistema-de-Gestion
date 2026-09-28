'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  FolderKanban,
  Calendar,
  BarChart2,
  Sparkles,
  LibraryBig,
  HelpCircle,
} from 'lucide-react';
import {
  getProjectsAction,
  type ProjectRecord,
} from '@/features/proyectos/actions/proyectoActions';
import { defaultLocale, getLocaleFromPathname } from '@/lib/i18n/locale';
import { localizedHref, localizedProjectHref } from '@/lib/i18n/routes';
import { useTourContext } from '@/contexts/TourContext';

export function SidebarNav() {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname) ?? defaultLocale;
  const { hasTour, startCurrentTour } = useTourContext();
  const copy =
    locale === 'es'
      ? {
          home: 'Inicio',
          projects: 'Proyectos',
          topics: 'Temas',
          calendar: 'Calendario',
          analytics: 'Analítica',
          assistant: 'Asistente IA',
          emptyProjects: 'Aún no tienes proyectos.',
          help: 'Ayuda de esta página',
        }
      : {
          home: 'Home',
          projects: 'Projects',
          topics: 'Topics',
          calendar: 'Calendar',
          analytics: 'Analytics',
          assistant: 'AI assistant',
          emptyProjects: 'You do not have any projects yet.',
          help: 'Help with this page',
        };

  const navItems = [
    { href: localizedHref(locale, 'app'), icon: Home, label: copy.home, route: 'app' },
    {
      href: localizedHref(locale, 'projects'),
      icon: FolderKanban,
      label: copy.projects,
      route: 'projects',
    },
    {
      href: localizedHref(locale, 'topics'),
      icon: LibraryBig,
      label: copy.topics,
      route: 'topics',
    },
    {
      href: localizedHref(locale, 'calendar'),
      icon: Calendar,
      label: copy.calendar,
      route: 'calendar',
    },
    {
      href: localizedHref(locale, 'analytics'),
      icon: BarChart2,
      label: copy.analytics,
      route: 'analytics',
    },
    {
      href: localizedHref(locale, 'assistant'),
      icon: Sparkles,
      label: copy.assistant,
      route: 'assistant',
    },
  ];

  const [sidebarProjects, setSidebarProjects] = React.useState<
    { id: string; name: string; importance?: string }[]
  >([]);

  React.useEffect(() => {
    let isMounted = true;

    const loadProjects = async () => {
      try {
        const result = await getProjectsAction();
        if (!isMounted) return;

        if (!result.success) {
          setSidebarProjects([]);
          return;
        }

        setSidebarProjects(
          (result.projects as ProjectRecord[]).map((project) => ({
            id: project.id,
            name: project.titulo,
            importance: project.prioridad,
          })),
        );
      } catch (e) {
        console.error(e);
        if (isMounted) setSidebarProjects([]);
      }
    };

    loadProjects();

    window.addEventListener('projects_updated', loadProjects);
    return () => {
      isMounted = false;
      window.removeEventListener('projects_updated', loadProjects);
    };
  }, []);

  return (
    <nav className="flex-1 px-4 space-y-1 mt-4">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <div key={item.href}>
            <Link
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-surface-container-high text-primary font-semibold'
                  : 'text-on-surface hover:bg-surface-container'
              }`}
            >
              <div className={isActive ? 'text-primary' : 'text-outline'}>
                <Icon className="size-5" />
              </div>
              {item.label}
            </Link>

            {item.route === 'projects' && isActive && sidebarProjects.length > 0 && (
              <div className="pl-11 pr-4 py-2 space-y-3 animate-in fade-in duration-200">
                {sidebarProjects
                  .sort((a, b) => {
                    const isAHigh = ['obligatorio', 'prioritario'].includes(
                      (a.importance || '').toLowerCase(),
                    );
                    const isBHigh = ['obligatorio', 'prioritario'].includes(
                      (b.importance || '').toLowerCase(),
                    );
                    if (isAHigh && !isBHigh) return -1;
                    if (!isAHigh && isBHigh) return 1;
                    return 0;
                  })
                  .slice(0, 3)
                  .map((p, pIdx) => (
                    <SubItem
                      key={`${p.id || 'project'}-${pIdx}`}
                      label={p.name}
                      href={localizedProjectHref(locale, p.id)}
                    />
                  ))}
              </div>
            )}

            {item.route === 'projects' && isActive && sidebarProjects.length === 0 && (
              <div className="pl-11 pr-4 py-2 animate-in fade-in duration-200">
                <p className="text-xs text-on-surface-variant">{copy.emptyProjects}</p>
              </div>
            )}
          </div>
        );
      })}

      {hasTour && (
        <button
          type="button"
          onClick={startCurrentTour}
          className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
        >
          <div className="text-outline">
            <HelpCircle className="size-5" />
          </div>
          {copy.help}
        </button>
      )}
    </nav>
  );
}

function SubItem({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 text-xs text-on-surface-variant hover:text-primary cursor-pointer transition-colors"
    >
      <div className="size-1.5 rounded-full bg-accent-amber/50" />
      {label}
    </Link>
  );
}
