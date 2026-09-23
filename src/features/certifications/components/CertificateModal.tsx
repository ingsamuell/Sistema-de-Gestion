'use client';

import React, { useState } from 'react';
import {
  X,
  Download,
  Image as ImageIcon,
  Printer,
  Copy,
  Check,
  Loader2,
  Award,
  ShieldCheck,
} from 'lucide-react';
import type { TimeInvestmentCertificate } from '../types';
import { CertificateDocument } from './CertificateDocument';
import {
  exportCertificateAsPDF,
  exportCertificateAsPNG,
  printCertificate,
} from '../utils/certificateExport';

interface CertificateModalProps {
  certificate: TimeInvestmentCertificate | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CertificateModal({ certificate, isOpen, onClose }: CertificateModalProps) {
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingPNG, setIsExportingPNG] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen || !certificate) return null;

  const docElementId = `certificate-modal-doc-${certificate.id}`;
  const baseFilename = `Certificado_${certificate.title.replace(/\s+/g, '_')}_${certificate.studentName.replace(/\s+/g, '_')}`;

  const handleDownloadPDF = async () => {
    try {
      setIsExportingPDF(true);
      await exportCertificateAsPDF(docElementId, baseFilename);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleDownloadPNG = async () => {
    try {
      setIsExportingPNG(true);
      await exportCertificateAsPNG(docElementId, baseFilename);
    } finally {
      setIsExportingPNG(false);
    }
  };

  const handlePrint = () => {
    printCertificate(docElementId);
  };

  const handleCopyCode = () => {
    if (certificate?.verificationCode) {
      navigator.clipboard.writeText(certificate.verificationCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Fondo clicable para cerrar */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-4xl bg-surface rounded-2xl border border-outline-variant/50 shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-200">
        {/* Barra Superior del Modal */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-outline-variant/30 bg-surface-container">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#FAF0DE] text-[#845326] border border-[#C68B59]/30">
              <Award className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-primary leading-tight">
                Vista Previa del Certificado
              </h3>
              <p className="text-[11px] text-on-surface-variant">
                Acreditación oficial de tiempo invertido • Komorebi
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-outline hover:text-primary hover:bg-surface-container-high transition-colors"
            title="Cerrar vista previa"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Contenedor con Scroll para la Vista Previa del Documento */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-[#FAF7F2] flex items-center justify-center">
          <div className="overflow-x-auto max-w-full rounded-xl shadow-lg border border-[#D2C4BB]/60">
            <CertificateDocument certificate={certificate} id={docElementId} />
          </div>
        </div>

        {/* Barra de Acciones y Descarga */}
        <div className="px-5 py-3.5 border-t border-outline-variant/30 bg-surface flex flex-wrap items-center justify-between gap-3">
          {/* Código de Validación */}
          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            <ShieldCheck className="size-4 text-status-success shrink-0" />
            <span>Código de verificación:</span>
            <code className="font-mono font-bold text-xs bg-surface-container px-2 py-0.5 rounded border border-outline-variant/40 text-primary">
              {certificate.verificationCode}
            </code>
            <button
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary hover:text-primary transition-colors ml-1"
              title="Copiar código al portapapeles"
            >
              {copiedCode ? (
                <>
                  <Check className="size-3 text-status-success" />
                  <span className="text-status-success">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>

          {/* Botones de Exportación */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-on-surface-variant bg-surface border border-outline-variant/60 rounded-xl hover:bg-surface-container transition-colors"
            >
              <Printer className="size-3.5" />
              <span>Imprimir</span>
            </button>

            <button
              onClick={handleDownloadPNG}
              disabled={isExportingPNG}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-on-surface-variant bg-surface border border-outline-variant/60 rounded-xl hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              {isExportingPNG ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ImageIcon className="size-3.5 text-secondary" />
              )}
              <span>Imagen PNG</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={isExportingPDF}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-[#845326] hover:bg-[#6E421D] rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              {isExportingPDF ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              <span>Descargar PDF Oficial</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
