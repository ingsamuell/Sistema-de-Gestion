'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BarChart3, Check, ChevronRight, Info, MessageCircle, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { formatMinutes } from '../data/calculations';
import type { AnalyticsDashboardData, AnalyticsMetricId } from '../data/types';
import { WorkloadChart } from './charts/WorkloadChart';
import { ProgressChart } from './charts/ProgressChart';
import { PrioritiesChart } from './charts/PrioritiesChart';
import { DeadlinesTimeline } from './charts/DeadlinesTimeline';
import { ExportMenu } from './ExportMenu';
import { useAnalyticsTour } from '@/hooks/useAnalyticsTour';

type Metric = {
  label: string;
  title: string;
  description: string;
  question: string;
};

const metrics: Record<AnalyticsMetricId, Metric> = {
  workload: {
    label: 'Horas planificadas',
    title: 'Tu carga planificada',
    description: 'Minutos estimados agrupados por el día de inicio de cada tarea.',
    question: '¿Cómo puedo equilibrar mi semana?',
  },
  progress: {
    label: 'Progreso',
    title: 'Avance actual por proyecto',
    description: 'Derivado de tus tareas completadas, sin usar porcentajes ilustrativos.',
    question: '¿Qué proyecto debería priorizar hoy?',
  },
  priorities: {
    label: 'Prioridades',
    title: 'Distribución de tu atención',
    description: 'Cantidad de proyectos por la prioridad que les asignaste.',
    question: '¿Mis prioridades están equilibradas?',
  },
  deadlines: {
    label: 'Entregas próximas',
    title: 'Ritmo de tus fechas límite',
    description: 'Proyectos ordenados según la cercanía de su fecha límite.',
    question: '¿Qué entrega necesita atención primero?',
  },
};

const metricIds = Object.keys(metrics) as AnalyticsMetricId[];

export function AnalyticsDashboard({ data }: { data: AnalyticsDashboardData }) {
  const [activeMetric, setActiveMetric] = useState<AnalyticsMetricId>('workload');

  useAnalyticsTour();

  const active = metrics[activeMetric];
  const availability = data.availability[activeMetric];
  const presentation = getMetricPresentation(activeMetric, data);
  const assistantHref = `/ia?source=analytics&view=${activeMetric}&period=week&question=${encodeURIComponent(active.question)}`;
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-on-primary">
              <BarChart3 className="size-4" />
            </span>
            Tu planificación
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface md:text-4xl">
            Analítica
          </h1>
          <p className="mt-2 max-w-2xl text-on-surface-variant">
            Una lectura privada de tus proyectos y tareas para ayudarte a decidir qué hacer después.
          </p>
        </div>
        <div id="tour-analytics-actions" className="flex items-center gap-3">
          <ExportMenu data={data} activeMetric={activeMetric} />
          <span className="hidden sm:flex w-fit items-center gap-2 rounded-xl border border-status-success/25 bg-status-success-bg px-3 py-2 text-xs font-semibold text-status-success">
            <Info className="size-4" />
            Datos de tu cuenta
          </span>
        </div>
      </header>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-outline-variant/30 px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent-amber">
                {data.requestedPeriod.label}
              </p>
              <h2 className="mt-1 text-xl font-bold text-on-surface">¿Qué quieres observar?</h2>
            </div>
            <p className="text-xs leading-relaxed text-on-surface-variant sm:max-w-56 sm:text-right">
              Elige una medida por vez para no mezclar unidades ni conclusiones.
            </p>
          </div>
          <div
            id="tour-analytics-tabs"
            className="mt-5 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
            role="tablist"
            aria-label="Medidas disponibles"
          >
            {metricIds.map((metricId) => {
              const isActive = metricId === activeMetric;
              return (
                <button
                  key={metricId}
                  id={`analytics-tab-${metricId}`}
                  type="button"
                  role="tab"
                  aria-controls="analytics-metric-panel"
                  aria-selected={isActive}
                  onClick={() => setActiveMetric(metricId)}
                  className={cn(
                    'flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                    isActive
                      ? 'border-primary bg-primary text-on-primary'
                      : 'border-outline-variant/60 bg-surface text-on-surface-variant hover:border-primary/40 hover:bg-surface-container',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-4 items-center justify-center rounded border',
                      isActive ? 'border-on-primary/70 bg-on-primary/15' : 'border-outline-variant',
                    )}
                  >
                    {isActive && <Check className="size-3" />}
                  </span>
                  {metrics[metricId].label}
                </button>
              );
            })}
            <span className="flex min-h-11 shrink-0 items-center rounded-xl border border-dashed border-outline-variant px-3 text-sm font-medium text-outline">
              Más medidas, próximamente
            </span>
          </div>
        </div>

        <div
          id="analytics-metric-panel"
          role="tabpanel"
          aria-labelledby={`analytics-tab-${activeMetric}`}
          className="p-4 sm:p-6"
        >
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xl font-bold text-on-surface">{active.title}</h3>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
                {active.description}
              </p>
            </div>
            <div className="w-fit max-w-full rounded-2xl bg-surface-container px-4 py-2 text-left sm:text-right">
              <p className="text-lg font-bold text-on-surface">{presentation.value}</p>
              <p className="text-[11px] font-medium text-on-surface-variant">
                {presentation.label}
              </p>
            </div>
          </div>

          <p className="mb-4 text-sm leading-relaxed text-on-surface-variant">
            {availability.message}
          </p>
          {availability.available ? (
            <>
              <p className="sr-only">Resumen accesible: {presentation.accessibleSummary}</p>
              <div
                id="exportable-chart-area"
                className="overflow-x-auto bg-surface-container-lowest p-2 rounded-xl"
              >
                <MetricChart metric={activeMetric} data={data} />
              </div>
            </>
          ) : (
            <div id="exportable-chart-area">
              <EmptyMetric message={availability.message} />
            </div>
          )}
          {data.messages.length > 0 && (
            <ul className="mt-5 space-y-2 text-sm leading-relaxed text-on-surface-variant">
              {data.messages.map((message) => (
                <li key={message}>• {message}</li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <section
        id="tour-analytics-ai"
        className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
      >
        <div className="rounded-2xl border border-primary/10 bg-primary/[0.025] p-5 sm:p-6">
          <div className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
              <Sparkles className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-primary">Qué significa esta vista</p>
              <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
                {availability.message}
              </p>
            </div>
          </div>
        </div>
        <Link
          href={assistantHref}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-center text-sm font-bold text-on-primary transition-colors hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:w-auto"
        >
          <MessageCircle className="size-4" /> Consultar esta vista con Komo{' '}
          <ChevronRight className="size-4" />
        </Link>
      </section>
    </div>
  );
}

function getMetricPresentation(metric: AnalyticsMetricId, data: AnalyticsDashboardData) {
  if (metric === 'workload')
    return {
      value: formatMinutes(data.summary.plannedMinutes),
      label: 'planificados esta semana',
      accessibleSummary: `${formatMinutes(data.summary.plannedMinutes)} planificados entre ${data.requestedPeriod.startsOn} y ${data.requestedPeriod.endsOn}.`,
    };
  if (metric === 'progress') {
    const value =
      data.summary.totalTasks === 0
        ? '—'
        : `${Math.round((data.summary.completedTasks / data.summary.totalTasks) * 100)}%`;
    return {
      value,
      label: `${data.summary.completedTasks} de ${data.summary.totalTasks} tareas completadas`,
      accessibleSummary: `${data.summary.completedTasks} de ${data.summary.totalTasks} tareas completadas en ${data.series.progress.length} proyectos.`,
    };
  }
  if (metric === 'priorities')
    return {
      value: String(data.summary.highPriorityProjects),
      label: 'proyectos prioritarios',
      accessibleSummary: `${data.summary.highPriorityProjects} proyectos prioritarios de ${data.summary.activeProjects} activos.`,
    };
  return {
    value: String(data.summary.upcomingDeadlines),
    label: 'entregas requieren atención',
    accessibleSummary: `${data.summary.upcomingDeadlines} fechas límite vencidas, hoy o dentro de siete días.`,
  };
}

function MetricChart({
  metric,
  data,
}: {
  metric: AnalyticsMetricId;
  data: AnalyticsDashboardData;
}) {
  if (metric === 'workload') {
    return <WorkloadChart data={data.series.workload} />;
  }
  if (metric === 'progress') {
    return <ProgressChart data={data.series.progress} />;
  }
  if (metric === 'priorities') {
    return <PrioritiesChart data={data.series.priorities} />;
  }
  return <DeadlinesTimeline data={data.series.deadlines} />;
}

function EmptyMetric({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low/50 px-5 py-8 text-center">
      <p className="font-semibold text-on-surface">Aún no hay datos para esta métrica</p>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-on-surface-variant">
        {message}
      </p>
    </div>
  );
}
