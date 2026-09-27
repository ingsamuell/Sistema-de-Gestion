'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { FolderKanban, ArrowRight, Plus, Calendar } from 'lucide-react';
import { defaultLocale, getLocaleFromPathname } from '@/lib/i18n/locale';
import { localizedHref, localizedProjectHref } from '@/lib/i18n/routes';

export interface HomeProjectItem {
  id: string;
  titulo: string;
  prioridad?: string | null;
  progreso: number;
  completedTasks: number;
  totalTasks: number;
  fecha_limite?: string | null;
}

interface HomeActiveProjectsProps {
  projects: HomeProjectItem[];
}

export function HomeActiveProjects({ projects }: HomeActiveProjectsProps) {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname) ?? defaultLocale;
  if (projects.length === 0) {
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-on-surface">Proyectos en curso</h2>
        </div>
        <Card className="p-6 border-dashed border-2 border-outline-variant/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-2xl bg-[#f5e5d9] flex items-center justify-center text-[#845326] shrink-0">
              <FolderKanban className="size-6" />
            </div>
            <div>
              <h3 className="font-bold text-on-surface text-base">
                Aún no tienes proyectos creados
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Crea tu primer proyecto para organizar tus materias o metas de estudio.
              </p>
            </div>
          </div>
          <Link
            href={localizedHref(locale, 'newProject')}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-on-primary hover:bg-primary/90 transition-colors shadow-xs"
          >
            <Plus className="size-4" />
            <span>Crear Proyecto</span>
          </Link>
        </Card>
      </section>
    );
  }

  const formatDeadline = (fechaLimite?: string | null) => {
    if (!fechaLimite) return null;
    try {
      const datePart = fechaLimite.split('T')[0].trim();
      const parts = datePart.split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${year}-${month}-${day}`;
      }
      return datePart.slice(0, 10);
    } catch {
      return fechaLimite.slice(0, 10);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-on-surface">Tus proyectos en progreso</h2>
          <p className="text-xs sm:text-sm text-on-surface-variant">
            {projects.length} {projects.length === 1 ? 'proyecto activo' : 'proyectos activos'}
          </p>
        </div>
        <Link
          href={localizedHref(locale, 'projects')}
          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
        >
          <span>Ver todos</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => {
          const deadlineFormatted = formatDeadline(project.fecha_limite);
          const priorityBadgeVariant =
            project.prioridad?.toLowerCase() === 'prioritario' ||
            project.prioridad?.toLowerCase() === 'alta'
              ? 'priority'
              : project.prioridad?.toLowerCase() === 'urgente'
                ? 'urgent'
                : 'default';

          return (
            <Link
              key={project.id}
              href={localizedProjectHref(locale, project.id)}
              className="block group"
            >
              <Card
                hoverable
                className="p-5 h-full flex flex-col justify-between group-hover:border-primary/40"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                      <FolderKanban className="size-3.5 text-accent-amber" />
                      <span className="truncate max-w-[160px]">{project.titulo}</span>
                    </span>
                    {project.prioridad && (
                      <Badge variant={priorityBadgeVariant}>{project.prioridad}</Badge>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-1">
                    {project.titulo}
                  </h3>

                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-medium text-on-surface-variant">
                      <span>Progreso</span>
                      <span className="font-bold text-on-surface">{project.progreso}%</span>
                    </div>
                    <ProgressBar
                      progress={project.progreso}
                      color={project.progreso === 100 ? 'green' : 'amber'}
                      height="sm"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 mt-3 border-t border-outline-variant/20 text-xs text-on-surface-variant">
                  <span>
                    {project.completedTasks} de {project.totalTasks} tareas
                  </span>

                  {deadlineFormatted ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-on-surface">
                      <Calendar className="size-3 text-outline" />
                      {deadlineFormatted}
                    </span>
                  ) : (
                    <span className="text-primary font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Abrir <ArrowRight className="size-3" />
                    </span>
                  )}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
