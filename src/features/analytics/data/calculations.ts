import type { AnalyticsDashboardData, AnalyticsProject, AnalyticsTask } from './types';

const TIMEZONE = 'America/Caracas';
const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function dateKeyInTimeZone(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mondayFor(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  return addDays(dateKey, -offset);
}

function dateOnly(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : dateKeyInTimeZone(parsed);
}

function deadlineDateOnly(value: string | null) {
  return value ? value.slice(0, 10) : null;
}

function normalizeDisplayWhitespace(value: string) {
  return value.replace(/\u00a0/g, ' ');
}

function formatShortDateForDisplay(dateKey: string) {
  return normalizeDisplayWhitespace(
    new Intl.DateTimeFormat('es-VE', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${dateKey}T12:00:00Z`)),
  );
}

function formatDateTimeForDisplay(date: Date) {
  return normalizeDisplayWhitespace(
    new Intl.DateTimeFormat('es-VE', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: TIMEZONE,
    }).format(date),
  );
}

function safeMinutes(value: number | null) {
  return Number.isFinite(value) && value && value > 0 ? Math.round(value) : 0;
}

function normalizePriority(value: string | null) {
  switch (value?.trim().toLocaleLowerCase('es') ?? '') {
    case 'prioritario':
    case 'alta':
    case 'alto':
    case 'urgente':
      return { name: 'Prioritario', tone: 'priority' as const };
    case 'obligatorio':
    case 'media':
    case 'medio':
      return { name: 'Obligatorio', tone: 'required' as const };
    case 'personal':
    case 'baja':
    case 'bajo':
      return { name: 'Personal', tone: 'personal' as const };
    default:
      return { name: 'Sin prioridad', tone: 'neutral' as const };
  }
}

function relativeDeadlineLabel(dueDate: string, today: string) {
  const days = Math.round(
    (new Date(`${dueDate}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) /
      86_400_000,
  );
  if (days < 0)
    return {
      relativeLabel: `Venció hace ${Math.abs(days)} d`,
      state: 'Vencida',
      tone: 'urgent' as const,
    };
  if (days === 0) return { relativeLabel: 'Hoy', state: 'Hoy', tone: 'urgent' as const };
  if (days === 1) return { relativeLabel: 'Mañana', state: 'Atención', tone: 'attention' as const };
  if (days <= 7)
    return { relativeLabel: `En ${days} días`, state: 'Próxima', tone: 'attention' as const };
  return { relativeLabel: dueDate, state: 'A tiempo', tone: 'onTime' as const };
}

export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours === 0) return `${remaining} min`;
  return remaining === 0 ? `${hours} h` : `${hours} h ${remaining} min`;
}

export function buildAnalyticsDashboardData({
  projects,
  tasks,
  tasksAvailable,
  now = new Date(),
}: {
  projects: AnalyticsProject[];
  tasks: AnalyticsTask[];
  tasksAvailable: boolean;
  now?: Date;
}): AnalyticsDashboardData {
  const today = dateKeyInTimeZone(now);
  const startsOn = mondayFor(today);
  const endsOn = addDays(startsOn, 6);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(startsOn, index);
    return { day, label: DAY_LABELS[new Date(`${day}T12:00:00Z`).getUTCDay()], plannedMinutes: 0 };
  });
  const dayIndex = new Map(days.map((day, index) => [day.day, index]));
  const tasksByProject = new Map<string, AnalyticsTask[]>();
  let plannedMinutes = 0;
  let unscheduledTasks = 0;

  for (const task of tasks) {
    const projectTasks = tasksByProject.get(task.id_proyecto) ?? [];
    projectTasks.push(task);
    tasksByProject.set(task.id_proyecto, projectTasks);

    const taskDay = dateOnly(task.fecha_inicio);
    const index = taskDay ? dayIndex.get(taskDay) : undefined;
    if (index === undefined) {
      if (!taskDay) unscheduledTasks += 1;
      continue;
    }
    const minutes = safeMinutes(task.duracion);
    days[index].plannedMinutes += minutes;
    plannedMinutes += minutes;
  }

  const progress = projects.map((project) => {
    const projectTasks = tasksByProject.get(project.id) ?? [];
    const completedTasks = projectTasks.filter((task) => task.completado).length;
    const totalTasks = projectTasks.length;
    return {
      projectId: project.id,
      name: project.titulo?.trim() || 'Proyecto sin título',
      value: totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100),
      completedTasks,
      totalTasks,
    };
  });

  const priorityCounts = new Map<
    string,
    { value: number; tone: 'priority' | 'required' | 'personal' | 'neutral' }
  >();
  for (const project of projects) {
    const priority = normalizePriority(project.prioridad);
    const current = priorityCounts.get(priority.name) ?? { value: 0, tone: priority.tone };
    current.value += 1;
    priorityCounts.set(priority.name, current);
  }
  const priorities = Array.from(priorityCounts, ([name, value]) => ({ name, ...value }));

  const deadlines = projects
    .flatMap((project) => {
      const dueDate = deadlineDateOnly(project.fecha_limite);
      if (!dueDate) return [];
      return [{ project, dueDate, ...relativeDeadlineLabel(dueDate, today) }];
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map(({ project, dueDate, relativeLabel, state, tone }) => ({
      projectId: project.id,
      name: project.titulo?.trim() || 'Proyecto sin título',
      dueDate,
      relativeLabel,
      state,
      tone,
    }));

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const gantt = tasks
    .flatMap((task) => {
      const startDate = dateOnly(task.fecha_inicio);
      if (!startDate) return [];
      const project = projectById.get(task.id_proyecto);
      const calculatedEnd = new Date(`${startDate}T12:00:00Z`);
      calculatedEnd.setUTCMinutes(
        calculatedEnd.getUTCMinutes() + Math.max(15, safeMinutes(task.duracion) || 30),
      );
      const endDate = dateOnly(task.fecha_limite) ?? calculatedEnd.toISOString().slice(0, 10);
      return [
        {
          taskId: task.id,
          projectId: task.id_proyecto,
          taskName: task.titulo?.trim() || 'Tarea sin título',
          projectName: project?.titulo?.trim() || 'Proyecto sin título',
          startDate,
          endDate: endDate < startDate ? startDate : endDate,
          completed: Boolean(task.completado),
          progress: task.completado ? 100 : 0,
        },
      ];
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const ganttMilestones = projects
    .flatMap((project) => {
      const date = deadlineDateOnly(project.fecha_limite);
      if (!date) return [];
      return [
        {
          projectId: project.id,
          projectName: project.titulo?.trim() || 'Proyecto sin título',
          date,
        },
      ];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const ganttProjects = projects.map((project) => ({
    projectId: project.id,
    projectName: project.titulo?.trim() || 'Proyecto sin título',
  }));

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.completado).length;
  const highPriorityProjects =
    priorities.find((priority) => priority.name === 'Prioritario')?.value ?? 0;
  const upcomingDeadlines = deadlines.filter((deadline) => deadline.tone !== 'onTime').length;
  const projectsWithoutTasks = progress.filter((project) => project.totalTasks === 0).length;
  const messages: string[] = [];
  if (unscheduledTasks > 0)
    messages.push(
      `${unscheduledTasks} tarea(s) no tienen fecha de inicio y no se incluyen en la carga semanal.`,
    );
  if (projectsWithoutTasks > 0)
    messages.push(
      `${projectsWithoutTasks} proyecto(s) no tienen tareas; su avance aún no puede derivarse.`,
    );
  if (projects.some((project) => !project.fecha_limite))
    messages.push('Los proyectos sin fecha límite no aparecen en Entregas próximas.');

  return {
    requestedPeriod: {
      key: 'week',
      startsOn,
      endsOn,
      timezone: TIMEZONE,
      label: `Semana del ${formatShortDateForDisplay(startsOn)} al ${formatShortDateForDisplay(endsOn)}`,
    },
    summary: {
      activeProjects: projects.filter((project) => !project.completado).length,
      plannedMinutes,
      completedTasks,
      totalTasks,
      highPriorityProjects,
      upcomingDeadlines,
    },
    series: {
      workload: days,
      progress,
      priorities,
      deadlines,
      gantt,
      ganttMilestones,
      ganttProjects,
    },
    availability: {
      workload:
        tasksAvailable && days.some((day) => day.plannedMinutes > 0)
          ? {
              available: true,
              message: 'Basada en tareas con fecha de inicio dentro de esta semana.',
            }
          : {
              available: false,
              message: tasksAvailable
                ? 'Aún no hay tareas programadas para esta semana.'
                : 'No fue posible leer las tareas de esta cuenta.',
            },
      progress:
        tasksAvailable && totalTasks > 0
          ? {
              available: true,
              message: 'Derivado de tareas completadas sobre el total de cada proyecto.',
            }
          : {
              available: false,
              message: tasksAvailable
                ? 'El avance estará disponible cuando tus proyectos tengan tareas.'
                : 'No fue posible leer las tareas de esta cuenta.',
            },
      priorities:
        projects.length > 0
          ? { available: true, message: 'Basada en la prioridad asignada a cada proyecto.' }
          : {
              available: false,
              message: 'Crea un proyecto para ver la distribución de prioridades.',
            },
      deadlines:
        deadlines.length > 0
          ? {
              available: true,
              message: 'Basada en las fechas límite registradas en tus proyectos.',
            }
          : {
              available: false,
              message: 'Añade una fecha límite a un proyecto para ver próximas entregas.',
            },
      gantt:
        tasksAvailable && gantt.length > 0
          ? {
              available: true,
              message: 'Basado en tareas con fecha de inicio y duración registrada.',
            }
          : {
              available: false,
              message: tasksAvailable
                ? 'Programa tareas con fecha de inicio para construir tu cronograma.'
                : 'No fue posible leer las tareas de esta cuenta.',
            },
    },
    messages,
    source: {
      name: 'Supabase',
      calculatedAt: now.toISOString(),
      calculatedAtLabel: formatDateTimeForDisplay(now),
    },
  };
}
