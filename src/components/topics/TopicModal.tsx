'use client';

import React, { useState } from 'react';
import { X, BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { Locale } from '@/lib/i18n/locale';

interface TopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, description: string) => Promise<void>;
  initialTitle?: string;
  initialDescription?: string;
  isEditing?: boolean;
  locale?: Locale;
}

export function TopicModal({
  isOpen,
  onClose,
  onSubmit,
  initialTitle = '',
  initialDescription = '',
  isEditing = false,
  locale = 'es',
}: TopicModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <TopicModalContent
        key={`${isEditing ? 'edit' : 'new'}-${initialTitle}`}
        onClose={onClose}
        onSubmit={onSubmit}
        initialTitle={initialTitle}
        initialDescription={initialDescription}
        isEditing={isEditing}
        locale={locale}
      />
    </div>
  );
}

interface TopicModalContentProps {
  onClose: () => void;
  onSubmit: (title: string, description: string) => Promise<void>;
  initialTitle: string;
  initialDescription: string;
  isEditing: boolean;
  locale: Locale;
}

function TopicModalContent({
  onClose,
  onSubmit,
  initialTitle,
  initialDescription,
  isEditing,
  locale,
}: TopicModalContentProps) {
  const copy =
    locale === 'es'
      ? {
          required: 'El título del tema es requerido.',
          unexpected: 'Ocurrió un error',
          edit: 'Editar Tema',
          create: 'Nuevo Tema de Estudio',
          title: 'Título del tema',
          titlePlaceholder: 'Ej: Programación Backend y APIs',
          description: 'Descripción o enfoque',
          descriptionPlaceholder: 'Ej: Fundamentos, buenas prácticas y arquitectura...',
          cancel: 'Cancelar',
          save: 'Guardar Cambios',
          createButton: 'Crear Tema',
        }
      : {
          required: 'A topic title is required.',
          unexpected: 'Something went wrong',
          edit: 'Edit topic',
          create: 'New study topic',
          title: 'Topic title',
          titlePlaceholder: 'E.g. Backend programming and APIs',
          description: 'Description or focus',
          descriptionPlaceholder: 'E.g. Fundamentals, best practices, and architecture...',
          cancel: 'Cancel',
          save: 'Save changes',
          createButton: 'Create topic',
        };
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError(copy.required);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await onSubmit(cleanTitle, description.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unexpected);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-lg rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-2xl">
      <div className="flex items-center justify-between border-b border-outline-variant/30 pb-4">
        <div className="flex items-center gap-2 text-primary font-bold">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookOpen className="size-4" />
          </div>
          <span>{isEditing ? copy.edit : copy.create}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-lg text-outline hover:bg-surface-container-low transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {error && (
          <div className="p-3 text-xs rounded-xl bg-error/10 border border-error/20 text-error font-medium">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-on-surface mb-1.5">
            {copy.title} <span className="text-error">*</span>
          </label>
          <input
            type="text"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={copy.titlePlaceholder}
            className="w-full rounded-xl border border-outline-variant/70 bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/10"
            maxLength={100}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-on-surface mb-1.5">
            {copy.description}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={copy.descriptionPlaceholder}
            rows={3}
            className="w-full rounded-xl border border-outline-variant/70 bg-surface p-3.5 text-sm outline-none transition-colors placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/10 resize-none"
            maxLength={300}
          />
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/30">
          <Button type="button" variant="secondary" size="sm" disabled={loading} onClick={onClose}>
            {copy.cancel}
          </Button>
          <Button type="submit" size="sm" disabled={loading || !title.trim()} className="gap-2">
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            {isEditing ? copy.save : copy.createButton}
          </Button>
        </div>
      </form>
    </div>
  );
}
