import type { Metadata } from 'next';
import { FolderOpen, ShieldCheck, SlidersHorizontal, UserCheck } from 'lucide-react';
import { LegalDocumentBody } from '@/components/legal/LegalDocumentBody';
import { privacyDocument, type LegalDocumentSection } from '@/components/legal/legalDocumentData';
import { LegalPageLayout, type LegalSectionItem } from '@/components/legal/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Aviso de privacidad académico | Komorebi Study Studio',
  description:
    'Información sobre el tratamiento de datos en el prototipo académico Komorebi Study Studio.',
};

const sections: LegalSectionItem[] = privacyDocument.sections.map(toSectionItem);

const highlights = [
  {
    icon: <UserCheck className="h-5 w-5" />,
    title: 'Datos para tu cuenta',
    description: 'Usamos información básica para permitir el acceso.',
  },
  {
    icon: <FolderOpen className="h-5 w-5" />,
    title: 'Tu información de estudio',
    description: 'Las tareas y proyectos sirven para las funciones elegidas.',
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    title: 'Sin venta de datos',
    description: 'No comercializamos la información registrada en el prototipo.',
  },
  {
    icon: <SlidersHorizontal className="h-5 w-5" />,
    title: 'Control y cambios',
    description: 'Las prácticas pueden ajustarse durante el desarrollo académico.',
  },
];

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      currentPage="privacy"
      badgeText="Documento informativo"
      badgeIcon={<ShieldCheck className="h-4 w-4" />}
      title="Aviso de privacidad académico"
      subtitle="Cómo se utiliza la información dentro de este prototipo estudiantil."
      lastUpdated="27 de septiembre de 2026"
      readingTime="3 minutos de lectura"
      sections={sections}
      highlights={highlights}
    >
      <LegalDocumentBody document={privacyDocument} />
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
