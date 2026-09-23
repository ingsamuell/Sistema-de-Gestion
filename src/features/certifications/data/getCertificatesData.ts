import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { CertificatesSummary, TimeInvestmentCertificate } from '../types';

/**
 * Convierte una cantidad de minutos en un texto legible en español.
 * Ejemplo: 135 -> "2 horas y 15 minutos"
 */
export function formatMinutesToHours(minutes: number): string {
  if (!minutes || minutes <= 0) return '0 horas';
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;

  if (hours === 0) {
    return `${remainingMins} minuto${remainingMins === 1 ? '' : 's'}`;
  }
  if (remainingMins === 0) {
    return `${hours} hora${hours === 1 ? '' : 's'}`;
  }
  return `${hours} hora${hours === 1 ? '' : 's'} y ${remainingMins} minuto${remainingMins === 1 ? '' : 's'}`;
}

/**
 * Genera un código de verificación determinista y profesional.
 */
function generateVerificationCode(prefix: string, seedA: string, seedB: string): string {
  const cleanA = (seedA || '0000').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
  const cleanB = (seedB || '0000').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
  const currentYear = new Date().getFullYear();
  return `KMB-${currentYear}-${prefix}-${cleanA}${cleanB}`;
}

export async function getCertificatesData(): Promise<CertificatesSummary> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  const emptySummary: CertificatesSummary = {
    totalMinutesAllProjects: 0,
    totalHoursAllProjectsText: '0 horas',
    totalCompletedProjects: 0,
    totalActiveProjects: 0,
    totalTasksCompleted: 0,
    certificates: [],
    globalCertificate: null,
  };

  if (authError || !user) {
    return emptySummary;
  }

  // Nombre del estudiante para el diploma
  const studentName =
    user.user_metadata?.full_name ||
    user.user_metadata?.first_name ||
    user.user_metadata?.name ||
    user.user_metadata?.nombre_usuario ||
    user.user_metadata?.username ||
    user.email?.split('@')[0] ||
    'Estudiante Universitario';

  // 1. Consultar todos los proyectos del estudiante
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select(
      'id, user_id, titulo, objetivo, fecha_limite, prioridad, nivel_conocimiento, minutos_diarios, progreso, completado',
    )
    .eq('user_id', user.id);

  if (projectsError) {
    console.error('getCertificatesData: error al consultar projects en Supabase:', projectsError);
    return emptySummary;
  }

  if (!projects || projects.length === 0) {
    return emptySummary;
  }

  const projectIds = projects.map((p) => p.id);

  // 2. Consultar todas las tareas asociadas a los proyectos
  const { data: tareas, error: tareasError } = await supabase
    .from('tareas')
    .select('id, id_proyecto, titulo, duracion, completado, completed_at, fecha_inicio')
    .in('id_proyecto', projectIds);

  if (tareasError) {
    console.warn('getCertificatesData: advertencia al consultar tareas:', tareasError);
  }

  const allTasks = tareas || [];

  let totalMinutesGlobal = 0;
  let totalTasksCompletedGlobal = 0;
  let totalCompletedProjectsCount = 0;
  const now = new Date();

  // 3. Procesar cada proyecto para generar su certificado correspondiente
  const certificates: TimeInvestmentCertificate[] = projects.map((p) => {
    const projectTasks = allTasks.filter((t) => t.id_proyecto === p.id);
    const completedTasks = projectTasks.filter((t) => Boolean(t.completado));

    const totalTasks = projectTasks.length;
    const completedCount = completedTasks.length;

    // Cálculo de progreso porcentual del proyecto
    const calculatedProgress =
      totalTasks === 0
        ? (p.progreso ?? 0)
        : Math.round((completedCount / totalTasks) * 100);

    // Un proyecto se considera culminado si tiene la bandera completado, progreso 100% o todas sus tareas listas
    const isFullyCompleted =
      Boolean(p.completado) ||
      calculatedProgress >= 100 ||
      (totalTasks > 0 && completedCount === totalTasks);

    // Inversión en minutos: sumatoria de duracion de las tareas completadas
    let minutesInvested = completedTasks.reduce(
      (acc, t) => acc + (t.duracion || p.minutos_diarios || 30),
      0,
    );

    // Si el proyecto fue culminado al 100% pero no tenía tareas específicas con duración,
    // garantizamos que refleje al menos su tiempo diario asignado
    if (isFullyCompleted && minutesInvested === 0) {
      minutesInvested = p.minutos_diarios || 60;
    }

    totalMinutesGlobal += minutesInvested;
    totalTasksCompletedGlobal += completedCount;

    if (isFullyCompleted) {
      totalCompletedProjectsCount++;
    }

    // Fecha de emisión: última tarea completada o fecha actual
    let lastCompletionDate = now;
    if (completedTasks.length > 0) {
      const dates = completedTasks
        .map((t) => (t.completed_at ? new Date(t.completed_at).getTime() : 0))
        .filter((d) => d > 0);
      if (dates.length > 0) {
        lastCompletionDate = new Date(Math.max(...dates));
      }
    }

    const verificationCode = generateVerificationCode('PRJ', p.id, user.id);

    // Competencias o hitos superados (títulos de tareas completadas o descriptores)
    const competencies = completedTasks
      .slice(0, 5)
      .map((t) => t.titulo.trim())
      .filter(Boolean);

    if (competencies.length === 0 && projectTasks.length > 0) {
      competencies.push(...projectTasks.slice(0, 3).map((t) => t.titulo.trim()));
    } else if (competencies.length === 0 && p.objetivo) {
      competencies.push(p.objetivo.slice(0, 80));
    }

    return {
      id: `cert-prj-${p.id}`,
      type: 'project',
      projectId: p.id,
      studentName,
      title: p.titulo,
      objective: p.objetivo || 'Desarrollo de competencias y ejecución de proyectos de aprendizaje.',
      totalMinutesInvested: minutesInvested,
      totalHoursText: formatMinutesToHours(minutesInvested),
      totalTasksCompleted: completedCount,
      totalTasksPlanned: totalTasks,
      progressPercent: calculatedProgress,
      isFullyCompleted,
      issueDate: lastCompletionDate.toISOString(),
      formattedIssueDate: format(lastCompletionDate, "d 'de' MMMM 'de' yyyy", { locale: es }),
      verificationCode,
      competencies,
      level: p.nivel_conocimiento || 'Intermedio',
      priority: p.prioridad || 'Normal',
    };
  });

  // 4. Certificado Global Acumulativo de Inversión Académica
  const globalVerificationCode = generateVerificationCode('GLB', user.id, user.id.slice(0, 8));
  const globalCertificate: TimeInvestmentCertificate = {
    id: `cert-glb-${user.id}`,
    type: 'global',
    studentName,
    title: 'Certificación Integral de Inversión y Esfuerzo Académico',
    objective:
      'Constancia oficial del volumen total de tiempo y dedicación efectiva invertido en proyectos de estudio en Komorebi Study Studio.',
    totalMinutesInvested: totalMinutesGlobal,
    totalHoursText: formatMinutesToHours(totalMinutesGlobal),
    totalTasksCompleted: totalTasksCompletedGlobal,
    totalTasksPlanned: allTasks.length,
    progressPercent: allTasks.length > 0 ? Math.round((totalTasksCompletedGlobal / allTasks.length) * 100) : 100,
    isFullyCompleted: totalCompletedProjectsCount > 0,
    issueDate: now.toISOString(),
    formattedIssueDate: format(now, "d 'de' MMMM 'de' yyyy", { locale: es }),
    verificationCode: globalVerificationCode,
    competencies: [
      'Gestión autónoma del tiempo y foco académico',
      'Cumplimiento sistemático de metas de aprendizaje',
      'Ejecución estructurada de proyectos universitarios',
      'Constancia y disciplina en sesiones de estudio',
    ],
    level: 'Avanzado / Trayectoria Activa',
  };

  return {
    totalMinutesAllProjects: totalMinutesGlobal,
    totalHoursAllProjectsText: formatMinutesToHours(totalMinutesGlobal),
    totalCompletedProjects: totalCompletedProjectsCount,
    totalActiveProjects: projects.length,
    totalTasksCompleted: totalTasksCompletedGlobal,
    certificates,
    globalCertificate,
  };
}
