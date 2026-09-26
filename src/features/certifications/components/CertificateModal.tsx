'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  X,
  Download,
  Award,
  CheckCircle,
  Loader2,
  Calendar,
  ShieldCheck,
  Copy,
  Image as ImageIcon,
  Lock,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CertData {
  hash_sha256: string;
  numero_certificado?: string;
  fecha_emision: string;
  horas_invertidas: number;
  temas_aprobados: number;
  proyectos: { titulo: string };
  profiles: { nombre_completo: string };
  tareas?: { titulo?: string; title?: string; id?: string }[];
}

export interface CertificateModalProps {
  hash?: string;
  isOpen: boolean;
  onClose: () => void;
  isPreview?: boolean;
  allTasksCompleted?: boolean;
  allQuizzesApproved?: boolean;
  previewData?: {
    tituloProyecto: string;
    horasInvertidas: number;
    tareasAprobadas: { titulo: string; id?: string }[];
    nombreCompleto: string;
    numeroCertificado?: string;
  };
}

export function CertificateModal({
  hash,
  isOpen,
  onClose,
  isPreview = false,
  previewData,
}: CertificateModalProps) {
  const supabase = createClient();
  const certRef = useRef<HTMLDivElement>(null);
  const [fetchedData, setFetchedData] = useState<CertData | null>(null);
  const [prevHash, setPrevHash] = useState<string | undefined>(hash);
  const [isDownloading, setIsDownloading] = useState<'png' | 'pdf' | null>(null);
  const [copied, setCopied] = useState(false);

  if (hash !== prevHash) {
    setPrevHash(hash);
    setFetchedData(null);
  }

  const isOfficial = Boolean(hash && hash !== 'KMB-PENDIENTE-VERIFICACION');
  const effectiveIsPreview = isPreview && !isOfficial;

  const previewCertData: CertData | null =
    effectiveIsPreview && previewData
      ? {
          hash_sha256: 'KMB-PENDIENTE-VERIFICACION',
          numero_certificado: 'KMB-PENDIENTE',
          fecha_emision: new Date().toISOString(),
          horas_invertidas: previewData.horasInvertidas,
          temas_aprobados: previewData.tareasAprobadas.length,
          proyectos: { titulo: previewData.tituloProyecto },
          profiles: { nombre_completo: previewData.nombreCompleto },
          tareas: previewData.tareasAprobadas,
        }
      : null;

  const officialDataFromProps: CertData | null =
    !effectiveIsPreview && previewData && hash
      ? {
          hash_sha256: hash,
          numero_certificado:
            previewData.numeroCertificado ||
            `KMB-${new Date().getFullYear()}-${hash.slice(0, 4).toUpperCase()}-${hash.slice(4, 8).toUpperCase()}`,
          fecha_emision: new Date().toISOString(),
          horas_invertidas: previewData.horasInvertidas,
          temas_aprobados: previewData.tareasAprobadas.length,
          proyectos: { titulo: previewData.tituloProyecto },
          profiles: { nombre_completo: previewData.nombreCompleto },
          tareas: previewData.tareasAprobadas,
        }
      : null;

  const data = effectiveIsPreview ? previewCertData : fetchedData || officialDataFromProps;
  const loading = effectiveIsPreview ? false : !data && !!hash;

  useEffect(() => {
    if (!isOpen || effectiveIsPreview || !hash) return;

    let isMounted = true;

    const fetchCert = async () => {
      try {
        const { data: cert, error } = await supabase
          .from('certificados_emitidos')
          .select('*')
          .eq('hash_sha256', hash)
          .maybeSingle();

        if (cert && !error && isMounted) {
          // Obtener nombre del proyecto desde la tabla 'projects'
          const { data: projectData } = await supabase
            .from('projects')
            .select('titulo')
            .eq('id', cert.project_id)
            .maybeSingle();

          // Obtener nombre del perfil desde 'profiles'
          const { data: profileData } = await supabase
            .from('profiles')
            .select('nombre_completo')
            .eq('id', cert.profile_id)
            .maybeSingle();

          // Obtener tareas aprobadas con la clave foránea real 'id_proyecto'
          const { data: tareas } = await supabase
            .from('tareas')
            .select('id, titulo')
            .eq('id_proyecto', cert.project_id)
            .eq('quiz_aprobado', true);

          const certNumber =
            cert.numero_certificado ||
            `KMB-${new Date(cert.fecha_emision).getFullYear()}-${cert.hash_sha256.slice(0, 4).toUpperCase()}-${cert.hash_sha256.slice(4, 8).toUpperCase()}`;

          if (isMounted) {
            setFetchedData({
              hash_sha256: cert.hash_sha256,
              numero_certificado: certNumber,
              fecha_emision: cert.fecha_emision,
              horas_invertidas: Number(cert.horas_invertidas) || 1,
              temas_aprobados: Number(cert.temas_aprobados) || (tareas?.length ?? 1),
              proyectos: { titulo: projectData?.titulo || 'Proyecto Académico' },
              profiles: { nombre_completo: profileData?.nombre_completo || 'Estudiante Komorebi' },
              tareas: (tareas || []) as { titulo?: string; id?: string }[],
            });
          }
        }
      } catch (err) {
        console.error('Error fetching certificate details:', err);
      }
    };
    fetchCert();

    return () => {
      isMounted = false;
    };
  }, [isOpen, hash, effectiveIsPreview, supabase]);

  // Validación para habilitar la descarga: debe ser oficial, tener código único y estar completado
  const hasValidVerificationCode = Boolean(
    data?.numero_certificado &&
    data.numero_certificado !== 'KMB-PENDIENTE' &&
    data?.hash_sha256 &&
    data.hash_sha256 !== 'KMB-PENDIENTE-VERIFICACION',
  );

  const isEligibleForDownload = !effectiveIsPreview && hasValidVerificationCode;

  const handleDownloadPDF = async () => {
    if (!certRef.current || isDownloading || !data || !isEligibleForDownload) return;
    try {
      setIsDownloading('pdf');
      const html2canvas = (await import('html2canvas-pro')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(certRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#FCF9F0',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });

      const safeTitle = data.proyectos?.titulo || 'Komorebi';
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
      pdf.save(`Certificado_${safeTitle.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Error downloading PDF', error);
      alert('Hubo un error al generar el PDF.');
    } finally {
      setIsDownloading(null);
    }
  };

  const handleDownloadPNG = async () => {
    if (!certRef.current || isDownloading || !data || !isEligibleForDownload) return;
    try {
      setIsDownloading('png');
      const html2canvas = (await import('html2canvas-pro')).default;

      const canvas = await html2canvas(certRef.current, {
        scale: 3, // Alta definición para descarga de imagen
        useCORS: true,
        backgroundColor: '#FCF9F0',
        logging: false,
      });

      const safeTitle = data.proyectos?.titulo || 'Komorebi';
      const link = document.createElement('a');
      link.download = `Certificado_${safeTitle.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error downloading PNG', error);
      alert('Hubo un error al generar la imagen PNG.');
    } finally {
      setIsDownloading(null);
    }
  };

  const handleCopyCode = () => {
    const codeToCopy = data?.numero_certificado || data?.hash_sha256;
    if (!codeToCopy || effectiveIsPreview) return;
    navigator.clipboard.writeText(codeToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="w-full h-14 bg-[#FCF9F0] text-[#2C1F14] flex justify-between items-center px-4 sm:px-6 shrink-0 shadow-sm z-10 border-b border-[#E8DCD1]">
        <div className="flex items-center gap-2">
          <Award className="size-5 text-[#845326]" />
          <span className="font-bold text-sm sm:text-base">
            {effectiveIsPreview ? 'Vista Previa del Certificado' : 'Certificado Oficial'}
          </span>
          <span className="hidden sm:inline-block text-[#845326] text-xs opacity-70 ml-2">
            Acreditación oficial de tiempo invertido • Komorebi
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-[#E8DCD1] transition-colors text-outline cursor-pointer"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Scrollable Document Area */}
      <div className="flex-1 w-full overflow-y-auto p-4 sm:p-8 pb-28 sm:pb-32 flex justify-center items-start">
        {loading || !data ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/70">
            <Loader2 className="size-8 animate-spin mb-4" />
            <p>Cargando documento...</p>
          </div>
        ) : (
          <div className="w-full max-w-[1050px] flex flex-col gap-4 relative">
            {/* The Certificate Frame */}
            <div
              className="relative w-full aspect-[1.414/1] shadow-2xl overflow-hidden shrink-0 rounded-2xl"
              style={{ backgroundColor: '#FCF9F0' }}
            >
              {/* Contenedor exacto para html2canvas */}
              <div
                ref={certRef}
                className="absolute inset-0 p-10 sm:p-16 border-[16px] border-[#F2EFE8]"
                style={{ backgroundColor: '#FCF9F0' }}
              >
                {/* Thin inner border */}
                <div className="absolute inset-[16px] border-2 border-[#E8DCD1] pointer-events-none" />
                <div className="absolute inset-[22px] border border-[#E8DCD1]/60 pointer-events-none" />

                {/* Watermark Logo */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                  <Award className="w-[400px] h-[400px] text-[#845326]" />
                </div>

                {effectiveIsPreview && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                    <span className="transform -rotate-45 text-7xl font-black text-gray-400 opacity-10">
                      VISTA PREVIA
                    </span>
                  </div>
                )}

                <div className="relative z-10 flex flex-col h-full items-center text-center justify-between">
                  <div className="flex flex-col items-center w-full">
                    {/* Top Badge */}
                    <div className="mt-1 flex items-center justify-center gap-2 text-[9px] sm:text-[10px] font-bold text-[#845326] uppercase tracking-[0.2em] bg-[#F2EFE8] px-4 py-1.5 rounded-full mb-3 border border-[#E8DCD1]">
                      <Award className="size-3.5" />
                      <span>Komorebi Study Studio • Acreditación Académica</span>
                    </div>

                    {/* Main Title */}
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#2C1F14] tracking-widest mb-1 whitespace-nowrap">
                      CERTIFICADO DE INVERSIÓN DE TIEMPO
                    </h1>
                    <h2 className="text-[9px] sm:text-[11px] text-[#845326] uppercase tracking-[0.3em] mb-3">
                      Constancia Oficial de Dedicación y Cumplimiento de Metas
                    </h2>

                    {/* Presentación */}
                    <p className="italic font-serif text-[#845326] mb-1 text-xs sm:text-sm">
                      Por cuanto se hace constar oficialmente que el/la estudiante
                    </p>

                    {/* Nombre */}
                    <div className="w-full max-w-2xl border-b border-[#E8DCD1] pb-1 mb-2">
                      <p className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-[#2C1F14] capitalize">
                        {data.profiles.nombre_completo || 'Nombre no definido'}
                      </p>
                    </div>

                    {/* Descripción */}
                    <p className="text-[#2C1F14] text-xs sm:text-sm mb-2 max-w-2xl mx-auto leading-relaxed">
                      Ha dedicado y completado con disciplina un tiempo efectivo de foco y estudio
                      de:
                    </p>

                    {/* Estadísticas */}
                    <div className="flex items-center justify-center gap-4 mb-2">
                      <div className="font-bold text-lg text-gray-800">
                        <span className="mr-2">🕒</span>
                        {data.horas_invertidas} horas
                      </div>
                      <div className="text-gray-500 text-sm uppercase tracking-wide">
                        {data.temas_aprobados} TAREAS REALIZADAS
                      </div>
                    </div>

                    <p className="text-[#2C1F14] text-xs sm:text-sm mb-2 max-w-xl mx-auto">
                      Aplicadas con éxito en el desarrollo del proyecto académico:{' '}
                      <span className="font-bold">&quot;{data.proyectos.titulo}&quot;</span>
                    </p>

                    {/* Cuadrícula de temas aprobados */}
                    {(data.tareas?.length || 0) > 0 && (
                      <div className="grid grid-cols-2 gap-2 mt-2 w-full max-w-3xl mb-auto relative z-10">
                        {(data.tareas?.length || 0) > 8 ? (
                          <>
                            {data.tareas!.slice(0, 7).map((tarea, index) => (
                              <div
                                key={tarea.id || index}
                                className="border border-gray-200 rounded-md px-2 py-1 text-xs flex items-center bg-white shadow-xs"
                              >
                                <span className="text-green-600 mr-2 font-bold">✓</span>
                                <span className="truncate text-gray-700">
                                  {tarea.titulo || tarea.title}
                                </span>
                              </div>
                            ))}
                            <div className="border border-gray-200 rounded-md px-2 py-1 text-xs flex items-center justify-center bg-gray-50 shadow-xs">
                              <span className="text-gray-600 font-bold italic">
                                + {data.tareas!.length - 7} tareas adicionales
                              </span>
                            </div>
                          </>
                        ) : (
                          data.tareas!.map((tarea, index) => (
                            <div
                              key={tarea.id || index}
                              className="border border-gray-200 rounded-md px-2 py-1 text-xs flex items-center bg-white shadow-xs"
                            >
                              <span className="text-green-600 mr-2 font-bold">✓</span>
                              <span className="truncate text-gray-700">
                                {tarea.titulo || tarea.title}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer Area */}
                  <div className="w-full flex justify-between items-end pt-5 mt-auto border-t border-[#E8DCD1]/60">
                    {/* Left: Validation con número único */}
                    <div className="flex flex-col gap-1.5 text-left w-1/3">
                      <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-[#845326]">
                        <Calendar className="size-3.5" />
                        <span>
                          Fecha de Emisión:{' '}
                          <span className="font-bold">
                            {format(new Date(data.fecha_emision), "d 'de' MMMM, yyyy", {
                              locale: es,
                            })}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-[#845326]">
                        <ShieldCheck className="size-3.5 text-emerald-700" />
                        <span className="font-bold">Nº de Certificado:</span>
                      </div>
                      <div className="bg-[#F2EFE8] border border-[#E8DCD1] px-3 py-1 rounded-lg inline-block self-start shadow-2xs">
                        <span className="font-mono text-[10px] sm:text-xs text-[#2C1F14] font-black tracking-wider uppercase">
                          {data.numero_certificado ||
                            (data.hash_sha256
                              ? `KMB-${data.hash_sha256.substring(0, 8).toUpperCase()}`
                              : 'PENDIENTE')}
                        </span>
                      </div>
                      <div
                        className="text-[8px] sm:text-[9px] text-[#845326]/80 font-mono truncate max-w-[200px]"
                        title={`Hash criptográfico SHA-256: ${data.hash_sha256}`}
                      >
                        Hash: {data.hash_sha256.substring(0, 16)}...
                      </div>
                    </div>

                    {/* Center: Stamp */}
                    <div className="flex flex-col items-center justify-center opacity-85 w-1/3">
                      <div className="w-22 h-22 border-[3px] border-dashed border-[#845326] rounded-full flex flex-col items-center justify-center bg-[#FCF9F0] z-10 shadow-xs">
                        <Award className="size-7 text-[#845326] mb-0.5" />
                        <span className="text-[7px] font-black tracking-widest text-[#845326] uppercase">
                          Komorebi
                        </span>
                        <span className="text-[6px] font-bold tracking-widest text-[#845326] uppercase">
                          Verificado
                        </span>
                      </div>
                    </div>

                    {/* Right: Signature */}
                    <div className="flex flex-col items-center text-center min-w-[150px] w-1/3">
                      <div className="w-full border-b border-[#2C1F14] pb-1 mb-1 relative">
                        <span className="font-serif text-[#2C1F14] italic text-base opacity-85">
                          Comité Académico
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-[#2C1F14] uppercase tracking-wider mt-0.5">
                        Komorebi Study Studio
                      </span>
                      <span className="text-[8px] text-[#845326] uppercase tracking-widest mt-0.5">
                        Dirección de Productividad
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="w-full sticky bottom-0 bg-white rounded-t-[24px] sm:rounded-[24px] shadow-[0_-10px_30px_rgba(0,0,0,0.1)] border border-[#E8DCD1] p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 z-40 mt-2 mx-auto max-w-[1050px]">
              {/* Left Action Area: Código de Verificación Oficial */}
              <div className="flex items-center gap-3 w-full sm:w-auto overflow-hidden">
                <ShieldCheck className="size-5 text-emerald-600 hidden sm:block shrink-0" />
                <div className="flex items-center gap-2 overflow-hidden w-full bg-[#FCF9F0] border border-[#E8DCD1] rounded-xl pl-3 pr-1 py-1">
                  <span className="text-xs text-[#845326] whitespace-nowrap font-medium">
                    Nº Verificación:
                  </span>
                  <span className="text-xs font-mono font-black text-[#2C1F14] truncate">
                    {data.numero_certificado || data.hash_sha256}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    disabled={effectiveIsPreview}
                    className="ml-auto flex items-center gap-1.5 shrink-0 bg-white hover:bg-[#F2EFE8] px-3 py-1.5 rounded-lg border border-[#E8DCD1] text-[11px] font-bold text-[#845326] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Copiar código de verificación"
                  >
                    {copied ? (
                      <CheckCircle className="size-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    <span>{copied ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* Right Action Area: Opciones de descarga (PNG y PDF) */}
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                {/* Botón Descargar Imagen PNG */}
                <button
                  type="button"
                  onClick={handleDownloadPNG}
                  disabled={isDownloading !== null || !isEligibleForDownload}
                  title={
                    !isEligibleForDownload
                      ? 'Debes completar todas las tareas y aprobar todos los quizzes para descargar la imagen PNG.'
                      : 'Descargar certificado en imagen PNG de alta resolución'
                  }
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap shadow-xs ${
                    isEligibleForDownload
                      ? 'bg-white hover:bg-[#FAF3EC] text-[#845326] border border-[#845326]/30 hover:border-[#845326] cursor-pointer active:scale-98'
                      : 'opacity-50 cursor-not-allowed bg-gray-100 border border-gray-200 text-gray-400'
                  }`}
                >
                  {isDownloading === 'png' ? (
                    <Loader2 className="size-4 animate-spin text-[#845326]" />
                  ) : !isEligibleForDownload ? (
                    <Lock className="size-3.5" />
                  ) : (
                    <ImageIcon className="size-4 text-[#845326]" />
                  )}
                  <span>Descargar Imagen PNG</span>
                </button>

                {/* Botón Descargar PDF Oficial */}
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={isDownloading !== null || !isEligibleForDownload}
                  title={
                    !isEligibleForDownload
                      ? 'Debes completar todas las tareas y aprobar todos los quizzes para descargar el PDF oficial.'
                      : 'Descargar certificado oficial en PDF'
                  }
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm whitespace-nowrap ${
                    isEligibleForDownload
                      ? 'bg-[#845326] hover:bg-[#433022] text-white cursor-pointer active:scale-98'
                      : 'opacity-50 cursor-not-allowed bg-gray-200 text-gray-500'
                  }`}
                >
                  {isDownloading === 'pdf' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : !isEligibleForDownload ? (
                    <Lock className="size-3.5" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  <span>Descargar PDF</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
