'use client';

import React, { useState } from 'react';
import { X, Calendar, AlertCircle, Loader2, Save } from 'lucide-react';
import { updateProjectAction } from '@/features/proyectos/actions/proyectoActions';
import { usePathname } from 'next/navigation';
import { defaultLocale, getLocaleFromPathname } from '@/lib/i18n/locale';

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: {
    id: string;
    title: string;
    objective?: string;
    fecha_limite?: string | null;
  };
  onSuccess: (updated: {
    id: string;
    title: string;
    objective?: string;
    fecha_limite?: string | null;
  }) => void;
}

export function EditProjectModal({ isOpen, onClose, project, onSuccess }: EditProjectModalProps) {
  const locale = getLocaleFromPathname(usePathname()) ?? defaultLocale;
  const copy =
    locale === 'es'
      ? {
          close: 'Cerrar modal',
          title: 'Editar Proyecto',
          description: 'Modifica el nombre, descripción y fecha límite de tu proyecto.',
          name: 'Nombre del proyecto',
          nameHint: 'Ej. Curso de Inteligencia Artificial',
          maximum: 'Máximo',
          characters: 'caracteres',
          objective: 'Descripción u objetivo',
          objectiveHint: 'Describe la meta final de este proyecto...',
          deadline: 'Fecha límite',
          deadlineHint: `Límite permitido hasta 10 años desde el año actual`,
          cancel: 'Cancelar',
          saving: 'Guardando...',
          save: 'Guardar Cambios',
          updateError: 'Error al actualizar el proyecto.',
          connectionError: 'Error inesperado al conectar con el servidor.',
        }
      : {
          close: 'Close modal',
          title: 'Edit project',
          description: 'Update your project’s name, description, and deadline.',
          name: 'Project name',
          nameHint: 'For example, Artificial Intelligence course',
          maximum: 'Maximum',
          characters: 'characters',
          objective: 'Description or objective',
          objectiveHint: 'Describe this project’s final goal...',
          deadline: 'Deadline',
          deadlineHint: 'Deadline allowed up to 10 years from the current year',
          cancel: 'Cancel',
          saving: 'Saving...',
          save: 'Save changes',
          updateError: 'Could not update the project.',
          connectionError: 'Unexpected error connecting to the server.',
        };
  const currentYear = new Date().getFullYear();
  const maxYear = currentYear + 10;
  const todayStr = new Date().toISOString().split('T')[0];
  const maxDateStr = `${maxYear}-12-31`;

  const initialDateStr = project.fecha_limite ? project.fecha_limite.split('T')[0] : '';

  const [title, setTitle] = useState(project.title || '');
  const [objective, setObjective] = useState(project.objective || '');
  const [deadline, setDeadline] = useState(initialDateStr);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await updateProjectAction({
        id: project.id,
        titulo: title.trim(),
        objetivo: objective.trim(),
        fecha_limite: deadline || null,
      });

      if (res.success && res.project) {
        onSuccess({
          id: project.id,
          title: res.project.titulo,
          objective: res.project.objetivo || '',
          fecha_limite: res.project.fecha_limite || null,
        });
        window.dispatchEvent(new Event('projects_updated'));
        onClose();
      } else {
        setErrorMessage(res.error || copy.updateError);
      }
    } catch (err: unknown) {
      console.error('Error al actualizar proyecto:', err);
      const msg = err instanceof Error ? err.message : copy.connectionError;
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl relative animate-in zoom-in-95 duration-200 border border-[#E8DCD1]">
        {/* Botón cerrar */}
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer disabled:opacity-50"
          aria-label={copy.close}
        >
          <X className="size-5" />
        </button>

        <h2 className="text-xl sm:text-2xl font-bold text-[#2C1F14] mb-1">{copy.title}</h2>
        <p className="text-xs sm:text-sm text-[#845326] mb-6">{copy.description}</p>

        {errorMessage && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm rounded-xl flex items-start gap-2.5">
            <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Nombre del Proyecto */}
          <div>
            <label htmlFor="projectTitle" className="block text-sm font-bold text-[#2C1F14] mb-1.5">
              {copy.name} <span className="text-red-500">*</span>
            </label>
            <input
              id="projectTitle"
              type="text"
              required
              maxLength={50}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={copy.nameHint}
              className="w-full px-4 py-3 rounded-xl border border-[#E2D9D0] bg-[#FAF8F5] text-[#2C1F14] focus:bg-white focus:border-[#845326] focus:ring-2 focus:ring-[#845326]/20 outline-none text-sm transition-all"
            />
            <div className="flex justify-between items-center mt-1 text-xs text-[#845326]/80 font-medium">
              <span>
                {copy.maximum} 50 {copy.characters}
              </span>
              <span>{title.length}/50</span>
            </div>
          </div>

          {/* Objetivo / Descripción */}
          <div>
            <label
              htmlFor="projectObjective"
              className="block text-sm font-bold text-[#2C1F14] mb-1.5"
            >
              {copy.objective}
            </label>
            <textarea
              id="projectObjective"
              rows={3}
              maxLength={250}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder={copy.objectiveHint}
              className="w-full px-4 py-3 rounded-xl border border-[#E2D9D0] bg-[#FAF8F5] text-[#2C1F14] focus:bg-white focus:border-[#845326] focus:ring-2 focus:ring-[#845326]/20 outline-none text-sm transition-all resize-none"
            />
            <div className="flex justify-between items-center mt-1 text-xs text-[#845326]/80 font-medium">
              <span>
                {copy.maximum} 250 {copy.characters}
              </span>
              <span>{objective.length}/250</span>
            </div>
          </div>

          {/* Fecha Límite */}
          <div>
            <label
              htmlFor="projectDeadline"
              className="block text-sm font-bold text-[#2C1F14] mb-1.5"
            >
              {copy.deadline}
            </label>
            <div className="relative">
              <input
                id="projectDeadline"
                type="date"
                min={todayStr}
                max={maxDateStr}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#E2D9D0] bg-[#FAF8F5] text-[#2C1F14] focus:bg-white focus:border-[#845326] focus:ring-2 focus:ring-[#845326]/20 outline-none text-sm transition-all"
              />
            </div>
            <p className="mt-1 text-xs text-[#845326]/80 font-medium flex items-center gap-1">
              <Calendar className="size-3" />
              {copy.deadlineHint} ({maxYear}).
            </p>
          </div>

          {/* Botones de acción */}
          <div className="mt-4 flex items-center justify-end gap-3 pt-4 border-t border-[#E8DCD1]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl border border-[#E2D9D0] text-sm font-semibold text-[#845326] hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              {copy.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#845326] hover:bg-[#6b421d] text-white text-sm font-bold shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>{copy.saving}</span>
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  <span>{copy.save}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
