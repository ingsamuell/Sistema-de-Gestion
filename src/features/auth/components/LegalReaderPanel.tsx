'use client';

import { useState } from 'react';
import { ChevronDown, FileText, ShieldCheck } from 'lucide-react';
import { LegalDocumentBody } from '@/components/legal/LegalDocumentBody';
import { privacyDocument, termsDocument } from '@/components/legal/legalDocumentData';

type LegalTab = 'terms' | 'privacy';

export function LegalReaderPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<LegalTab>('terms');

  const activeDocument = activeTab === 'terms' ? termsDocument : privacyDocument;

  return (
    <section className="rounded-2xl border border-primary/15 bg-surface-container-lowest/70 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 shrink-0 rounded-xl bg-primary/10 p-2 text-primary">
            <FileText className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-on-surface">
              Revisa antes de crear tu cuenta
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
              Consulta los términos de uso y el aviso de privacidad sin salir del registro.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          aria-expanded={isOpen}
          aria-controls="register-legal-reader"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {isOpen ? 'Ocultar' : 'Leer aquí'}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div
          className="flex rounded-xl bg-surface-container p-1"
          role="tablist"
          aria-label="Documento legal"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'terms'}
            onClick={() => setActiveTab('terms')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'terms'
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Términos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'privacy'}
            onClick={() => setActiveTab('privacy')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'privacy'
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Privacidad
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          id="register-legal-reader"
          role="tabpanel"
          className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-outline-variant/25 bg-surface/80 p-4 pr-3"
        >
          <div className="mb-4 flex items-center gap-2 text-primary">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <p className="text-xs font-semibold">{activeDocument.title}</p>
          </div>
          <LegalDocumentBody
            document={activeDocument}
            compact
            idPrefix={`register-${activeTab}-`}
          />
        </div>
      )}
    </section>
  );
}
