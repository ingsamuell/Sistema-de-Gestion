'use client';

import React from 'react';
import { Award, Clock, CheckCircle2, ChevronRight, Check } from 'lucide-react';
import type { TimeInvestmentCertificate } from '../types';

interface CertificateCardProps {
  certificate: TimeInvestmentCertificate;
  onViewCertificate: (cert: TimeInvestmentCertificate) => void;
}

export function CertificateCard({ certificate, onViewCertificate }: CertificateCardProps) {
  const isGlobal = certificate.type === 'global';

  return (
    <div className="relative group bg-surface rounded-2xl border border-outline-variant/60 p-5 hover:border-[#C68B59] hover:shadow-md transition-all duration-200 flex flex-col justify-between">
      {/* Indicador superior */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl border ${
                isGlobal
                  ? 'bg-[#FAF0DE] text-[#845326] border-[#C68B59]/40'
                  : certificate.isFullyCompleted
                    ? 'bg-[#EAF4EE] text-[#3D7A5A] border-[#3D7A5A]/30'
                    : 'bg-[#FFF8F4] text-[#845326] border-[#C68B59]/30'
              }`}
            >
              <Award className="size-5" />
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant">
                {isGlobal ? 'Acreditación Global' : 'Certificación de Proyecto'}
              </span>
              <h3 className="font-bold text-base text-primary leading-snug line-clamp-1 group-hover:text-secondary transition-colors">
                {certificate.title}
              </h3>
            </div>
          </div>

          {/* Badge de Estado */}
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${
              certificate.isFullyCompleted
                ? 'bg-[#EAF4EE] text-[#3D7A5A] border border-[#3D7A5A]/30'
                : 'bg-[#FAF0DE] text-[#845326] border border-[#C68B59]/30'
            }`}
          >
            {certificate.isFullyCompleted ? (
              <>
                <CheckCircle2 className="size-3" />
                <span>Completado</span>
              </>
            ) : (
              <>
                <Clock className="size-3" />
                <span>{certificate.progressPercent}% Avance</span>
              </>
            )}
          </span>
        </div>

        {/* Métricas destacadas: Horas y Tareas */}
        <div className="grid grid-cols-2 gap-2 my-3 p-3 rounded-xl bg-surface-container/60 border border-outline-variant/30">
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase font-medium">
              Tiempo Invertido
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Clock className="size-4 text-[#845326]" />
              <span className="font-bold text-sm text-primary">
                {certificate.totalHoursText}
              </span>
            </div>
          </div>

          <div>
            <span className="text-[10px] text-on-surface-variant uppercase font-medium">
              Tareas Acreditadas
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Check className="size-4 text-status-success" />
              <span className="font-bold text-sm text-primary">
                {certificate.totalTasksCompleted} de {certificate.totalTasksPlanned || certificate.totalTasksCompleted}
              </span>
            </div>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="w-full bg-outline-variant/30 rounded-full h-1.5 mb-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              certificate.isFullyCompleted ? 'bg-[#3D7A5A]' : 'bg-[#C68B59]'
            }`}
            style={{ width: `${Math.min(100, Math.max(5, certificate.progressPercent))}%` }}
          />
        </div>

        {/* Competencias preview */}
        {certificate.competencies && certificate.competencies.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {certificate.competencies.slice(0, 2).map((comp, idx) => (
              <span
                key={idx}
                className="text-[10px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-md border border-outline-variant/20 line-clamp-1"
              >
                {comp}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Botón de acción */}
      <div className="pt-2 border-t border-outline-variant/30 flex items-center justify-between">
        <span className="text-[10px] font-mono text-outline">
          {certificate.verificationCode}
        </span>

        <button
          onClick={() => onViewCertificate(certificate)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-secondary hover:text-primary transition-colors py-1 px-2.5 rounded-lg hover:bg-surface-container"
        >
          <span>Ver Certificado</span>
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
