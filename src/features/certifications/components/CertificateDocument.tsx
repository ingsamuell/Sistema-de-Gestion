'use client';

import React from 'react';
import { Award, ShieldCheck, Clock, Calendar, Check } from 'lucide-react';
import type { TimeInvestmentCertificate } from '../types';

interface CertificateDocumentProps {
  certificate: TimeInvestmentCertificate;
  id?: string;
  className?: string;
}

export function CertificateDocument({
  certificate,
  id = 'certificate-printable-document',
  className = '',
}: CertificateDocumentProps) {
  return (
    <div
      id={id}
      className={`relative w-[842px] h-[595px] p-8 box-border select-none overflow-hidden font-sans text-[#221A13] flex flex-col justify-between ${className}`}
      style={{
        backgroundColor: '#FFFDF9',
        backgroundImage:
          'radial-gradient(circle at 50% 50%, #FFFDF9 0%, #FAF3EB 100%)',
      }}
    >
      {/* Marco Exterior Decorativo */}
      <div className="absolute inset-4 pointer-events-none border-2 border-[#C68B59]/40 rounded-xl" />

      {/* Marco Interior con Doble Línea y Esquinas Ornamentales */}
      <div className="absolute inset-6 pointer-events-none border border-[#845326]/30 rounded-lg">
        {/* Esquinas ornamentales */}
        <div className="absolute -top-1.5 -left-1.5 size-4 border-t-2 border-l-2 border-[#845326]" />
        <div className="absolute -top-1.5 -right-1.5 size-4 border-t-2 border-r-2 border-[#845326]" />
        <div className="absolute -bottom-1.5 -left-1.5 size-4 border-b-2 border-l-2 border-[#845326]" />
        <div className="absolute -bottom-1.5 -right-1.5 size-4 border-b-2 border-r-2 border-[#845326]" />
      </div>

      {/* Marca de agua de fondo */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
        <Award className="size-[420px] text-[#845326]" />
      </div>

      {/* 1. Encabezado Institucional */}
      <div className="relative z-10 text-center pt-2">
        <div className="inline-flex items-center gap-2.5 px-3.5 py-1 rounded-full bg-[#845326]/10 border border-[#845326]/20 mb-2">
          <Award className="size-4 text-[#845326]" />
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#845326]">
            Komorebi Study Studio • Acreditación Académica
          </span>
        </div>

        <h1 className="text-2xl font-black uppercase tracking-[0.15em] text-[#322011] font-serif">
          Certificado de Inversión de Tiempo
        </h1>
        <p className="text-[11px] text-[#81756D] tracking-wider uppercase mt-0.5">
          Constancia Oficial de Dedicación y Cumplimiento de Metas
        </p>
      </div>

      {/* 2. Cuerpo Central del Certificado */}
      <div className="relative z-10 text-center my-auto px-12">
        <p className="text-xs italic text-[#4F453E] mb-2 font-serif">
          Por cuanto se hace constar oficialmente que el/la estudiante
        </p>

        {/* Nombre del estudiante */}
        <div className="relative inline-block mb-3">
          <h2 className="text-3xl font-extrabold text-[#322011] tracking-tight font-serif px-6 py-0.5">
            {certificate.studentName}
          </h2>
          <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#C68B59] to-transparent mt-1" />
        </div>

        <p className="text-xs text-[#4F453E] max-w-xl mx-auto leading-relaxed">
          Ha dedicado y completado con disciplina un tiempo efectivo de foco y estudio de:
        </p>

        {/* Destacado de Horas Invertidas */}
        <div className="inline-flex items-center gap-3 bg-[#FAF0DE] border border-[#C68B59]/40 rounded-xl px-5 py-2 my-2.5 shadow-xs">
          <Clock className="size-5 text-[#845326]" />
          <span className="text-xl font-black text-[#845326] tracking-tight">
            {certificate.totalHoursText}
          </span>
          <span className="text-xs font-semibold text-[#81756D] uppercase tracking-wider pl-2 border-l border-[#C68B59]/30">
            {certificate.totalTasksCompleted} {certificate.totalTasksCompleted === 1 ? 'tarea realizada' : 'tareas realizadas'}
          </span>
        </div>

        <p className="text-xs text-[#4F453E]">
          {certificate.type === 'project' ? (
            <>
              Aplicadas con éxito en el desarrollo del proyecto académico:{' '}
              <strong className="text-[#322011] font-bold">&quot;{certificate.title}&quot;</strong>
            </>
          ) : (
            <>
              Acumuladas a lo largo de su trayectoria formativa en la plataforma en múltiples proyectos y competencias académicas.
            </>
          )}
        </p>

        {/* Competencias o hitos destacados */}
        {certificate.competencies && certificate.competencies.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 max-w-2xl mx-auto">
            {certificate.competencies.slice(0, 4).map((comp, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 text-[10px] font-medium bg-[#FFFDF9] border border-[#D2C4BB]/60 text-[#4F453E] px-2.5 py-0.5 rounded-md"
              >
                <Check className="size-3 text-[#3D7A5A]" />
                {comp}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 3. Pie del Certificado: Validación, Sellos y Firmas */}
      <div className="relative z-10 pt-2 border-t border-[#D2C4BB]/40 grid grid-cols-3 items-end px-4">
        {/* Metadatos y Validación */}
        <div className="text-left space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] text-[#4F453E]">
            <Calendar className="size-3 text-[#845326]" />
            <span>Fecha de Emisión: <strong>{certificate.formattedIssueDate}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-[#4F453E]">
            <ShieldCheck className="size-3 text-[#3D7A5A]" />
            <span>Código de Validación:</span>
          </div>
          <p className="font-mono text-[9px] font-bold tracking-wider text-[#845326] bg-[#845326]/10 px-2 py-0.5 rounded inline-block">
            {certificate.verificationCode}
          </p>
        </div>

        {/* Sello Oficial Central */}
        <div className="flex flex-col items-center justify-center">
          <div className="size-16 rounded-full border-2 border-dashed border-[#C68B59] bg-[#FFF8F4] flex flex-col items-center justify-center p-1 shadow-inner text-center">
            <Award className="size-5 text-[#845326] mb-0.5" />
            <span className="text-[7px] font-black uppercase tracking-tighter text-[#845326] leading-none">
              KOMOREBI
            </span>
            <span className="text-[6px] font-semibold text-[#81756D] leading-none mt-0.5">
              VERIFICADO
            </span>
          </div>
        </div>

        {/* Firma Oficial */}
        <div className="text-right flex flex-col items-end">
          <div className="w-36 border-b border-[#322011]/40 pb-0.5 text-center">
            <span className="font-serif italic text-xs text-[#322011]">
              Comité Académico
            </span>
          </div>
          <p className="text-[9px] font-bold text-[#322011] mt-1">
            Komorebi Study Studio
          </p>
          <p className="text-[8px] text-[#81756D] uppercase tracking-wider">
            Dirección de Productividad
          </p>
        </div>
      </div>
    </div>
  );
}
