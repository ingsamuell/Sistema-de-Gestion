import { getAdminClient } from '@/lib/supabase/admin';
import { sendTelegramNotification } from '../telegram.service';
import { wasSent, markAsSent } from '../notifications.service';
import { isProjectUpcomingWithin7Days, toCaracasDateKey } from '../dateUtils';
import { JobExecutionResult } from '../types';

/**
 * Job: Proyecto próximo a expirar (7 días o menos).
 * Disparado a las 08:00 America/Caracas por orquestador n8n.
 * Condición: completado = false y fecha_limite entre hoy y hoy + 7 días (no vencido).
 * Mensaje: ⚠️-El proyecto "{titulo}" está próximo a expirar. No se cumplieron todos los objetivos. Fecha límite: {fecha_limite}
 * Deduplicación: único por (usuario_id, 'proyecto_proximo', proyecto_id, fecha_envio::date).
 */
export async function runProjects7DaysJob(): Promise<JobExecutionResult> {
  const result: JobExecutionResult = {
    enviados: 0,
    omitidos: 0,
    errores: 0,
    detalles: [],
  };

  const supabase = getAdminClient();
  if (!supabase) {
    console.error('[projects7DaysJob] Error: no se pudo inicializar getAdminClient().');
    return { ...result, errores: 1 };
  }

  // 1. Consultar proyectos activos con fecha_limite definida
  const { data: projects, error: projError } = await supabase
    .from('projects')
    .select('id, user_id, titulo, fecha_limite, completado')
    .eq('completado', false)
    .not('fecha_limite', 'is', null);

  if (projError) {
    console.error('[projects7DaysJob] Error al consultar projects:', projError);
    return { ...result, errores: 1 };
  }

  if (!projects || projects.length === 0) {
    return result;
  }

  const now = new Date();

  // 2. Filtrar proyectos que expiran dentro de los próximos 7 días
  const upcomingProjects = projects.filter((p) => isProjectUpcomingWithin7Days(p.fecha_limite, now));

  if (upcomingProjects.length === 0) {
    return result;
  }

  // 3. Obtener los perfiles con telegram_chat_id de los dueños de proyectos
  const userIds = Array.from(new Set(upcomingProjects.map((p) => p.user_id)));
  const { data: profiles, error: profError } = await supabase
    .from('profiles')
    .select('id, telegram_chat_id')
    .in('id', userIds)
    .not('telegram_chat_id', 'is', null);

  if (profError) {
    console.error('[projects7DaysJob] Error al consultar profiles de los proyectos:', profError);
    return { ...result, errores: 1 };
  }

  const userChatMap = new Map<string, string>();
  for (const prof of profiles || []) {
    if (prof.telegram_chat_id) {
      userChatMap.set(prof.id, prof.telegram_chat_id);
    }
  }

  // 4. Procesar cada proyecto
  for (const project of upcomingProjects) {
    const chatId = userChatMap.get(project.user_id);
    if (!chatId) {
      // Usuario no tiene Telegram vinculado
      result.omitidos++;
      continue;
    }

    // Deduplicación diaria: solo 1 mensaje al día para este proyecto
    const yaEnviadoHoy = await wasSent(project.user_id, 'proyecto_proximo', project.id, now);
    if (yaEnviadoHoy) {
      result.omitidos++;
      result.detalles?.push({
        usuario_id: project.user_id,
        tipo_evento: 'proyecto_proximo',
        referencia_id: project.id,
        resultado: 'omitido',
        motivo: 'Ya fue enviada hoy para este proyecto',
      });
      continue;
    }

    const fechaFormateada = toCaracasDateKey(project.fecha_limite);
    const mensaje = `⚠️-El proyecto "${project.titulo}" está próximo a expirar. No se cumplieron todos los objetivos. Fecha límite: ${fechaFormateada}`;

    const envio = await sendTelegramNotification(chatId, mensaje);

    if (envio.success) {
      await markAsSent(project.user_id, 'proyecto_proximo', project.id);
      result.enviados++;
      result.detalles?.push({
        usuario_id: project.user_id,
        tipo_evento: 'proyecto_proximo',
        referencia_id: project.id,
        resultado: 'enviado',
      });
    } else {
      result.errores++;
      result.detalles?.push({
        usuario_id: project.user_id,
        tipo_evento: 'proyecto_proximo',
        referencia_id: project.id,
        resultado: 'error',
        motivo: envio.error,
      });
    }
  }

  return result;
}
