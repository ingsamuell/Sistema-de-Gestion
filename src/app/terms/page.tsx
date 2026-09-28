import type { Metadata } from 'next';
import { AlertTriangle, FileText, GraduationCap, Lightbulb, ShieldCheck } from 'lucide-react';
import { LegalDocumentBody } from '@/components/legal/LegalDocumentBody';
import { termsDocument, type LegalDocumentSection } from '@/components/legal/legalDocumentData';
import { LegalPageLayout, type LegalSectionItem } from '@/components/legal/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Términos de uso académico | Komorebi Study Studio',
  description: 'Condiciones de uso del prototipo académico Komorebi Study Studio.',
};

const sections: LegalSectionItem[] = termsDocument.sections.map(toSectionItem);

const highlights = [
  {
    icon: <GraduationCap className="h-5 w-5" />,
    title: 'Propósito académico',
    description: 'Komorebi es una entrega de aprendizaje y demostración.',
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: 'Uso responsable',
    description: 'Protege tu cuenta y no compartas datos sensibles.',
  },
  {
    icon: <Lightbulb className="h-5 w-5" />,
    title: 'Funciones en evolución',
    description: 'Las funciones pueden cambiar durante el desarrollo.',
  },
  {
    icon: <AlertTriangle className="h-5 w-5" />,
    title: 'Sin decisiones críticas',
    description: 'No sustituye orientación profesional o institucional.',
  },
];

export default function TermsPage() {
  return (
    <LegalPageLayout
      currentPage="terms"
      badgeText="Documento informativo"
      badgeIcon={<FileText className="h-4 w-4" />}
      title="Términos de uso académico"
      subtitle="Reglas claras y realistas para explorar este prototipo estudiantil."
      lastUpdated="27 de septiembre de 2026"
      readingTime="3 minutos de lectura"
      sections={sections}
      highlights={highlights}
    >
      <LegalDocumentBody document={termsDocument} />
    </LegalPageLayout>
  );
}

function toSectionItem(section: LegalDocumentSection, index: number): LegalSectionItem {
  return {
    id: section.id,
    number: String(index + 1),
    title: section.title,
  };
}
