'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Check,
  Clock,
  ExternalLink,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Play,
} from 'lucide-react';
import { toggleTaskStatusAction } from '@/features/proyectos/actions/proyectoActions';
import { getTaskTimeStatus } from '@/features/gamification/services/streakService';
import { TechniqueSelectionModal } from '@/components/study/TechniqueSelectionModal';

export interface HomeTaskItem {
  id: string;
  id_proyecto: string;
  titulo: string;
  descripcion?: string | null;
  duracion: number;
  completado: boolean;
  fecha_inicio?: string | null;
  prioridad?: string | null;
  resources?: string | null;
  url_recomendada?: string | null;
  projectName: string;
}

interface HomeTaskListProps {
  initialTasks: HomeTaskItem[];
  onTaskToggled?: (taskId: string, newCompleted: boolean, newStreak?: number) => void;
}

export function HomeTaskList({ initialTasks, onTaskToggled }: HomeTaskListProps) {
  const [prevInitialTasks, setPrevInitialTasks] = useState<HomeTaskItem[]>(initialTasks);
  const [tasks, setTasks] = useState<HomeTaskItem[]>(initialTasks);
  if (initialTasks !== prevInitialTasks) {
    setPrevInitialTasks(initialTasks);
    setTasks(initialTasks);
  }

  const [isPending, startTransition] = useTransition();
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);
  const [focusModalTask, setFocusModalTask] = useState<{ id: string; title: string } | null>(null);

  const handleToggle = async (task: HomeTaskItem) => {
    const newStatus = !task.completado;
    setLoadingTaskId(task.id);

    // Actualización optimista local
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completado: newStatus } : t)));

    startTransition(async () => {
      try {
        const res = await toggleTaskStatusAction(task.id, newStatus, task.id_proyecto);
        if (res.success) {
          if (onTaskToggled) {
            onTaskToggled(task.id, newStatus, res.racha_activa);
          }

          window.dispatchEvent(new Event('projects_updated'));
        } else {
          // Revertir en caso de error
          setTasks((prev) =>
            prev.map((t) => (t.id === task.id ? { ...t, completado: !newStatus } : t)),
          );
        }
      } catch (err) {
        console.error('Error al cambiar estado de la tarea:', err);
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, completado: !newStatus } : t)),
        );
      } finally {
        setLoadingTaskId(null);
      }
    });
  };

  const formatTimeOnly = (fechaInicio?: string | null) => {
    if (!fechaInicio) return null;
    try {
      const date = new Date(fechaInicio);
      if (Number.isNaN(date.getTime())) return null;
      const formatted = new Intl.DateTimeFormat('es-VE', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(date);
      return formatted
        .replace(/[\u202f\u00a0]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    } catch {
      return null;
    }
  };

  if (tasks.length === 0) {
    return (
      <Card className="p-8 text-center border-dashed border-2 border-outline-variant/60 bg-surface-container-lowest/50">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent-amber/15 text-accent-amber mb-4">
          <Sparkles className="size-7" />
        </div>
        <h3 className="text-lg font-bold text-on-surface">¡Todo listo y al día!</h3>
        <p className="mt-1.5 text-sm text-on-surface-variant max-w-md mx-auto">
          No tienes tareas pendientes programadas para hoy. Puedes organizar nuevas actividades en
          tus proyectos o descansar.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/proyectos">
            <Button variant="secondary" className="text-xs font-bold gap-2">
              Ver proyectos <ArrowRight className="size-3.5" />
            </Button>
          </Link>
          <Link href="/proyectos/nuevo">
            <Button variant="primary" className="text-xs font-bold gap-2">
              Crear nuevo proyecto
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  const pendingCount = tasks.filter((t) => !t.completado).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-on-surface">Tareas de hoy y prioritarias</h2>
          <p className="text-xs sm:text-sm text-on-surface-variant">
            {pendingCount === 0
              ? '¡Completaste todas tus tareas de hoy!'
              : `${pendingCount} ${pendingCount === 1 ? 'pendiente por abordar' : 'pendientes por abordar'}`}
          </p>
        </div>
        {pendingCount === 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-status-success-bg px-3 py-1 text-xs font-bold text-status-success border border-status-success/20">
            <CheckCircle2 className="size-3.5" />
            Al día
          </span>
        )}
      </div>

      <div className="space-y-3">
        {tasks.map((task) => {
          const timeStatus = getTaskTimeStatus(task);
          const timeLabel = formatTimeOnly(task.fecha_inicio);
          const isTaskLoading = loadingTaskId === task.id;
          const resourceUrl = task.resources || task.url_recomendada;

          const priorityBadgeVariant =
            task.prioridad?.toLowerCase() === 'prioritario' ||
            task.prioridad?.toLowerCase() === 'alta'
              ? 'priority'
              : task.prioridad?.toLowerCase() === 'urgente'
                ? 'urgent'
                : 'default';

          return (
            <Card
              key={task.id}
              className={`p-0 overflow-hidden relative border-l-4 transition-all ${
                task.completado
                  ? 'border-l-status-success bg-surface-container-lowest/60 opacity-80'
                  : timeStatus === 'overdue'
                    ? 'border-l-status-urgent bg-status-urgent-bg/10'
                    : timeStatus === 'in_progress'
                      ? 'border-l-accent-amber'
                      : 'border-l-primary'
              }`}
            >
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-surface-container px-2 py-0.5 text-xs font-semibold text-primary max-w-[200px] truncate">
                      {task.projectName}
                    </span>
                    {task.prioridad && (
                      <Badge variant={priorityBadgeVariant}>{task.prioridad}</Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {timeStatus === 'completed' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-status-success-bg px-2.5 py-0.5 text-[11px] font-bold text-status-success">
                        <Check className="size-3" /> Completada
                      </span>
                    )}
                    {timeStatus === 'overdue' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-status-urgent-bg px-2.5 py-0.5 text-[11px] font-bold text-status-urgent border border-status-urgent/20 animate-pulse">
                        <AlertTriangle className="size-3" /> Vencida
                      </span>
                    )}
                    {timeStatus === 'in_progress' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent-amber/20 px-2.5 py-0.5 text-[11px] font-bold text-accent-amber">
                        <Clock className="size-3" /> En curso
                      </span>
                    )}
                    {timeStatus === 'upcoming' && timeLabel && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-0.5 text-[11px] font-semibold text-on-surface-variant">
                        <Calendar className="size-3" /> {timeLabel}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-1">
                  {/* Botón interactivo de check */}
                  <button
                    type="button"
                    onClick={() => handleToggle(task)}
                    disabled={isTaskLoading || isPending}
                    aria-label={
                      task.completado
                        ? 'Marcar tarea como pendiente'
                        : 'Marcar tarea como completada'
                    }
                    className={`mt-0.5 size-6 shrink-0 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer ${
                      task.completado
                        ? 'bg-status-success border-status-success text-white shadow-xs'
                        : 'border-outline hover:border-primary hover:bg-primary/5 text-transparent'
                    } ${isTaskLoading ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    <Check
                      className={`size-4 stroke-[3] transition-transform ${
                        task.completado ? 'scale-100' : 'scale-0'
                      }`}
                    />
                  </button>

                  <div className="flex-1 min-w-0">
                    <h3
                      className={`text-base font-bold leading-snug transition-colors ${
                        task.completado
                          ? 'line-through text-on-surface-variant/70'
                          : 'text-on-surface'
                      }`}
                    >
                      {task.titulo}
                    </h3>

                    {task.descripcion && (
                      <p className="text-xs text-on-surface-variant mt-1 line-clamp-2 leading-relaxed">
                        {task.descripcion}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-on-surface-variant font-medium">
                      {timeLabel && (
                        <span
                          className="flex items-center gap-1 text-on-surface font-semibold"
                          suppressHydrationWarning
                        >
                          <Clock className="size-3.5 text-accent-amber" />
                          {timeLabel}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <span>{task.duracion || 30} min</span>
                      </span>

                      {resourceUrl && (
                        <a
                          href={
                            resourceUrl.startsWith('http') ? resourceUrl : `https://${resourceUrl}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                        >
                          <ExternalLink className="size-3" />
                          Ver recurso
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Acciones: Proyecto y Enfocar */}
                  <div className="hidden sm:flex flex-col items-end shrink-0 self-center pl-2 gap-2">
                    {!task.completado && (
                      <button
                        onClick={() => setFocusModalTask({ id: task.id, title: task.titulo })}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-surface bg-on-surface hover:bg-[#333] transition-transform hover:scale-105 active:scale-95 px-3 py-1.5 rounded-xl shadow-xs cursor-pointer"
                      >
                        <Play className="size-3.5" fill="currentColor" />
                        <span>Enfocar</span>
                      </button>
                    )}
                    <Link
                      href={`/proyectos/${task.id_proyecto}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-xl hover:bg-surface-container"
                      title="Ver proyecto completo"
                    >
                      <span>Proyecto</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <TechniqueSelectionModal
        isOpen={!!focusModalTask}
        onClose={() => setFocusModalTask(null)}
        taskId={focusModalTask?.id}
        taskTitle={focusModalTask?.title}
      />
    </div>
  );
}
