'use client';

import { CalendarRange, CheckCircle2, ChevronDown, ChevronRight, Circle, Flag } from 'lucide-react';
import { useRef, useState } from 'react';
import type { AnalyticsDashboardData } from '../../data/types';

type GanttItem = AnalyticsDashboardData['series']['gantt'][number];
type GanttMilestone = AnalyticsDashboardData['series']['ganttMilestones'][number];
type GanttProject = AnalyticsDashboardData['series']['ganttProjects'][number];
const DAY_MS = 86_400_000;

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string) {
  return Math.max(
    1,
    Math.round(
      (new Date(`${end}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) / DAY_MS,
    ) + 1,
  );
}

function formatDay(dateKey: string, locale: 'es' | 'en') {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-VE' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

function datePosition(start: string, date: string, dayCount: number) {
  const offset = daysBetween(start, date) - 1;
  return offset >= 0 && offset < dayCount ? (offset / dayCount) * 100 : null;
}

export function GanttChart({
  data,
  milestones,
  projects,
  locale,
}: {
  data: GanttItem[];
  milestones: GanttMilestone[];
  projects: GanttProject[];
  locale: 'es' | 'en';
}) {
  const [scale, setScale] = useState<7 | 14 | 30>(7);
  const [rangeMode, setRangeMode] = useState<'upcoming' | 'all' | 'history'>('upcoming');
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const todayRef = useRef<HTMLDivElement | null>(null);

  if (data.length === 0) return null;

  const projectOptions = projects.map(
    (project) => [project.projectId, project.projectName] as const,
  );
  const selectedData =
    selectedProjectId === 'all'
      ? data
      : data.filter((item) => item.projectId === selectedProjectId);
  const selectedMilestones =
    selectedProjectId === 'all'
      ? milestones
      : milestones.filter((milestone) => milestone.projectId === selectedProjectId);
  const today = new Date().toISOString().slice(0, 10);
  const copy =
    locale === 'es'
      ? {
          task: 'Tarea',
          completed: 'Completada',
          pending: 'Pendiente',
          overdue: 'Retrasada',
          view: 'Escala',
          week: 'Semana',
          fortnight: '2 semanas',
          month: 'Mes',
          today: 'Hoy',
          goToday: 'Ir a hoy',
          milestone: 'Hito',
          tasks: 'tareas',
          collapse: 'Contraer',
          expand: 'Expandir',
          project: 'Proyecto',
          allProjects: 'Todos los proyectos',
          period: 'Período',
          upcoming: 'Próximos días',
          all: 'Todo el cronograma',
          history: 'Historial',
          empty: 'No hay tareas en este período.',
          seeHistory: 'Ver historial',
        }
      : {
          task: 'Task',
          completed: 'Completed',
          pending: 'Pending',
          overdue: 'Overdue',
          view: 'Scale',
          week: 'Week',
          fortnight: '2 weeks',
          month: 'Month',
          today: 'Today',
          goToday: 'Go to today',
          milestone: 'Milestone',
          tasks: 'tasks',
          collapse: 'Collapse',
          expand: 'Expand',
          project: 'Project',
          allProjects: 'All projects',
          period: 'Period',
          upcoming: 'Upcoming days',
          all: 'Full timeline',
          history: 'History',
          empty: 'There are no tasks in this period.',
          seeHistory: 'View history',
        };

  const rangeStart =
    rangeMode === 'upcoming'
      ? today
      : rangeMode === 'history'
        ? addDays(today, -(scale - 1))
        : selectedData.reduce(
            (value, item) => (item.startDate < value ? item.startDate : value),
            selectedData[0]?.startDate ?? today,
          );
  const rangeEnd =
    rangeMode === 'all'
      ? selectedData.reduce(
          (value, item) => (item.endDate > value ? item.endDate : value),
          selectedData[0]?.endDate ?? rangeStart,
        )
      : rangeMode === 'history'
        ? today
        : addDays(rangeStart, scale - 1);
  const visibleData = selectedData.filter(
    (item) => item.endDate >= rangeStart && item.startDate <= rangeEnd,
  );
  const visibleMilestones = selectedMilestones.filter(
    (milestone) => milestone.date >= rangeStart && milestone.date <= rangeEnd,
  );
  const start = rangeStart;
  const dayCount =
    rangeMode === 'all' ? Math.min(31, Math.max(scale, daysBetween(rangeStart, rangeEnd))) : scale;
  const days = Array.from({ length: dayCount }, (_, index) => addDays(start, index));
  const todayPosition = datePosition(start, today, dayCount);
  if (visibleData.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-5 py-8 text-center text-sm text-on-surface-variant">
        <p>{copy.empty}</p>
        {rangeMode === 'upcoming' && (
          <button
            type="button"
            onClick={() => setRangeMode('history')}
            className="mt-3 rounded-md border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/[0.08]"
          >
            {copy.seeHistory}
          </button>
        )}
      </div>
    );
  }
  const projectPool =
    selectedProjectId === 'all'
      ? projects
      : projects.filter((project) => project.projectId === selectedProjectId);
  const groups = Array.from(
    projectPool
      .reduce((map, project) => {
        map.set(project.projectId, {
          id: project.projectId,
          name: project.projectName,
          items: [] as GanttItem[],
        });
        return map;
      }, new Map<string, { id: string; name: string; items: GanttItem[] }>())
      .values(),
  );
  visibleData.forEach((item) =>
    groups.find((group) => group.id === item.projectId)?.items.push(item),
  );

  const toggleProject = (projectId: string) => {
    setCollapsedProjects((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const goToToday = () => {
    if (todayPosition === null) {
      setScale(30);
      window.setTimeout(
        () =>
          todayRef.current?.scrollIntoView({
            behavior: 'smooth',
            inline: 'center',
            block: 'nearest',
          }),
        0,
      );
      return;
    }
    todayRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };

  const renderTimelineCells = () =>
    days.map((day) => (
      <div
        key={day}
        className={`border-r border-outline-variant/20 last:border-r-0 ${day === today ? 'bg-primary/[0.04]' : ''}`}
      />
    ));

  return (
    <div className="rounded-xl border border-outline-variant/40 bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/30 px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">
            {copy.view}
          </span>
          <label className="sr-only" htmlFor="gantt-project-filter">
            {copy.project}
          </label>
          <select
            id="gantt-project-filter"
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            className="max-w-[13rem] rounded-md border border-outline-variant/50 bg-surface px-2.5 py-1.5 text-xs font-semibold text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <option value="all">{copy.allProjects}</option>
            {projectOptions.map(([projectId, projectName]) => (
              <option key={projectId} value={projectId}>
                {projectName}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="gantt-period-filter">
            {copy.period}
          </label>
          <select
            id="gantt-period-filter"
            value={rangeMode}
            onChange={(event) => setRangeMode(event.target.value as 'upcoming' | 'all' | 'history')}
            className="max-w-[12rem] rounded-md border border-outline-variant/50 bg-surface px-2.5 py-1.5 text-xs font-semibold text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <option value="upcoming">{copy.upcoming}</option>
            <option value="all">{copy.all}</option>
            <option value="history">{copy.history}</option>
          </select>
          <button
            type="button"
            onClick={goToToday}
            className="inline-flex items-center gap-1 rounded-md border border-primary/30 px-2 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/[0.08]"
          >
            <CalendarRange className="size-3.5" /> {copy.goToday}
          </button>
        </div>
        <div
          className="flex rounded-lg border border-outline-variant/50 bg-surface-container-low p-0.5"
          role="group"
          aria-label={copy.view}
        >
          {(
            [
              [7, copy.week],
              [14, copy.fortnight],
              [30, copy.month],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setScale(value)}
              aria-pressed={scale === value}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors sm:px-3 ${scale === value ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[34rem] overflow-auto">
        <div className="min-w-[760px]">
          <div
            className="sticky top-0 z-20 grid border-b border-outline-variant/40 bg-surface-container-low text-xs font-bold text-on-surface-variant"
            style={{ gridTemplateColumns: `220px repeat(${days.length}, minmax(72px, 1fr))` }}
          >
            <div className="sticky left-0 z-30 border-r border-outline-variant/40 bg-surface-container-low px-4 py-3">
              {copy.task}
            </div>
            {days.map((day) => (
              <div
                key={day}
                className={`border-r border-outline-variant/25 px-2 py-3 text-center last:border-r-0 ${day === today ? 'text-primary' : ''}`}
              >
                {formatDay(day, locale)}
              </div>
            ))}
          </div>

          {groups.map((group) => {
            const collapsed = collapsedProjects.has(group.id);
            const milestone = visibleMilestones.find((item) => item.projectId === group.id);
            const milestonePosition = milestone
              ? datePosition(start, milestone.date, dayCount)
              : null;
            return (
              <div key={group.id}>
                <div
                  className="grid min-h-12 border-b border-outline-variant/30 bg-surface-container-low/60"
                  style={{ gridTemplateColumns: `220px repeat(${days.length}, minmax(72px, 1fr))` }}
                >
                  <button
                    type="button"
                    onClick={() => toggleProject(group.id)}
                    className="sticky left-0 z-30 flex min-w-0 items-center gap-2 border-r border-outline-variant/40 bg-surface-container-low px-4 py-2 text-left"
                    aria-label={`${collapsed ? copy.expand : copy.collapse} ${group.name}`}
                  >
                    {collapsed ? (
                      <ChevronRight className="size-4 shrink-0 text-primary" />
                    ) : (
                      <ChevronDown className="size-4 shrink-0 text-primary" />
                    )}
                    <span className="min-w-0 truncate text-sm font-bold text-on-surface">
                      {group.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-on-surface-variant">
                      {group.items.length} {copy.tasks}
                    </span>
                  </button>
                  <div
                    className="relative grid"
                    style={{
                      gridColumn: `2 / span ${days.length}`,
                      gridTemplateColumns: `repeat(${days.length}, minmax(72px, 1fr))`,
                    }}
                  >
                    {renderTimelineCells()}
                    {milestonePosition !== null && (
                      <div
                        className="absolute z-10"
                        style={{
                          left: `${milestonePosition}%`,
                          top: 'calc(50% - 8px)',
                          transform: 'translateX(-50%)',
                        }}
                        title={`${copy.milestone}: ${milestone?.projectName} · ${milestone?.date}`}
                      >
                        <Flag className="size-4 fill-accent-amber text-accent-amber" />
                      </div>
                    )}
                    {todayPosition !== null && (
                      <div
                        className="absolute inset-y-0 z-[5] w-px bg-primary/70"
                        style={{ left: `${todayPosition}%` }}
                      />
                    )}
                  </div>
                </div>

                {!collapsed &&
                  group.items.map((item) => {
                    const startOffset = Math.max(0, daysBetween(start, item.startDate) - 1);
                    const duration = Math.max(
                      1,
                      Math.min(dayCount - startOffset, daysBetween(item.startDate, item.endDate)),
                    );
                    const isOverdue = !item.completed && item.endDate < today;
                    return (
                      <div
                        key={item.taskId}
                        className="grid min-h-16 border-b border-outline-variant/25 last:border-b-0"
                        style={{
                          gridTemplateColumns: `220px repeat(${days.length}, minmax(72px, 1fr))`,
                        }}
                      >
                        <div className="sticky left-0 z-30 flex min-w-0 items-center gap-2 border-r border-outline-variant/40 bg-surface px-4 py-2 pl-8">
                          {item.completed ? (
                            <CheckCircle2 className="size-4 shrink-0 text-status-success" />
                          ) : (
                            <Circle
                              className={`size-4 shrink-0 ${isOverdue ? 'text-status-error' : 'text-primary'}`}
                            />
                          )}
                          <div className="min-w-0">
                            <p
                              className="truncate text-sm font-semibold text-on-surface"
                              title={item.taskName}
                            >
                              {item.taskName}
                            </p>
                            <p
                              className="truncate text-[11px] text-on-surface-variant"
                              title={item.projectName}
                            >
                              {item.projectName}
                            </p>
                          </div>
                        </div>
                        <div
                          className="relative grid"
                          style={{
                            gridColumn: `2 / span ${days.length}`,
                            gridTemplateColumns: `repeat(${days.length}, minmax(72px, 1fr))`,
                          }}
                        >
                          {renderTimelineCells()}
                          {todayPosition !== null && (
                            <div
                              ref={today === item.startDate ? todayRef : undefined}
                              className="absolute inset-y-0 z-[5] w-px bg-primary/70"
                              style={{ left: `${todayPosition}%` }}
                              aria-hidden="true"
                            />
                          )}
                          <div
                            className={`absolute z-10 flex h-7 items-center rounded-lg px-2 text-[11px] font-bold text-on-primary shadow-sm ${item.completed ? 'bg-status-success' : isOverdue ? 'bg-status-error' : 'bg-primary'}`}
                            style={{
                              left: `${(startOffset / dayCount) * 100}%`,
                              width: `${Math.max((duration / dayCount) * 100, 4)}%`,
                              top: 'calc(50% - 14px)',
                            }}
                            title={`${item.taskName} · ${item.startDate} → ${item.endDate}`}
                          >
                            <span className="truncate">
                              {item.completed ? '100%' : isOverdue ? copy.overdue : '0%'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-outline-variant/30 px-4 py-3 text-xs text-on-surface-variant">
        <span className="inline-flex items-center gap-1.5">
          <Circle className="size-3.5 text-primary" />
          {copy.pending}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-status-success" />
          {copy.completed}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Circle className="size-3.5 text-status-error" />
          {copy.overdue}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Flag className="size-3.5 fill-accent-amber text-accent-amber" />
          {copy.milestone}
        </span>
        {todayPosition !== null && (
          <span className="inline-flex items-center gap-1.5 text-primary">
            <span className="h-3.5 w-px bg-primary" />
            {copy.today}
          </span>
        )}
      </div>
    </div>
  );
}
