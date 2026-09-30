export type AnalyticsMetricId = 'workload' | 'progress' | 'priorities' | 'deadlines' | 'gantt';

export type AnalyticsMetricAvailability = {
  available: boolean;
  message: string;
};

export type AnalyticsDashboardData = {
  requestedPeriod: {
    key: 'week';
    startsOn: string;
    endsOn: string;
    timezone: string;
    label: string;
  };
  summary: {
    activeProjects: number;
    plannedMinutes: number;
    completedTasks: number;
    totalTasks: number;
    highPriorityProjects: number;
    upcomingDeadlines: number;
  };
  series: {
    workload: Array<{ day: string; label: string; plannedMinutes: number }>;
    progress: Array<{
      projectId: string;
      name: string;
      value: number;
      completedTasks: number;
      totalTasks: number;
    }>;
    priorities: Array<{
      name: string;
      value: number;
      tone: 'priority' | 'required' | 'personal' | 'neutral';
    }>;
    deadlines: Array<{
      projectId: string;
      name: string;
      dueDate: string;
      relativeLabel: string;
      state: string;
      tone: 'urgent' | 'attention' | 'onTime';
    }>;
    gantt: Array<{
      taskId: string;
      projectId: string;
      taskName: string;
      projectName: string;
      startDate: string;
      endDate: string;
      completed: boolean;
      progress: number;
    }>;
    ganttMilestones: Array<{
      projectId: string;
      projectName: string;
      date: string;
    }>;
    ganttProjects: Array<{
      projectId: string;
      projectName: string;
    }>;
  };
  availability: Record<AnalyticsMetricId, AnalyticsMetricAvailability>;
  messages: string[];
  source: {
    name: 'Supabase';
    calculatedAt: string;
    calculatedAtLabel: string;
  };
};

export type AnalyticsProject = {
  id: string;
  titulo: string | null;
  fecha_limite: string | null;
  prioridad: string | null;
  completado: boolean | null;
};

export type AnalyticsTask = {
  id: string;
  id_proyecto: string;
  titulo: string | null;
  duracion: number | null;
  completado: boolean | null;
  fecha_inicio: string | null;
  fecha_limite: string | null;
  prioridad: string | null;
};
