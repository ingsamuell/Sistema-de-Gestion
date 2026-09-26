'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Award, Calendar, Clock, CheckCircle, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CertificateModal } from '@/features/certifications/components/CertificateModal';

export interface CertificadoViewItem {
  id: string;
  hash_sha256: string;
  numero_certificado?: string;
  fecha_emision: string;
  horas_invertidas: number;
  temas_aprobados: number;
  project_id: string;
  tituloProyecto: string;
}

interface CertificadosGalleryProps {
  certificados: CertificadoViewItem[];
}

export function CertificadosGallery({ certificados }: CertificadosGalleryProps) {
  const [selectedHash, setSelectedHash] = useState<string | null>(null);

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        {certificados.map((cert) => (
          <div
            key={cert.id}
            className="relative group bg-white border border-[#EAE3DC] rounded-[24px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 flex flex-col justify-between"
          >
            {/* Cabecera visual del certificado */}
            <div className="h-[120px] bg-[linear-gradient(135deg,#D8C4E0_0%,#E8B4B8_100%)] p-6 relative flex flex-col justify-end">
              <div className="absolute top-4 right-4 bg-white/40 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-[#845326] flex items-center gap-1.5 shadow-xs">
                <CheckCircle className="size-3.5 text-emerald-700" />
                <span>Certificado Verificado</span>
              </div>
              <h3 className="text-2xl font-black text-[#2C1F14] leading-tight line-clamp-1 drop-shadow-sm">
                {cert.tituloProyecto}
              </h3>
            </div>

            {/* Cuerpo del certificado */}
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-outline uppercase tracking-wider flex items-center gap-1">
                      <Clock className="size-3" /> Horas Invertidas
                    </span>
                    <span className="text-lg font-bold text-on-surface">
                      {cert.horas_invertidas} horas
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-outline uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle className="size-3" /> Tareas Aprobadas
                    </span>
                    <span className="text-lg font-bold text-on-surface">
                      {cert.temas_aprobados} temas
                    </span>
                  </div>
                  <div className="col-span-2 flex flex-col gap-1 mt-2">
                    <span className="text-[11px] font-bold text-outline uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="size-3" /> Fecha de Emisión
                    </span>
                    <span className="text-sm font-semibold text-on-surface-variant">
                      {format(new Date(cert.fecha_emision), "d 'de' MMMM, yyyy", { locale: es })}
                    </span>
                  </div>
                </div>

                <div className="bg-surface-container-lowest rounded-xl p-3 mb-6 border border-outline-variant/50 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#845326] font-bold">Nº de Certificado:</span>
                    <span className="font-mono font-black text-[#2C1F14]">
                      {cert.numero_certificado ||
                        `KMB-${cert.hash_sha256.substring(0, 8).toUpperCase()}`}
                    </span>
                  </div>
                  <div className="font-mono text-[9px] text-outline break-all truncate">
                    Hash: {cert.hash_sha256}
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setSelectedHash(cert.hash_sha256)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#845326] text-white font-bold rounded-xl hover:bg-[#433022] transition-colors text-xs sm:text-sm cursor-pointer shadow-sm hover:shadow"
                >
                  <Award className="size-4" />
                  Ver Certificado
                </button>
                <Link
                  href={`/proyectos/${cert.project_id}`}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-4 bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold rounded-xl transition-colors text-xs sm:text-sm"
                  title="Ir al proyecto asociado"
                >
                  <span>Proyecto</span>
                  <ExternalLink className="size-3.5 opacity-70" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedHash && (
        <CertificateModal
          hash={selectedHash}
          isOpen={!!selectedHash}
          onClose={() => setSelectedHash(null)}
        />
      )}
    </>
  );
}
