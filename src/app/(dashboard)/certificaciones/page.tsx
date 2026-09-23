import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCertificatesData } from '@/features/certifications/data/getCertificatesData';
import { CertificatesDashboard } from '@/features/certifications/components/CertificatesDashboard';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Certificaciones de Inversión de Tiempo | Komorebi Study Studio',
  description:
    'Acreditación oficial y certificados verificables de horas y tiempo invertido en proyectos académicos.',
};

export default async function CertificacionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const data = await getCertificatesData();

  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[350px] gap-3 text-secondary">
          <Loader2 className="size-8 animate-spin" />
          <p className="text-sm font-semibold">Generando acreditaciones académicas...</p>
        </div>
      }
    >
      <CertificatesDashboard data={data} />
    </Suspense>
  );
}
