'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { X, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { defaultLocale, getLocaleFromPathname } from '@/lib/i18n/locale';

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, content: string) => Promise<void>;
}

export function NoteModal({ isOpen, onClose, onSubmit }: NoteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <NoteModalContent key="note-content" onClose={onClose} onSubmit={onSubmit} />
    </div>
  );
}

interface NoteModalContentProps {
  onClose: () => void;
  onSubmit: (title: string, content: string) => Promise<void>;
}

function NoteModalContent({ onClose, onSubmit }: NoteModalContentProps) {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname) ?? defaultLocale;
  const copy =
    locale === 'es'
      ? {
          required: 'El título de la nota es obligatorio.',
          error: 'Error al guardar la nota',
          heading: 'Escribir nota de fuente',
          title: 'Título de la nota',
          titlePlaceholder: 'Ej: Mapa de conceptos, resumen de clase...',
          content: 'Contenido de la nota',
          contentPlaceholder: 'Escribe aquí los puntos clave, explicaciones o referencias...',
          cancel: 'Cancelar',
          save: 'Guardar nota',
        }
      : {
          required: 'A note title is required.',
          error: 'Could not save the note',
          heading: 'Write source note',
          title: 'Note title',
          titlePlaceholder: 'E.g. Concept map, class summary...',
          content: 'Note content',
          contentPlaceholder: 'Write key points, explanations, or references here...',
          cancel: 'Cancel',
          save: 'Save note',
        };
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
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
      await onSubmit(cleanTitle, content.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-lg rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-2xl">
      <div className="flex items-center justify-between border-b border-outline-variant/30 pb-4">
        <div className="flex items-center gap-2 text-primary font-bold">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="size-4" />
          </div>
          <span>{copy.heading}</span>
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
            {copy.content}
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={copy.contentPlaceholder}
            rows={5}
            className="w-full rounded-xl border border-outline-variant/70 bg-surface p-3.5 text-sm outline-none transition-colors placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/10 resize-y"
          />
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/30">
          <Button type="button" variant="secondary" size="sm" disabled={loading} onClick={onClose}>
            {copy.cancel}
          </Button>
          <Button type="submit" size="sm" disabled={loading || !title.trim()} className="gap-2">
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            {copy.save}
          </Button>
        </div>
      </form>
    </div>
  );
}
