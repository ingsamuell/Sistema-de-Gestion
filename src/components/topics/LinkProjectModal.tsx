'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { X, FolderKanban, Plus, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LinkedProject, ProjectOption } from '@/features/topics/types';
import {
  getUserProjectsAction,
  linkProjectAction,
  unlinkProjectAction,
} from '@/features/topics/actions/projectsActions';
import { cn } from '@/lib/utils';
import { defaultLocale, getLocaleFromPathname } from '@/lib/i18n/locale';

interface LinkProjectModalProps {
  isOpen: boolean;
  topicId: string;
  onClose: () => void;
  onProjectLinked: (project: LinkedProject) => void;
  onProjectUnlinked: (projectId: string) => void;
}

export function LinkProjectModal({
  isOpen,
  topicId,
  onClose,
  onProjectLinked,
  onProjectUnlinked,
}: LinkProjectModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <LinkProjectModalContent
        key={`${topicId}-${isOpen}`}
        topicId={topicId}
        onClose={onClose}
        onProjectLinked={onProjectLinked}
        onProjectUnlinked={onProjectUnlinked}
      />
    </div>
  );
}

interface LinkProjectModalContentProps {
  topicId: string;
  onClose: () => void;
  onProjectLinked: (project: LinkedProject) => void;
  onProjectUnlinked: (projectId: string) => void;
}

function LinkProjectModalContent({
  topicId,
  onClose,
  onProjectLinked,
  onProjectUnlinked,
}: LinkProjectModalContentProps) {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname) ?? defaultLocale;
  const copy =
    locale === 'es'
      ? {
          loadError: 'Error al cargar proyectos',
          unavailable: 'No se pudieron obtener los proyectos',
          unlinkError: 'Error al desvincular',
          linkError: 'Error al vincular',
          title: 'Vincular proyecto al tema',
          yourProjects: 'Tus proyectos',
          project: 'proyecto',
          projects: 'proyectos',
          loading: 'Cargando proyectos...',
          empty: 'No tienes proyectos registrados',
          emptyHint:
            'Crea un proyecto en el módulo de proyectos para poder vincularlo a este tema.',
          milestones: 'hitos',
          linked: 'Vinculado',
          link: 'Vincular',
          close: 'Cerrar',
        }
      : {
          loadError: 'Could not load projects',
          unavailable: 'Could not get your projects',
          unlinkError: 'Could not unlink project',
          linkError: 'Could not link project',
          title: 'Link project to topic',
          yourProjects: 'Your projects',
          project: 'project',
          projects: 'projects',
          loading: 'Loading projects...',
          empty: 'You have no registered projects',
          emptyHint: 'Create a project in the Projects area to link it to this topic.',
          milestones: 'milestones',
          linked: 'Linked',
          link: 'Link',
          close: 'Close',
        };
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    getUserProjectsAction(topicId)
      .then((res) => {
        if (!isMounted) return;
        setLoading(false);
        if (res.success && res.data) {
          setProjects(res.data);
        } else {
          setError(res.error || copy.loadError);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setLoading(false);
        setError(copy.unavailable);
      });

    return () => {
      isMounted = false;
    };
  }, [topicId, copy.loadError, copy.unavailable]);

  async function handleToggleLink(project: ProjectOption) {
    setActionLoadingId(project.id);
    try {
      if (project.isLinked) {
        const res = await unlinkProjectAction(topicId, project.id);
        if (res.success) {
          setProjects((prev) =>
            prev.map((p) => (p.id === project.id ? { ...p, isLinked: false } : p)),
          );
          onProjectUnlinked(project.id);
        } else {
          setError(res.error || copy.unlinkError);
        }
      } else {
        const res = await linkProjectAction(topicId, project.id);
        if (res.success && res.data) {
          setProjects((prev) =>
            prev.map((p) =>
              p.id === project.id ? { ...p, isLinked: true } : { ...p, isLinked: false },
            ),
          );
          onProjectLinked(res.data);
        } else {
          setError(res.error || copy.linkError);
        }
      }
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="w-full max-w-xl rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-2xl max-h-[90vh] flex flex-col">
      <div className="flex items-center justify-between border-b border-outline-variant/30 pb-4">
        <div className="flex items-center gap-2 text-primary font-bold">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FolderKanban className="size-4" />
          </div>
          <span>{copy.title}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-lg text-outline hover:bg-surface-container-low transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-outline">
          {copy.yourProjects}
        </h4>
        {!loading && projects.length > 0 && (
          <span className="text-xs text-on-surface-variant font-medium">
            {projects.length} {projects.length === 1 ? copy.project : copy.projects}
          </span>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 text-xs rounded-xl bg-error/10 border border-error/20 text-error font-medium">
          {error}
        </div>
      )}

      <div className="mt-3 flex-1 overflow-y-auto min-h-0 pr-1 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-outline">
            <Loader2 className="size-6 animate-spin mb-2" />
            <p className="text-xs">{copy.loading}</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low/40 p-8 text-center">
            <FolderKanban className="mx-auto size-8 text-outline mb-2" />
            <p className="text-sm font-semibold">{copy.empty}</p>
            <p className="mt-1 text-xs text-on-surface-variant">{copy.emptyHint}</p>
          </div>
        ) : (
          projects.map((project) => {
            const isActionLoading = actionLoadingId === project.id;
            return (
              <div
                key={project.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-outline-variant/60 bg-surface p-4 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{project.name}</p>
                  {project.description && (
                    <p className="text-xs text-on-surface-variant line-clamp-1 mt-0.5">
                      {project.description}
                    </p>
                  )}
                  <div className="mt-2.5 flex items-center gap-3">
                    <div className="h-1.5 flex-1 max-w-[140px] overflow-hidden rounded-full bg-surface-container-high">
                      <div
                        className="h-full rounded-full bg-accent-amber transition-all"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-outline">
                      {project.progress}% ({project.completedMilestones}/{project.totalMilestones}{' '}
                      {copy.milestones})
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant={project.isLinked ? 'secondary' : 'primary'}
                  disabled={isActionLoading}
                  onClick={() => handleToggleLink(project)}
                  className={cn(
                    'min-w-[7rem] shrink-0 gap-1.5',
                    project.isLinked &&
                      'border-status-success text-status-success hover:bg-error/10 hover:text-error hover:border-error',
                  )}
                >
                  {isActionLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : project.isLinked ? (
                    <>
                      <Check className="size-3.5" />
                      {copy.linked}
                    </>
                  ) : (
                    <>
                      <Plus className="size-3.5" />
                      {copy.link}
                    </>
                  )}
                </Button>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-outline-variant/30 flex justify-end">
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          {copy.close}
        </Button>
      </div>
    </div>
  );
}
