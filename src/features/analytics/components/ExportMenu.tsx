'use client';

import { useState } from 'react';
import { Download, FileText, Image as ImageIcon, FileSpreadsheet, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AnalyticsDashboardData, AnalyticsMetricId } from '../data/types';
import { exportAsImage, exportAsPDF, exportAsExcel } from '../utils/exportUtils';
import type { Locale } from '@/lib/i18n/locale';

interface ExportMenuProps {
  data: AnalyticsDashboardData;
  activeMetric: AnalyticsMetricId;
  locale: Locale;
}

export function ExportMenu({ data, activeMetric, locale }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const copy =
    locale === 'es'
      ? {
          workload: 'Carga planificada',
          progress: 'Progreso de proyectos',
          priorities: 'Prioridades',
          deadlines: 'Próximas entregas',
          aiError: 'Error obteniendo el reporte de IA',
          unavailable: 'Análisis no disponible en este momento.',
          error: 'Error al generar el reporte',
          exportError: 'Hubo un error al exportar el reporte:',
          analyzing: 'Analizando con IA...',
          export: 'Exportar reporte',
          smartPdf: 'PDF inteligente',
          excel: 'Reporte en Excel',
          image: 'Imagen + resumen (PNG)',
        }
      : {
          workload: 'Planned workload',
          progress: 'Project progress',
          priorities: 'Priorities',
          deadlines: 'Upcoming deadlines',
          aiError: 'Error getting the AI report',
          unavailable: 'Analysis is unavailable right now.',
          error: 'Error generating the report',
          exportError: 'There was an error exporting the report:',
          analyzing: 'Analyzing with AI...',
          export: 'Export report',
          smartPdf: 'Smart PDF',
          excel: 'Excel report',
          image: 'Image + summary (PNG)',
        };
  const metricTitles = {
    workload: copy.workload,
    progress: copy.progress,
    priorities: copy.priorities,
    deadlines: copy.deadlines,
  };

  const handleExport = async (format: 'png' | 'pdf' | 'excel') => {
    setIsOpen(false);
    setIsExporting(true);

    try {
      const metricTitle = metricTitles[activeMetric];
      const seriesData = data.series[activeMetric];

      const response = await fetch('/api/ai/analytics-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metricTitle,
          metricKey: activeMetric,
          summary: data.summary,
          seriesData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || copy.aiError);
      }

      const result = await response.json();
      const aiText = result.text || copy.unavailable;

      if (format === 'png') {
        await exportAsImage('exportable-chart-area', aiText, metricTitle, locale);
      } else if (format === 'pdf') {
        await exportAsPDF('exportable-chart-area', aiText, metricTitle, locale);
      } else if (format === 'excel') {
        await exportAsExcel(
          'exportable-chart-area',
          aiText,
          metricTitle,
          seriesData as unknown as Record<string, unknown>[],
          locale,
        );
      }
    } catch (error) {
      console.error('Error durante la exportación:', error);
      const msg = error instanceof Error ? error.message : copy.error;
      alert(`${copy.exportError} ${msg}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className={cn(
          'flex items-center gap-2 rounded-xl border border-outline-variant/60 bg-surface px-4 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          isExporting && 'opacity-70 cursor-not-allowed',
        )}
      >
        {isExporting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        {isExporting ? copy.analyzing : copy.export}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 sm:left-auto sm:right-0 top-full z-50 mt-2 w-56 rounded-xl border border-outline-variant/40 bg-surface p-1 shadow-lg animate-in fade-in slide-in-from-top-2">
            <button
              onClick={() => handleExport('pdf')}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-on-surface hover:bg-surface-container"
            >
              <FileText className="size-4 text-primary" />
              {copy.smartPdf}
            </button>
            <button
              onClick={() => handleExport('excel')}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-on-surface hover:bg-surface-container"
            >
              <FileSpreadsheet className="size-4 text-status-success" />
              {copy.excel}
            </button>
            <button
              onClick={() => handleExport('png')}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-on-surface hover:bg-surface-container"
            >
              <ImageIcon className="size-4 text-secondary" />
              {copy.image}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
