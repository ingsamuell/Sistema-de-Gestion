import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Award, ArrowLeft } from 'lucide-react';
import {
  CertificadosGallery,
  CertificadoViewItem,
} from '@/features/certifications/components/CertificadosGallery';

export const metadata: Metadata = {
  title: 'Mis Certificaciones | Komorebi',
  description: 'Galería de certificados emitidos por tu inversión de tiempo y logros académicos.',
};

export default async function CertificacionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  type CertRecord = {
    id: string;
    hash_sha256: string;
    numero_certificado?: string | null;
    fecha_emision: string;
    horas_invertidas: number;
    temas_aprobados: number;
    project_id: string;
  };

  let certs: CertRecord[] | null = null;

  const primaryQuery = await supabase
    .from('certificados_emitidos')
    .select(
      'id, hash_sha256, numero_certificado, fecha_emision, horas_invertidas, temas_aprobados, project_id',
    )
    .eq('profile_id', user.id)
    .order('fecha_emision', { ascending: false });

  if (!primaryQuery.error && primaryQuery.data) {
    certs = primaryQuery.data as CertRecord[];
  } else {
    const fallback = await supabase
      .from('certificados_emitidos')
      .select('id, hash_sha256, fecha_emision, horas_invertidas, temas_aprobados, project_id')
      .eq('profile_id', user.id)
      .order('fecha_emision', { ascending: false });
    certs = (fallback.data ?? []) as CertRecord[];
  }

  // Obtener nombres de proyectos desde la tabla 'projects'
  const projectIds = Array.from(new Set((certs || []).map((c) => c.project_id).filter(Boolean)));
  let projectsMap: Record<string, string> = {};

  if (projectIds.length > 0) {
    const { data: projs } = await supabase
      .from('projects')
      .select('id, titulo')
      .in('id', projectIds);

    if (projs) {
      projectsMap = Object.fromEntries(projs.map((p) => [p.id, p.titulo]));
    }
  }

  const certificados: CertificadoViewItem[] = (certs || []).map(
    (c: {
      id: string;
      hash_sha256: string;
      numero_certificado?: string | null;
      fecha_emision: string;
      horas_invertidas: number;
      temas_aprobados: number;
      project_id: string;
    }) => ({
      id: c.id,
      hash_sha256: c.hash_sha256,
      numero_certificado:
        c.numero_certificado ||
        `KMB-${new Date(c.fecha_emision).getFullYear()}-${c.hash_sha256.substring(0, 4).toUpperCase()}-${c.hash_sha256.substring(4, 8).toUpperCase()}`,
      fecha_emision: c.fecha_emision,
      horas_invertidas: Number(c.horas_invertidas) || 1,
      temas_aprobados: Number(c.temas_aprobados) || 1,
      project_id: c.project_id,
      tituloProyecto: projectsMap[c.project_id] || 'Proyecto Académico',
    }),
  );

  return (
    <div className="flex flex-col min-h-full pb-20 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <header className="mb-8 flex items-center gap-4">
        <Link
          href="/perfil"
          className="p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant hover:text-on-surface"
          title="Volver al Perfil"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#2C1F14] flex items-center gap-2">
            <Award className="size-8 text-primary" />
            Mis Certificaciones
          </h1>
          <p className="text-on-surface-variant">
            Galería de tus logros validados criptográficamente en Komorebi.
          </p>
        </div>
      </header>

      {certificados.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-3xl p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Award className="size-8 text-primary/60" />
          </div>
          <h2 className="text-xl font-bold text-on-surface mb-2">Aún no tienes certificaciones</h2>
          <p className="text-on-surface-variant max-w-md mx-auto mb-6">
            Completa todas las tareas de un proyecto al 100% y aprueba el cuestionario de evaluación
            para obtener tu primer certificado de inversión de tiempo.
          </p>
          <Link
            href="/proyectos"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-sm hover:shadow"
          >
            Ir a mis proyectos
          </Link>
        </div>
      ) : (
        <CertificadosGallery certificados={certificados} />
      )}
    </div>
  );
}
