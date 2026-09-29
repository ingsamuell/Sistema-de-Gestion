'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
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
import { defaultLocale, getLocaleFromPathname, type Locale } from '@/lib/i18n/locale';
import { localizedHref } from '@/lib/i18n/routes';

type Metric = {
  label: string;
  title: string;
  description: string;
  question: string;
};

function getMetrics(locale: Locale): Record<AnalyticsMetricId, Metric> {
  if (locale === 'en')
    return {
      workload: {
        label: 'Planned hours',
        title: 'Your planned workload',
        description: 'Estimated minutes grouped by each task’s start date.',
        question: 'How can I balance my week?',
      },
      progress: {
        label: 'Progress',
        title: 'Current progress by project',
        description: 'Calculated from your completed tasks, without illustrative percentages.',
        question: 'Which project should I prioritize today?',
      },
      priorities: {
        label: 'Priorities',
        title: 'How your attention is distributed',
        description: 'Number of projects for each priority you assigned.',
        question: 'Are my priorities balanced?',
      },
      deadlines: {
        label: 'Upcoming deadlines',
        title: 'Your deadline rhythm',
        description: 'Projects ordered by how close their deadlines are.',
        question: 'Which deadline needs attention first?',
      },
    };
  return {
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
}

export function AnalyticsDashboard({ data }: { data: AnalyticsDashboardData }) {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname) ?? defaultLocale;
  const metrics = getMetrics(locale);
  const metricIds = Object.keys(metrics) as AnalyticsMetricId[];
  const copy =
    locale === 'es'
      ? {
          planning: 'Tu planificación',
          title: 'Analítica',
          description:
            'Una lectura privada de tus proyectos y tareas para ayudarte a decidir qué hacer después.',
          accountData: 'Datos de tu cuenta',
          observe: '¿Qué quieres observar?',
          choose: 'Elige una medida por vez para no mezclar unidades ni conclusiones.',
          measures: 'Medidas disponibles',
          soon: 'Más medidas, próximamente',
          summary: 'Resumen accesible:',
          meaning: 'Qué significa esta vista',
          ask: 'Consultar esta vista con Komo',
          noData: 'Aún no hay datos para esta métrica',
        }
      : {
          planning: 'Your planning',
          title: 'Analytics',
          description:
            'A private view of your projects and tasks to help you decide what to do next.',
          accountData: 'Your account data',
          observe: 'What would you like to explore?',
          choose: 'Choose one metric at a time to avoid mixing units or conclusions.',
          measures: 'Available metrics',
          soon: 'More metrics coming soon',
          summary: 'Accessible summary:',
          meaning: 'What this view means',
          ask: 'Ask Komo about this view',
          noData: 'There is no data for this metric yet',
        };
  const [activeMetric, setActiveMetric] = useState<AnalyticsMetricId>('workload');

  useAnalyticsTour();

  const active = metrics[activeMetric];
  const availability = data.availability[activeMetric];
  const presentation = getMetricPresentation(activeMetric, data, locale);
  const assistantHref = `${localizedHref(locale, 'assistant')}?source=analytics&view=${activeMetric}&period=week&question=${encodeURIComponent(active.question)}`;
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-on-primary">
              <BarChart3 className="size-4" />
            </span>
            {copy.planning}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface md:text-4xl">
            {copy.title}
          </h1>
          <p className="mt-2 max-w-2xl text-on-surface-variant">{copy.description}</p>
        </div>
        <div id="tour-analytics-actions" className="flex items-center gap-3">
          <ExportMenu data={data} activeMetric={activeMetric} locale={locale} />
          <span className="hidden sm:flex w-fit items-center gap-2 rounded-xl border border-status-success/25 bg-status-success-bg px-3 py-2 text-xs font-semibold text-status-success">
            <Info className="size-4" />
            {copy.accountData}
          </span>
        </div>
      </header>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-outline-variant/30 px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent-amber">
                {formatRequestedPeriod(
                  data.requestedPeriod.startsOn,
                  data.requestedPeriod.endsOn,
                  locale,
                )}
              </p>
              <h2 className="mt-1 text-xl font-bold text-on-surface">{copy.observe}</h2>
            </div>
            <p className="text-xs leading-relaxed text-on-surface-variant sm:max-w-56 sm:text-right">
              {copy.choose}
            </p>
          </div>
          <div
            id="tour-analytics-tabs"
            className="mt-5 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
            role="tablist"
            aria-label={copy.measures}
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
              {copy.soon}
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
            {getAvailabilityMessage(activeMetric, data, locale)}
          </p>
          {availability.available ? (
            <>
              <p className="sr-only">
                {copy.summary} {presentation.accessibleSummary}
              </p>
              <div
                id="exportable-chart-area"
                className="overflow-x-auto bg-surface-container-lowest p-2 rounded-xl"
              >
                <MetricChart metric={activeMetric} data={data} locale={locale} />
              </div>
            </>
          ) : (
            <div id="exportable-chart-area">
              <EmptyMetric
                message={getAvailabilityMessage(activeMetric, data, locale)}
                title={copy.noData}
              />
            </div>
          )}
          {data.messages.length > 0 && (
            <ul className="mt-5 space-y-2 text-sm leading-relaxed text-on-surface-variant">
              {getDataMessages(data, locale).map((message) => (
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
              <p className="text-sm font-bold text-primary">{copy.meaning}</p>
              <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
                {getAvailabilityMessage(activeMetric, data, locale)}
              </p>
            </div>
          </div>
        </div>
        <Link
          href={assistantHref}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-center text-sm font-bold text-on-primary transition-colors hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:w-auto"
        >
          <MessageCircle className="size-4" /> {copy.ask} <ChevronRight className="size-4" />
        </Link>
      </section>
    </div>
  );
}

function getMetricPresentation(
  metric: AnalyticsMetricId,
  data: AnalyticsDashboardData,
  locale: Locale,
) {
  const isSpanish = locale === 'es';
  if (metric === 'workload')
    return {
      value: formatMinutes(data.summary.plannedMinutes),
      label: isSpanish ? 'planificados esta semana' : 'planned this week',
      accessibleSummary: isSpanish
        ? `${formatMinutes(data.summary.plannedMinutes)} planificados entre ${data.requestedPeriod.startsOn} y ${data.requestedPeriod.endsOn}.`
        : `${formatMinutes(data.summary.plannedMinutes)} planned between ${data.requestedPeriod.startsOn} and ${data.requestedPeriod.endsOn}.`,
    };
  if (metric === 'progress') {
    const value =
      data.summary.totalTasks === 0
        ? '—'
        : `${Math.round((data.summary.completedTasks / data.summary.totalTasks) * 100)}%`;
    return {
      value,
      label: isSpanish
        ? `${data.summary.completedTasks} de ${data.summary.totalTasks} tareas completadas`
        : `${data.summary.completedTasks} of ${data.summary.totalTasks} tasks completed`,
      accessibleSummary: isSpanish
        ? `${data.summary.completedTasks} de ${data.summary.totalTasks} tareas completadas en ${data.series.progress.length} proyectos.`
        : `${data.summary.completedTasks} of ${data.summary.totalTasks} tasks completed across ${data.series.progress.length} projects.`,
    };
  }
  if (metric === 'priorities')
    return {
      value: String(data.summary.highPriorityProjects),
      label: isSpanish ? 'proyectos prioritarios' : 'priority projects',
      accessibleSummary: isSpanish
        ? `${data.summary.highPriorityProjects} proyectos prioritarios de ${data.summary.activeProjects} activos.`
        : `${data.summary.highPriorityProjects} priority projects out of ${data.summary.activeProjects} active projects.`,
    };
  return {
    value: String(data.summary.upcomingDeadlines),
    label: isSpanish ? 'entregas requieren atención' : 'deadlines need attention',
    accessibleSummary: isSpanish
      ? `${data.summary.upcomingDeadlines} fechas límite vencidas, hoy o dentro de siete días.`
      : `${data.summary.upcomingDeadlines} deadlines overdue, due today, or due within seven days.`,
  };
}

function MetricChart({
  metric,
  data,
  locale,
}: {
  metric: AnalyticsMetricId;
  data: AnalyticsDashboardData;
  locale: Locale;
}) {
  if (metric === 'workload') {
    return <WorkloadChart data={data.series.workload} locale={locale} />;
  }
  if (metric === 'progress') {
    return <ProgressChart data={data.series.progress} locale={locale} />;
  }
  if (metric === 'priorities') {
    return <PrioritiesChart data={data.series.priorities} locale={locale} />;
  }
  return <DeadlinesTimeline data={data.series.deadlines} locale={locale} />;
}

function formatRequestedPeriod(startsOn: string, endsOn: string, locale: Locale) {
  const formatter = new Intl.DateTimeFormat(locale === 'es' ? 'es-VE' : 'en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const start = formatter.format(new Date(`${startsOn}T12:00:00Z`));
  const end = formatter.format(new Date(`${endsOn}T12:00:00Z`));
  return locale === 'es' ? `Semana del ${start} al ${end}` : `Week of ${start} to ${end}`;
}

function getAvailabilityMessage(
  metric: AnalyticsMetricId,
  data: AnalyticsDashboardData,
  locale: Locale,
) {
  const available = data.availability[metric].available;
  const hasTasks = data.summary.totalTasks > 0;
  const messages =
    locale === 'es'
      ? {
          workload: available
            ? 'Basada en tareas con fecha de inicio dentro de esta semana.'
            : hasTasks
              ? 'Aún no hay tareas programadas para esta semana.'
              : 'Elabora tareas con una fecha de inicio para ver tu carga semanal.',
          progress: available
            ? 'Derivado de tareas completadas sobre el total de cada proyecto.'
            : 'El avance estará disponible cuando tus proyectos tengan tareas.',
          priorities: available
            ? 'Basada en la prioridad asignada a cada proyecto.'
            : 'Crea un proyecto para ver la distribución de prioridades.',
          deadlines: available
            ? 'Basada en las fechas límite registradas en tus proyectos.'
            : 'Añade una fecha límite a un proyecto para ver próximas entregas.',
        }
      : {
          workload: available
            ? 'Based on tasks with a start date during this week.'
            : hasTasks
              ? 'There are no tasks scheduled for this week yet.'
              : 'Add tasks with a start date to see your weekly workload.',
          progress: available
            ? 'Calculated from completed tasks out of each project’s total tasks.'
            : 'Progress will be available once your projects have tasks.',
          priorities: available
            ? 'Based on the priority assigned to each project.'
            : 'Create a project to see your priority distribution.',
          deadlines: available
            ? 'Based on the deadlines recorded in your projects.'
            : 'Add a deadline to a project to see upcoming due dates.',
        };
  return messages[metric];
}

function getDataMessages(data: AnalyticsDashboardData, locale: Locale) {
  const unscheduled = Number(
    data.messages.find((message) => message.includes('fecha de inicio'))?.match(/^\d+/)?.[0] ?? 0,
  );
  const projectsWithoutTasks = data.series.progress.filter(
    (project) => project.totalTasks === 0,
  ).length;
  const projectsWithoutDeadlines = data.messages.some((message) =>
    message.includes('fecha límite'),
  );
  const messages: string[] = [];
  if (unscheduled > 0)
    messages.push(
      locale === 'es'
        ? `${unscheduled} tarea(s) no tienen fecha de inicio y no se incluyen en la carga semanal.`
        : `${unscheduled} task(s) have no start date and are not included in the weekly workload.`,
    );
  if (projectsWithoutTasks > 0)
    messages.push(
      locale === 'es'
        ? `${projectsWithoutTasks} proyecto(s) no tienen tareas; su avance aún no puede derivarse.`
        : `${projectsWithoutTasks} project(s) have no tasks, so their progress cannot be calculated yet.`,
    );
  if (projectsWithoutDeadlines)
    messages.push(
      locale === 'es'
        ? 'Los proyectos sin fecha límite no aparecen en Entregas próximas.'
        : 'Projects without a deadline do not appear in Upcoming deadlines.',
    );
  return messages;
}

function EmptyMetric({ message, title }: { message: string; title: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low/50 px-5 py-8 text-center">
      <p className="font-semibold text-on-surface">{title}</p>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-on-surface-variant">
        {message}
      </p>
    </div>
  );
}
