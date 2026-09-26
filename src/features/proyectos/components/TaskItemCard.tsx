'use client';

import React, { useState } from 'react';
import {
  Clock,
  ExternalLink,
  Play,
  Check,
  Trash2,
  Calendar,
  Pencil,
  Award,
  Lock,
} from 'lucide-react';
import { TechniqueSelectionModal } from '@/components/study/TechniqueSelectionModal';
import { TaskCompletedDetailModal } from '@/features/proyectos/components/TaskCompletedDetailModal';
import { useFocusSession } from '@/contexts/FocusSessionContext';

export interface Task {
  id: string;
  title: string;
  description?: string;
  duration: string | number;
  timeSlot?: string;
  startDate?: string | null;
  resourceUrl?: string | null;
  resourceName?: string;
  isCompleted: boolean;
  quizAprobado?: boolean;
  completedAt?: string | null;
  metodoEstudio?: string | null;
  tiempoEmpleado?: number | null;
  tecnicaSirvio?: boolean | null;
}

interface TaskItemCardProps {
  task: Task;
  projectId?: string;
  projectName: string;
  projectPriority: string;
  userPreferredTechnique?: string | null;
  onToggleComplete: (id: string, newStatus: boolean) => void;
  onDeleteTask?: (id: string) => void;
  onEditTask?: (task: Task) => void;
  onOpenQuiz?: (taskId: string) => void;
  onUpdateFeedback?: (
    taskId: string,
    feedback: {
      metodoEstudio: string;
      tiempoEmpleado: number;
      tecnicaSirvio: boolean;
      tecnicaPreferida: string;
    },
  ) => void;
}

function formatStartDate(dateStr?: string | null): string {
  if (!dateStr) return 'Por definir';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dateFormatted = d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timeFormatted = d.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${dateFormatted}, ${timeFormatted}`;
  } catch {
    return dateStr;
  }
}

function formatDuration(duration: string | number): string {
  if (typeof duration === 'number') {
    if (duration >= 60) {
      const h = Math.floor(duration / 60);
      const m = duration % 60;
      return m > 0 ? `${h} h ${m} min` : `${h} h`;
    }
    return `${duration} min`;
  }
  return duration || '30 min';
}

function extractUrls(rawUrl?: string | null): string[] {
  if (!rawUrl || typeof rawUrl !== 'string') return [];
  return rawUrl
    .split(/[\s,|;\n]+/)
    .map((u) => u.trim())
    .filter(
      (u) =>
        u.length > 0 && (u.startsWith('http://') || u.startsWith('https://') || u.includes('.')),
    );
}

export function TaskItemCard({
  task,
  projectId,
  projectName,
  projectPriority,
  userPreferredTechnique,
  onToggleComplete,
  onDeleteTask,
  onEditTask,
  onOpenQuiz,
  onUpdateFeedback,
}: TaskItemCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showFocusModal, setShowFocusModal] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const isCompleted = task.isCompleted;

  const { isActive, activeTaskId, stopSession } = useFocusSession();
  const isThisTaskActive = Boolean(isActive && activeTaskId === task.id);
  const isAnotherTaskActive = Boolean(isActive && activeTaskId !== task.id);

  const handleToggle = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    const newStatus = !isCompleted;

    // Si la tarea marcada como completada era la que tenía sesión activa, detener la sesión de estudio
    if (newStatus && isThisTaskActive) {
      stopSession();
    }

    try {
      await onToggleComplete(task.id, newStatus);
    } catch (error) {
      console.error('Error toggling task status', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const formattedDuration = formatDuration(task.duration);
  const recommendedUrls = extractUrls(task.resourceUrl);

  return (
    <div
      className={`
        flex flex-col sm:flex-row gap-4 items-start sm:items-stretch
        p-4 sm:p-5 rounded-[20px] border-2 transition-all duration-300
        ${
          isCompleted
            ? 'bg-surface-container-lowest border-transparent'
            : 'bg-white border-[#E8DCD1] hover:shadow-md hover:border-[#d2c4bb]'
        }
      `}
    >
      {/* 1. Lado Izquierdo (Interacción) */}
      <div className="flex-shrink-0 pt-1">
        <button
          onClick={handleToggle}
          disabled={isUpdating}
          className={`
            w-7 h-7 rounded-md flex items-center justify-center transition-colors border-2 cursor-pointer
            ${
              isCompleted
                ? 'bg-[#845326] border-[#845326] text-white'
                : 'border-[#d2c4bb] bg-transparent hover:border-[#845326]'
            }
          `}
          aria-label={isCompleted ? 'Marcar como incompleta' : 'Marcar como completa'}
        >
          {isCompleted && <Check className="size-4" strokeWidth={3} />}
        </button>
      </div>

      {/* 2. Centro (Información y Recursos) */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {/* Badges superiores */}
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-[10px] font-bold tracking-wider uppercase text-[#845326] bg-[#f5e5d9] px-2 py-0.5 rounded-full">
            {projectName}
          </span>
          <span
            className={`
            text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full
            ${projectPriority === 'Prioritario' ? 'bg-red-100 text-red-700' : ''}
            ${projectPriority === 'Obligatorio' ? 'bg-orange-100 text-orange-700' : ''}
            ${projectPriority === 'Hobby' ? 'bg-blue-100 text-blue-700' : ''}
            ${!['Prioritario', 'Obligatorio', 'Hobby'].includes(projectPriority) ? 'bg-gray-100 text-gray-700' : ''}
          `}
          >
            {projectPriority}
          </span>
        </div>

        {/* Título y Descripción */}
        <h3
          className={`text-base font-bold transition-all ${
            isCompleted ? 'text-gray-400 line-through decoration-gray-300' : 'text-on-surface'
          }`}
        >
          {task.title}
        </h3>
        {task.description && (
          <p className={`text-sm ${isCompleted ? 'text-gray-400' : 'text-on-surface-variant'}`}>
            {task.description}
          </p>
        )}

        {/* Metadatos: Inicio y Tiempo de duración */}
        <div className="flex flex-wrap items-center gap-3 mt-2">
          {/* Fecha de inicio */}
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-on-surface-variant bg-[#FDFBF9] px-2.5 py-1 rounded-lg border border-[#E8DCD1]/60">
            <Calendar className="size-3.5 text-[#845326]" />
            <span>
              inicio:{' '}
              {task.startDate
                ? formatStartDate(task.startDate)
                : task.timeSlot && task.timeSlot !== 'Hito de estudio'
                  ? task.timeSlot
                  : 'Por definir'}
            </span>
          </div>

          {/* Tiempo de duración */}
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-on-surface-variant">
            <Clock className="size-3.5 text-[#845326]" />
            <span>{formattedDuration}</span>
          </div>
        </div>

        {/* Debajo del apartado de fecha de inicio: URLs recomendadas para la tarea */}
        {recommendedUrls.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-2 pt-1.5 border-t border-[#E8DCD1]/50">
            <span className="text-[11px] font-bold text-[#845326]/80 uppercase tracking-wider">
              Recursos:
            </span>
            {recommendedUrls.map((url, idx) => {
              const label = url
                .replace(/^https?:\/\/(www\.)?/, '')
                .replace(/\/$/, '')
                .split('/')[0];
              return (
                <a
                  key={idx}
                  href={url.startsWith('http') ? url : `https://${url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#845326] hover:text-[#433022] hover:underline bg-[#f5e5d9]/60 hover:bg-[#f5e5d9] px-2.5 py-1 rounded-full border border-[#E8DCD1] transition-all max-w-[220px]"
                  title={`URL recomendada: ${url}`}
                >
                  <ExternalLink className="size-3 shrink-0" />
                  <span className="truncate">
                    {task.resourceName && recommendedUrls.length === 1 ? task.resourceName : label}
                  </span>
                </a>
              );
            })}
          </div>
        )}

        {/* Botón de Micro-Quiz por tarea */}
        {onOpenQuiz && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!task.quizAprobado && isCompleted) onOpenQuiz(task.id);
              }}
              disabled={task.quizAprobado || !isCompleted}
              title={
                task.quizAprobado
                  ? 'Quiz ya aprobado'
                  : !isCompleted
                    ? 'Completa la tarea primero para habilitar el quiz'
                    : 'Realizar quiz de la tarea'
              }
              className={`
                inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-xs border
                ${
                  task.quizAprobado
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100 opacity-80 cursor-not-allowed'
                    : !isCompleted
                      ? 'bg-[#F2EBE5]/60 border-[#E8DCD1] text-[#A8988B] cursor-not-allowed opacity-75'
                      : 'bg-[#FBE6DD]/60 border-[#FBE6DD] text-[#845326] hover:bg-[#FBE6DD] cursor-pointer'
                }
              `}
            >
              {task.quizAprobado ? (
                <>
                  <Check className="size-3.5" strokeWidth={3} />
                  Quiz Aprobado
                </>
              ) : !isCompleted ? (
                <>
                  <Lock className="size-3.5" />
                  Realizar Quiz
                </>
              ) : (
                <>
                  <Award className="size-3.5" />
                  Realizar Quiz
                </>
              )}
            </button>
            {!isCompleted && !task.quizAprobado && (
              <span className="text-[11px] font-medium text-[#A8988B] select-none">
                (Completa la tarea primero)
              </span>
            )}
          </div>
        )}
      </div>

      {/* 3. Lado Derecho (Acción: Editar y Borrar arriba, Iniciar tarea abajo a la derecha) */}
      <div className="flex-shrink-0 w-full sm:w-auto mt-2 sm:mt-0 flex flex-col justify-between items-stretch sm:items-end gap-3 self-stretch">
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {onEditTask && (
            <button
              type="button"
              onClick={() => onEditTask(task)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#f5e5d9] hover:bg-[#E8DCD1] text-[#845326] hover:text-[#433022] px-3.5 py-1.5 text-xs font-bold border border-[#dccbbd]/80 shadow-xs hover:shadow-sm transition-all hover:-translate-y-0.5 active:scale-95 cursor-pointer"
              title="Editar tarea"
            >
              <Pencil className="size-3.5 text-[#845326]" />
              <span>Editar tarea</span>
            </button>
          )}
          {onDeleteTask && (
            <button
              onClick={() => onDeleteTask(task.id)}
              className="w-10 h-8 sm:w-auto sm:px-3 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors border border-red-100 cursor-pointer active:scale-90"
              aria-label="Eliminar tarea"
              title="Eliminar tarea"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>

        <div className="flex justify-end w-full mt-auto pt-2">
          {isCompleted ? (
            <button
              type="button"
              onClick={() => setShowCompletedModal(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-on-surface px-5 py-2.5 text-sm font-bold text-surface transition-transform hover:scale-105 hover:bg-[#333] active:scale-95 cursor-pointer shadow-xs"
            >
              <span>Ver más</span>
            </button>
          ) : isThisTaskActive ? (
            <button
              type="button"
              disabled
              title="Esta tarea está actualmente en sesión de estudio activa"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-amber-600 text-white px-5 py-2.5 text-sm font-bold shadow-xs cursor-not-allowed opacity-95 animate-pulse"
            >
              <Clock className="size-4 animate-spin text-white" />
              <span>En sesión...</span>
            </button>
          ) : isAnotherTaskActive ? (
            <button
              type="button"
              disabled
              title="Ya tienes una sesión de estudio activa en otra tarea. Termínala o márcala como completada para iniciar otra."
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#E8DCD1] text-gray-400 px-5 py-2.5 text-sm font-bold opacity-60 cursor-not-allowed shadow-none"
            >
              <Play className="size-4 opacity-40" fill="currentColor" />
              <span>Iniciar tarea</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowFocusModal(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-on-surface px-5 py-2.5 text-sm font-bold text-surface transition-transform hover:scale-105 hover:bg-[#333] active:scale-95 cursor-pointer shadow-xs"
            >
              <span>Iniciar tarea</span>
              <Play className="size-4" fill="currentColor" />
            </button>
          )}
        </div>
      </div>

      <TechniqueSelectionModal
        isOpen={showFocusModal}
        onClose={() => setShowFocusModal(false)}
        taskId={task.id}
        taskTitle={task.title}
      />

      <TaskCompletedDetailModal
        isOpen={showCompletedModal}
        onClose={() => setShowCompletedModal(false)}
        task={task}
        projectName={projectName}
        projectId={projectId}
        userPreferredTechnique={userPreferredTechnique}
        onFeedbackSaved={(feedback) => {
          onUpdateFeedback?.(task.id, feedback);
        }}
      />
    </div>
  );
}
