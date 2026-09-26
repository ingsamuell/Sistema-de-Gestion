'use client';

import React, { useState, useTransition, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Clock, Calendar, Sparkles, Loader2, BookmarkCheck } from 'lucide-react';
import { saveTaskStudyFeedbackAction } from '@/features/proyectos/actions/proyectoActions';
import { STUDY_TECHNIQUES } from '@/features/study-methods/data/techniques';

export interface TaskCompletedDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: {
    id: string;
    title: string;
    description?: string;
    duration: string | number;
    completedAt?: string | null;
    metodoEstudio?: string | null;
    tiempoEmpleado?: number | null;
    tecnicaSirvio?: boolean | null;
  };
  projectName?: string;
  projectId?: string;
  userPreferredTechnique?: string | null;
  onFeedbackSaved?: (feedback: {
    metodoEstudio: string;
    tiempoEmpleado: number;
    tecnicaSirvio: boolean;
    tecnicaPreferida: string;
  }) => void;
}

function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function formatDurationText(duration: string | number): string {
  if (typeof duration === 'number') {
    if (duration >= 60) {
      const h = Math.floor(duration / 60);
      const m = duration % 60;
      return m > 0 ? `${h} h ${m} min` : `${h} h`;
    }
    return `${duration} minutos`;
  }
  const parsed = parseInt(String(duration));
  if (!isNaN(parsed)) {
    return parsed >= 60 ? `${Math.floor(parsed / 60)} h ${parsed % 60} min` : `${parsed} minutos`;
  }
  return String(duration || '30 minutos');
}

function formatCompletionDate(dateStr?: string | null): string {
  const targetDate = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(targetDate.getTime())) {
    return 'Recientemente';
  }
  try {
    const dateFormatted = targetDate.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const timeFormatted = targetDate.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${dateFormatted}, ${timeFormatted}`;
  } catch {
    return targetDate.toISOString().slice(0, 10);
  }
}

export function TaskCompletedDetailModal({
  isOpen,
  onClose,
  task,
  projectName,
  projectId,
  userPreferredTechnique,
  onFeedbackSaved,
}: TaskCompletedDetailModalProps) {
  const isMounted = useIsMounted();
  const [isPending, startTransition] = useTransition();

  const initialDuration =
    typeof task.tiempoEmpleado === 'number'
      ? task.tiempoEmpleado
      : typeof task.duration === 'number'
        ? task.duration
        : parseInt(String(task.duration)) || 30;

  const currentInitialTechnique =
    task.metodoEstudio || userPreferredTechnique || 'Técnica Pomodoro';
  const [selectedTechnique, setSelectedTechnique] = useState<string>(currentInitialTechnique);
  const [prevInitialTechnique, setPrevInitialTechnique] = useState<string>(currentInitialTechnique);

  if (prevInitialTechnique !== currentInitialTechnique) {
    setPrevInitialTechnique(currentInitialTechnique);
    setSelectedTechnique(currentInitialTechnique);
  }

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !isMounted) return null;

  const handleSelectTechnique = (techName: string) => {
    setSelectedTechnique(techName);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const res = await saveTaskStudyFeedbackAction({
          taskId: task.id,
          projectId,
          metodoEstudio: techName,
          tiempoEmpleado: initialDuration,
          tecnicaPreferida: techName,
          tecnicaSirvio: true,
        });

        if (res.success) {
          setSavedSuccess(true);
          onFeedbackSaved?.({
            metodoEstudio: techName,
            tiempoEmpleado: initialDuration,
            tecnicaSirvio: true,
            tecnicaPreferida: techName,
          });
          setTimeout(() => setSavedSuccess(false), 3500);
        } else {
          setErrorMessage(res.error || 'No se pudo guardar la técnica preferida.');
        }
      } catch (err) {
        console.error('Error saving study technique to profile:', err);
        setErrorMessage('Error de conexión al guardar.');
      }
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      {/* Contenedor del Modal: fondo 100% blanco y totalmente opaco */}
      <div
        className="w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 border-2 border-[#E8DCD1] overflow-hidden flex flex-col max-h-[92vh] bg-white"
        style={{ backgroundColor: '#ffffff', opacity: 1 }}
      >
        {/* Botón cerrar X */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
          aria-label="Cerrar modal"
        >
          <X className="size-5" />
        </button>

        {/* Encabezado */}
        <div className="mb-5 pr-8">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 shadow-2xs">
              <Check className="size-3.5" strokeWidth={3} />
              Tarea Completada
            </span>
            {projectName && (
              <span className="text-[11px] font-bold text-[#845326] bg-[#f5e5d9] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {projectName}
              </span>
            )}
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-[#2C1F14] leading-tight">
            {task.title}
          </h3>
          {task.description && (
            <p className="text-xs sm:text-sm text-gray-600 mt-1 line-clamp-2">{task.description}</p>
          )}
        </div>

        {/* Mensaje de error si falla */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl">
            {errorMessage}
          </div>
        )}

        {/* Cuerpo del recuadro con scroll si es necesario */}
        <div className="space-y-4 mb-6 overflow-y-auto pr-1">
          {/* Métricas de Tiempo y Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Tiempo Empleado */}
            <div
              className="p-3.5 rounded-2xl border border-[#E8DCD1] flex items-center gap-3 shadow-2xs"
              style={{ backgroundColor: '#FAF7F4' }}
            >
              <div className="w-10 h-10 rounded-xl bg-[#F5E5D9] text-[#845326] flex items-center justify-center shrink-0">
                <Clock className="size-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-[#845326] tracking-wider block">
                  Tiempo empleado
                </span>
                <span className="text-sm font-black text-[#2C1F14] truncate block">
                  {formatDurationText(initialDuration)}
                </span>
              </div>
            </div>

            {/* Fecha de Completación */}
            <div
              className="p-3.5 rounded-2xl border border-[#E8DCD1] flex items-center gap-3 shadow-2xs"
              style={{ backgroundColor: '#FAF7F4' }}
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Calendar className="size-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-[#845326] tracking-wider block">
                  Completada el
                </span>
                <span className="text-xs font-bold text-[#2C1F14] line-clamp-1 block">
                  {formatCompletionDate(task.completedAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Pregunta Central: Selección de técnica de estudio preferida para guardar en profiles */}
          <div
            className="p-4 sm:p-5 rounded-2xl border-2 border-[#E8DCD1] flex flex-col gap-3 shadow-sm"
            style={{ backgroundColor: '#FCF9F0' }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="size-4.5 text-[#845326] shrink-0" />
              <h4 className="text-sm sm:text-base font-bold text-[#2C1F14]">
                ¿Qué técnica de estudio te sirvió más?
              </h4>
            </div>
            <p className="text-xs text-[#845326] leading-relaxed">
              Selecciona el método con el que lograste mayor concentración. Guardaremos esta
              preferencia en tu perfil para recomendarte tus sesiones ideales.
            </p>

            {/* Lista de técnicas de estudio seleccionables */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-1">
              {STUDY_TECHNIQUES.map((tech) => {
                const isSelected = selectedTechnique === tech.name;
                return (
                  <button
                    key={tech.id}
                    type="button"
                    onClick={() => handleSelectTechnique(tech.name)}
                    disabled={isPending}
                    className={`p-3 rounded-2xl border-2 text-left transition-all flex flex-col justify-between gap-1 cursor-pointer shadow-2xs relative ${
                      isSelected
                        ? 'border-[#845326] bg-[#FAF3EC] text-[#2C1F14] ring-2 ring-[#F5E5D9]'
                        : 'border-[#E8DCD1] bg-white hover:border-[#845326]/60 hover:bg-[#FAF7F4] text-[#433022]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold line-clamp-1">{tech.name}</span>
                      {isSelected && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#845326] text-white text-[9px] font-black shrink-0">
                          <Check className="size-2.5" strokeWidth={3} />
                          Preferida
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#845326] font-medium">
                      {tech.shortDescription}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Confirmación animada de guardado */}
            {savedSuccess && (
              <div className="mt-1 flex items-center justify-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-100/80 px-3.5 py-2 rounded-xl border border-emerald-200 animate-in fade-in">
                <BookmarkCheck className="size-4 text-emerald-700 shrink-0" />
                <span>¡Técnica preferida guardada exitosamente en tu perfil!</span>
              </div>
            )}

            {isPending && (
              <div className="mt-1 flex items-center justify-center gap-2 text-xs text-[#845326]">
                <Loader2 className="size-3.5 animate-spin" />
                <span>Guardando preferencia en tu perfil...</span>
              </div>
            )}
          </div>
        </div>

        {/* Pie de modal */}
        <div className="pt-3 border-t border-[#E8DCD1]/70 flex items-center justify-between gap-3">
          <span className="text-xs text-[#845326] font-medium hidden sm:inline-block">
            Preferencia vinculada a tu cuenta de estudiante
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-[#2C1F14] hover:bg-[#433022] text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm active:scale-98 cursor-pointer ml-auto"
          >
            Listo
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
