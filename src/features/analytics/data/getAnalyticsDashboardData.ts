import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { buildAnalyticsDashboardData } from './calculations';
import type { AnalyticsDashboardData, AnalyticsProject, AnalyticsTask } from './types';

function emptyDashboard(message: string): AnalyticsDashboardData {
  const data = buildAnalyticsDashboardData({ projects: [], tasks: [], tasksAvailable: false });
  return {
    ...data,
    availability: Object.fromEntries(
      Object.keys(data.availability).map((key) => [key, { available: false, message }]),
    ) as AnalyticsDashboardData['availability'],
    messages: [message],
  };
}

export async function getAnalyticsDashboardData(): Promise<AnalyticsDashboardData> {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user)
    return emptyDashboard('Inicia sesión para consultar tu analítica privada.');

  const { data: projectRows, error: projectsError } = await supabase
    .from('projects')
    .select('id, titulo, fecha_limite, prioridad, completado')
    .eq('user_id', auth.user.id);
  if (projectsError) return emptyDashboard('No fue posible cargar tus proyectos en este momento.');

  const projects = (projectRows ?? []) as AnalyticsProject[];
  const projectIds = projects.map((project) => project.id);
  if (projectIds.length === 0) {
    return buildAnalyticsDashboardData({ projects, tasks: [], tasksAvailable: true });
  }

  const { data: taskRows, error: tasksError } = await supabase
    .from('tareas')
    .select('id, id_proyecto, titulo, duracion, completado, fecha_inicio, fecha_limite, prioridad')
    .in('id_proyecto', projectIds);

  return buildAnalyticsDashboardData({
    projects,
    tasks: tasksError ? [] : ((taskRows ?? []) as AnalyticsTask[]),
    tasksAvailable: !tasksError,
  });
}
