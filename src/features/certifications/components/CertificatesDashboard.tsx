'use client';

import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Award,
  Clock,
  CheckCircle2,
  FolderKanban,
  Sparkles,
  Plus,
} from 'lucide-react';
import type { CertificatesSummary, TimeInvestmentCertificate } from '../types';
import { CertificateCard } from './CertificateCard';
import { CertificateModal } from './CertificateModal';

interface CertificatesDashboardProps {
  data: CertificatesSummary;
}

export function CertificatesDashboard({ data }: CertificatesDashboardProps) {
  const searchParams = useSearchParams();
  const targetProjectId = searchParams.get('proyectoId') || searchParams.get('id');

  const initialMatch = useMemo(() => {
    if (!targetProjectId || !data.certificates.length) return null;
    return data.certificates.find((c) => c.projectId === targetProjectId) || null;
  }, [targetProjectId, data.certificates]);

  const [activeFilter, setActiveFilter] = useState<'all' | 'completed' | 'in_progress'>('all');
  const [selectedCertificate, setSelectedCertificate] = useState<TimeInvestmentCertificate | null>(
    () => initialMatch,
  );
  const [isModalOpen, setIsModalOpen] = useState<boolean>(() => Boolean(initialMatch));

  const handleOpenCertificate = (cert: TimeInvestmentCertificate) => {
    setSelectedCertificate(cert);
    setIsModalOpen(true);
  };

  const filteredCertificates = data.certificates.filter((cert) => {
    if (activeFilter === 'completed') return cert.isFullyCompleted;
    if (activeFilter === 'in_progress') return !cert.isFullyCompleted;
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* 1. Cabecera Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/30 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded-md bg-[#FAF0DE] text-[#845326] border border-[#C68B59]/30">
              <Award className="size-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-secondary">
              Acreditación Académica
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
            Certificaciones de Inversión de Tiempo
          </h1>
          <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">
            Acredita formalmente el esfuerzo y las horas reales de estudio dedicadas a tus proyectos universitarios con diplomas verificables en PDF y PNG.
          </p>
        </div>

        {/* Certificado Global Rápido */}
        {data.globalCertificate && (
          <button
            onClick={() => handleOpenCertificate(data.globalCertificate!)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#845326] hover:bg-[#6E421D] text-white text-xs sm:text-sm font-bold shadow-xs transition-colors shrink-0"
          >
            <Award className="size-4" />
            <span>Ver Certificado Global</span>
          </button>
        )}
      </div>

      {/* 2. Tarjetas de Resumen Estadístico */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Horas Certificadas */}
        <div className="bg-surface rounded-2xl border border-outline-variant/50 p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-[#FAF0DE] text-[#845326] border border-[#C68B59]/30">
            <Clock className="size-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Tiempo Total Acreditado
            </span>
            <h3 className="text-2xl font-black text-primary mt-0.5">
              {data.totalHoursAllProjectsText}
            </h3>
            <p className="text-xs text-outline mt-0.5">
              {data.totalMinutesAllProjects} minutos de foco académico
            </p>
          </div>
        </div>

        {/* Proyectos con Acreditación */}
        <div className="bg-surface rounded-2xl border border-outline-variant/50 p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-[#EAF4EE] text-[#3D7A5A] border border-[#3D7A5A]/30">
            <CheckCircle2 className="size-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Proyectos Acreditados
            </span>
            <h3 className="text-2xl font-black text-primary mt-0.5">
              {data.totalCompletedProjects} de {data.totalActiveProjects}
            </h3>
            <p className="text-xs text-outline mt-0.5">
              {data.totalCompletedProjects} culminados al 100%
            </p>
          </div>
        </div>

        {/* Tareas Universitarias Superadas */}
        <div className="bg-surface rounded-2xl border border-outline-variant/50 p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-[#FBECE9] text-[#B84A39] border border-[#B84A39]/30">
            <FolderKanban className="size-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Tareas Cumplidas
            </span>
            <h3 className="text-2xl font-black text-primary mt-0.5">
              {data.totalTasksCompleted}
            </h3>
            <p className="text-xs text-outline mt-0.5">
              Hitos ejecutados en el cronograma
            </p>
          </div>
        </div>
      </div>

      {/* 3. Banner Destacado: Certificación Global Acumulativa */}
      {data.globalCertificate && (
        <div className="relative overflow-hidden rounded-2xl border border-[#C68B59]/40 bg-gradient-to-br from-[#FFFDF9] via-[#FAF3EB] to-[#F5E8E0] p-6 sm:p-8 shadow-xs">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF0DE] border border-[#C68B59]/30 text-[#845326] text-xs font-bold">
                <Sparkles className="size-3.5" />
                <span>Trayectoria Universitaria Consolidada</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-primary">
                Certificación Integral de Inversión Académica
              </h2>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Este diploma certifica formalmente la sumatoria de todas las horas dedicadas a lo largo de tu historial en Komorebi Study Studio ({data.totalHoursAllProjectsText}), reflejando constancia, autogestión y excelencia académica.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
              <button
                onClick={() => handleOpenCertificate(data.globalCertificate!)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#845326] hover:bg-[#6E421D] text-white font-bold text-sm shadow-md transition-all hover:scale-102"
              >
                <Award className="size-4" />
                <span>Abrir Diploma Oficial</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Listado de Certificados por Proyecto con Filtros */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-primary">
              Certificados por Proyecto
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
              {filteredCertificates.length}
            </span>
          </div>

          {/* Filtros de estado */}
          <div className="flex items-center gap-1.5 p-1 bg-surface-container rounded-xl border border-outline-variant/30 self-start sm:self-auto">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                activeFilter === 'all'
                  ? 'bg-surface text-primary shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              Todos ({data.certificates.length})
            </button>
            <button
              onClick={() => setActiveFilter('completed')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                activeFilter === 'completed'
                  ? 'bg-surface text-[#3D7A5A] shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              Completados ({data.totalCompletedProjects})
            </button>
            <button
              onClick={() => setActiveFilter('in_progress')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                activeFilter === 'in_progress'
                  ? 'bg-surface text-[#845326] shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              En Curso ({data.certificates.length - data.totalCompletedProjects})
            </button>
          </div>
        </div>

        {filteredCertificates.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-outline-variant/40 p-8 text-center space-y-3">
            <Award className="size-12 text-outline mx-auto" />
            <h3 className="font-bold text-base text-primary">
              No hay certificados disponibles en esta categoría
            </h3>
            <p className="text-xs text-on-surface-variant max-w-md mx-auto">
              A medida que crees proyectos de estudio y completes tareas en tu cronograma diario, tus certificaciones de tiempo invertido se generarán automáticamente aquí.
            </p>
            <div className="pt-2">
              <Link
                href="/proyectos/nuevo"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-white text-xs font-bold hover:bg-secondary/90 transition-colors"
              >
                <Plus className="size-3.5" />
                <span>Crear un nuevo proyecto</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCertificates.map((cert) => (
              <CertificateCard
                key={cert.id}
                certificate={cert}
                onViewCertificate={handleOpenCertificate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal de Previsualización y Exportación */}
      <CertificateModal
        certificate={selectedCertificate}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
