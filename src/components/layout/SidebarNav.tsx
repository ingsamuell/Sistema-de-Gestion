'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FolderKanban, Calendar, BarChart2, Sparkles, LibraryBig, Award } from 'lucide-react';
import {
  getProjectsAction,
  type ProjectRecord,
} from '@/features/proyectos/actions/proyectoActions';

export function SidebarNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', icon: Home, label: 'Inicio' },
    { href: '/proyectos', icon: FolderKanban, label: 'Proyectos' },
    { href: '/temas', icon: LibraryBig, label: 'Temas' },
    { href: '/calendario', icon: Calendar, label: 'Calendario' },
    { href: '/analitica', icon: BarChart2, label: 'Analítica' },
    { href: '/certificaciones', icon: Award, label: 'Certificaciones' },
    { href: '/ia', icon: Sparkles, label: 'Asistente IA' },
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
        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

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

            {item.href === '/proyectos' && isActive && sidebarProjects.length > 0 && (
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
                      href={`/proyectos/${p.id}`}
                    />
                  ))}
              </div>
            )}

            {item.href === '/proyectos' && isActive && sidebarProjects.length === 0 && (
              <div className="pl-11 pr-4 py-2 animate-in fade-in duration-200">
                <p className="text-xs text-on-surface-variant">Aún no tienes proyectos.</p>
              </div>
            )}
          </div>
        );
      })}
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
