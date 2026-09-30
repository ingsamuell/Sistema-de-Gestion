'use client';

import { cn } from '@/lib/utils';
import type { Locale } from '@/lib/i18n/locale';

interface DeadlinesTimelineProps {
  data: Array<{
    projectId: string;
    name: string;
    dueDate: string;
    relativeLabel: string;
    state: string;
    tone: 'urgent' | 'attention' | 'onTime';
  }>;
  locale: Locale;
}

export function DeadlinesTimeline({ data, locale }: DeadlinesTimelineProps) {
  const copy =
    locale === 'es'
      ? {
          aria: 'Próximas fechas límite',
          overdue: 'Vencida',
          today: 'Hoy',
          attention: 'Atención',
          upcoming: 'Próxima',
          onTime: 'A tiempo',
        }
      : {
          aria: 'Upcoming deadlines',
          overdue: 'Overdue',
          today: 'Today',
          attention: 'Attention',
          upcoming: 'Upcoming',
          onTime: 'On track',
        };
  const formatDate = (date: string) =>
    new Intl.DateTimeFormat(locale === 'es' ? 'es-VE' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00Z`));
  const relative = (deadline: DeadlinesTimelineProps['data'][number]) => {
    const today = new Date();
    const due = new Date(`${deadline.dueDate}T12:00:00`);
    const days = Math.round(
      (due.getTime() -
        new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12).getTime()) /
        86_400_000,
    );
    if (days < 0)
      return locale === 'es' ? `Venció hace ${Math.abs(days)} d` : `${Math.abs(days)}d overdue`;
    if (days === 0) return copy.today;
    if (days === 1) return locale === 'es' ? 'Mañana' : 'Tomorrow';
    if (days <= 7) return locale === 'es' ? `En ${days} días` : `In ${days} days`;
    return formatDate(deadline.dueDate);
  };
  const state = (deadline: DeadlinesTimelineProps['data'][number]) =>
    deadline.tone === 'urgent'
      ? deadline.relativeLabel === 'Hoy'
        ? copy.today
        : copy.overdue
      : deadline.tone === 'attention'
        ? deadline.relativeLabel === 'Mañana'
          ? copy.attention
          : copy.upcoming
        : copy.onTime;
  return (
    <ol className="min-w-0 space-y-4 pt-2" aria-label={copy.aria}>
      {data.map((deadline, index) => (
        <li key={deadline.projectId} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-4 group">
          <div className="relative flex items-center justify-center" aria-hidden="true">
            {index > 0 && (
              <span className="absolute bottom-1/2 left-1/2 top-[-1rem] w-px -translate-x-1/2 bg-outline-variant/50 transition-colors group-hover:bg-outline-variant" />
            )}
            {index < data.length - 1 && (
              <span className="absolute bottom-[-1rem] left-1/2 top-1/2 w-px -translate-x-1/2 bg-outline-variant/50 transition-colors group-hover:bg-outline-variant" />
            )}
            <span
              className={cn(
                'relative z-10 size-3.5 shrink-0 rounded-full border-2 border-surface-container-lowest transition-transform duration-300 group-hover:scale-125',
                deadline.tone === 'urgent'
                  ? 'bg-status-urgent shadow-[0_0_8px_rgba(184,74,57,0.5)]'
                  : deadline.tone === 'attention'
                    ? 'bg-status-attention shadow-[0_0_8px_rgba(192,125,43,0.5)]'
                    : 'bg-status-success shadow-[0_0_8px_rgba(61,122,90,0.5)]',
              )}
            />
          </div>
          <div className="min-w-0 rounded-xl border border-outline-variant/40 bg-surface-container-low/40 px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-4 transition-all duration-300 hover:bg-surface-container hover:shadow-sm hover:-translate-y-0.5">
            <div className="min-w-0">
              <p className="break-words font-semibold text-on-surface">{deadline.name}</p>
              <p className="mt-0.5 text-sm font-medium text-on-surface-variant flex items-center gap-1">
                {relative(deadline)}
                <span className="text-xs opacity-60 font-normal">
                  ({formatDate(deadline.dueDate)})
                </span>
              </p>
            </div>
            <span
              className={cn(
                'mt-2 inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-bold sm:mt-0 transition-colors',
                deadline.tone === 'urgent'
                  ? 'bg-status-urgent-bg text-status-urgent'
                  : deadline.tone === 'attention'
                    ? 'bg-status-attention-bg text-status-attention'
                    : 'bg-status-success-bg text-status-success',
              )}
            >
              {state(deadline)}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
