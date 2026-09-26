'use client';

import React, { useState, useEffect, useTransition, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  Search,
  Award,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Copy,
  Check,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { verifyCertificateAction } from '@/features/certifications/actions/issueCertificateAction';

interface CertificateResult {
  id: string;
  numeroCertificado: string;
  hash_sha256: string;
  fecha_emision: string;
  horas_invertidas: number;
  temas_aprobados: number;
  tituloProyecto: string;
  nombreEstudiante: string;
  tareas?: { id: string; titulo: string }[];
}

function ValidarCertificadoContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('codigo') || searchParams.get('hash') || '';

  const [codeQuery, setCodeQuery] = useState(initialQuery);
  const [result, setResult] = useState<CertificateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSearch = (codeToSearch?: string) => {
    const q = (codeToSearch ?? codeQuery).trim();
    if (!q) {
      setError('Por favor ingresa un número de certificado o hash de verificación.');
      return;
    }

    setError(null);
    setHasSearched(true);

    startTransition(async () => {
      const res = await verifyCertificateAction(q);
      if (res.success && res.data) {
        setResult(res.data as CertificateResult);
      } else {
        setResult(null);
        setError(res.error || 'No se encontró ningún certificado registrado con ese código.');
      }
    });
  };

  useEffect(() => {
    if (!initialQuery) return;

    let isMounted = true;
    startTransition(async () => {
      const res = await verifyCertificateAction(initialQuery);
      if (!isMounted) return;
      if (res.success && res.data) {
        setResult(res.data as CertificateResult);
      } else {
        setResult(null);
        setError(res.error || 'No se encontró ningún certificado registrado con ese código.');
      }
      setHasSearched(true);
    });

    return () => {
      isMounted = false;
    };
  }, [initialQuery]);

  const copyVerificationLink = () => {
    if (typeof window === 'undefined' || !result) return;
    const url = `${window.location.origin}/validar-certificado?codigo=${encodeURIComponent(result.numeroCertificado)}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2C1F14] flex flex-col justify-between selection:bg-[#F2EFE8]">
      {/* Navbar Superior */}
      <header className="border-b border-[#E8DCD1] bg-white/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-bold text-[#845326] hover:text-[#433022] transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>Volver al Inicio</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-[#845326] flex items-center justify-center text-white shadow-xs">
            <Award className="size-4" />
          </div>
          <span className="font-extrabold text-sm sm:text-base tracking-tight text-[#2C1F14]">
            Komorebi <span className="text-[#845326] font-normal">Acreditaciones</span>
          </span>
        </div>
      </header>

      {/* Contenedor Principal */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col items-center">
        {/* Encabezado */}
        <div className="text-center mb-8 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF3EC] border border-[#E8DCD1] text-xs font-bold text-[#845326] mb-3">
            <ShieldCheck className="size-3.5 text-emerald-600" />
            <span>Portal Oficial de Verificación</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-[#2C1F14] tracking-tight mb-2">
            Validar Certificado Académico
          </h1>
          <p className="text-sm sm:text-base text-[#845326] leading-relaxed">
            Comprueba la autenticidad e inmutabilidad de los certificados de inversión de tiempo y
            aprobación académica emitidos por Komorebi.
          </p>
        </div>

        {/* Buscador de Certificados */}
        <div className="w-full max-w-2xl bg-white border border-[#E8DCD1] rounded-2xl p-2 sm:p-2.5 shadow-sm mb-8 flex flex-col sm:flex-row items-center gap-2">
          <div className="relative flex-1 w-full flex items-center">
            <Search className="size-4 text-[#845326] absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={codeQuery}
              onChange={(e) => setCodeQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
              placeholder="Ingresa el número único (ej: KMB-2026-XXXX-XXXX) o Hash SHA-256"
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm font-mono text-[#2C1F14] placeholder:font-sans placeholder:text-gray-400 bg-transparent rounded-xl focus:outline-hidden"
            />
          </div>
          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={isPending}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#845326] hover:bg-[#433022] text-white font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            <span>Verificar</span>
          </button>
        </div>

        {/* Estado: Buscando */}
        {isPending && (
          <div className="flex flex-col items-center justify-center py-12 text-[#845326]">
            <Loader2 className="size-8 animate-spin mb-3 text-[#845326]" />
            <p className="text-sm font-semibold">
              Consultando registro inmutable de certificados...
            </p>
          </div>
        )}

        {/* Estado: Error / No encontrado */}
        {!isPending && error && hasSearched && (
          <div className="w-full max-w-2xl bg-rose-50/70 border border-rose-200 rounded-2xl p-5 text-rose-900 flex items-start gap-3 animate-in fade-in">
            <AlertCircle className="size-5 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm mb-1">Certificado no válido o no encontrado</h3>
              <p className="text-xs sm:text-sm text-rose-800 leading-relaxed">{error}</p>
              <p className="text-xs text-rose-700/80 mt-2">
                Verifica que no falten caracteres en el número o hash ingresado.
              </p>
            </div>
          </div>
        )}

        {/* Estado: Éxito / Certificado Verificado */}
        {!isPending && result && (
          <div className="w-full max-w-2xl bg-white border-2 border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_10px_40px_rgba(16,185,129,0.08)] animate-in fade-in slide-in-from-bottom-2">
            {/* Cabecera Verificada */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-[#E8DCD1] gap-4">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-2xl bg-emerald-100/80 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0">
                  <CheckCircle2 className="size-7" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-black tracking-wide text-emerald-700 uppercase">
                    <span>Certificado Oficial Verificado</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-[#2C1F14] leading-tight">
                    Acreditación Auténtica
                  </h2>
                </div>
              </div>

              {/* Botón compartir enlace */}
              <button
                type="button"
                onClick={copyVerificationLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E8DCD1] hover:bg-[#FAF3EC] text-xs font-bold text-[#845326] transition-colors cursor-pointer self-start sm:self-auto"
                title="Copiar enlace directo de verificación"
              >
                {copied ? (
                  <Check className="size-3.5 text-emerald-600" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                <span>{copied ? 'Enlace Copiado' : 'Compartir Verificación'}</span>
              </button>
            </div>

            {/* Datos Clave */}
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-[#FCF9F0] border border-[#E8DCD1] rounded-2xl p-4">
                <span className="text-[11px] font-bold text-[#845326] uppercase tracking-wider block mb-1">
                  Estudiante Acreditado
                </span>
                <p className="text-lg font-black text-[#2C1F14]">{result.nombreEstudiante}</p>
              </div>

              <div className="bg-[#FCF9F0] border border-[#E8DCD1] rounded-2xl p-4">
                <span className="text-[11px] font-bold text-[#845326] uppercase tracking-wider block mb-1">
                  Proyecto Culminado
                </span>
                <p className="text-lg font-black text-[#2C1F14] line-clamp-1">
                  {result.tituloProyecto}
                </p>
              </div>

              <div className="bg-[#FCF9F0] border border-[#E8DCD1] rounded-2xl p-4 flex items-center gap-3">
                <Clock className="size-5 text-[#845326] shrink-0" />
                <div>
                  <span className="text-[11px] font-bold text-[#845326] uppercase tracking-wider block">
                    Tiempo Dedicado
                  </span>
                  <p className="text-base font-black text-[#2C1F14]">
                    {result.horas_invertidas} horas de estudio
                  </p>
                </div>
              </div>

              <div className="bg-[#FCF9F0] border border-[#E8DCD1] rounded-2xl p-4 flex items-center gap-3">
                <Calendar className="size-5 text-[#845326] shrink-0" />
                <div>
                  <span className="text-[11px] font-bold text-[#845326] uppercase tracking-wider block">
                    Fecha de Emisión
                  </span>
                  <p className="text-base font-black text-[#2C1F14]">
                    {format(new Date(result.fecha_emision), "d 'de' MMMM, yyyy", { locale: es })}
                  </p>
                </div>
              </div>
            </div>

            {/* Código Único y Hash */}
            <div className="bg-[#FAF7F4] border border-[#E8DCD1] rounded-2xl p-4 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                <span className="text-xs font-bold text-[#845326] uppercase tracking-wider">
                  Número de Certificado Único:
                </span>
                <span className="font-mono font-black text-sm text-[#2C1F14] bg-white px-2.5 py-0.5 rounded-lg border border-[#E8DCD1]">
                  {result.numeroCertificado}
                </span>
              </div>
              <div className="text-[10px] text-gray-500 font-mono break-all">
                Hash SHA-256: {result.hash_sha256}
              </div>
            </div>

            {/* Temas evaluados */}
            {result.tareas && result.tareas.length > 0 && (
              <div>
                <span className="text-xs font-bold text-[#845326] uppercase tracking-wider block mb-2">
                  Metas y Temas Aprobados ({result.tareas.length}):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {result.tareas.map((tarea, idx) => (
                    <div
                      key={tarea.id || idx}
                      className="px-3 py-1.5 bg-white border border-[#E8DCD1] rounded-xl text-xs flex items-center gap-2"
                    >
                      <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate text-gray-700">{tarea.titulo}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E8DCD1] py-6 px-4 text-center text-xs text-[#845326]/70">
        <p>
          Komorebi Study Studio © {new Date().getFullYear()} • Sistema Criptográfico de
          Certificación y Productividad Académica
        </p>
      </footer>
    </div>
  );
}

export default function ValidarCertificadoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
          <Loader2 className="size-8 animate-spin text-[#845326]" />
        </div>
      }
    >
      <ValidarCertificadoContent />
    </Suspense>
  );
}
