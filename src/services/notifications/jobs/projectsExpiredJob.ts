import { getAdminClient } from '@/lib/supabase/admin';
import { sendTelegramNotification } from '../telegram.service';
import { wasSent, markAsSent } from '../notifications.service';
import { isProjectExpiredDate, toCaracasDateKey } from '../dateUtils';
import { JobExecutionResult } from '../types';

/**
 * Job: Proyecto expirado.
 * Disparado a las 00:00 America/Caracas por orquestador n8n.
 * Condición: completado = false y fecha_limite < hoy.
 * Mensaje: ❌-El proyecto "{titulo}" ha expirado. Fecha límite: {fecha_limite}
 * Deduplicación: único por (usuario_id, 'proyecto_expirado', proyecto_id).
 */
export async function runProjectsExpiredJob(): Promise<JobExecutionResult> {
  const result: JobExecutionResult = {
    enviados: 0,
    omitidos: 0,
    errores: 0,
    detalles: [],
  };

  const supabase = getAdminClient();
  if (!supabase) {
    console.error('[projectsExpiredJob] Error: no se pudo inicializar getAdminClient().');
    return { ...result, errores: 1 };
  }

  // 1. Consultar proyectos incompletos con fecha_limite definida
  const { data: projects, error: projError } = await supabase
    .from('projects')
    .select('id, user_id, titulo, fecha_limite, completado')
    .eq('completado', false)
    .not('fecha_limite', 'is', null);

  if (projError) {
    console.error('[projectsExpiredJob] Error al consultar projects:', projError);
    return { ...result, errores: 1 };
  }

  if (!projects || projects.length === 0) {
    return result;
  }

  const now = new Date();

  // 2. Filtrar proyectos cuya fecha límite ya pasó respecto a hoy en Caracas
  const expiredProjects = projects.filter((p) => isProjectExpiredDate(p.fecha_limite, now));

  if (expiredProjects.length === 0) {
    return result;
  }

  // 3. Obtener perfiles de usuarios de los proyectos expirados
  const userIds = Array.from(new Set(expiredProjects.map((p) => p.user_id)));
  const { data: profiles, error: profError } = await supabase
    .from('profiles')
    .select('id, telegram_chat_id')
    .in('id', userIds)
    .not('telegram_chat_id', 'is', null);

  if (profError) {
    console.error('[projectsExpiredJob] Error al consultar profiles:', profError);
    return { ...result, errores: 1 };
  }

  const userChatMap = new Map<string, string>();
  for (const prof of profiles || []) {
    if (prof.telegram_chat_id) {
      userChatMap.set(prof.id, prof.telegram_chat_id);
    }
  }

  // 4. Procesar envíos
  for (const project of expiredProjects) {
    const chatId = userChatMap.get(project.user_id);
    if (!chatId) {
      result.omitidos++;
      continue;
    }

    // Deduplicación única: solo se envía una vez por proyecto expirado
    const yaEnviado = await wasSent(project.user_id, 'proyecto_expirado', project.id);
    if (yaEnviado) {
      result.omitidos++;
      result.detalles?.push({
        usuario_id: project.user_id,
        tipo_evento: 'proyecto_expirado',
        referencia_id: project.id,
        resultado: 'omitido',
        motivo: 'Ya fue enviada previamente',
      });
      continue;
    }

    const fechaFormateada = toCaracasDateKey(project.fecha_limite);
    const mensaje = `❌-El proyecto "${project.titulo}" ha expirado. Fecha límite: ${fechaFormateada}`;

    const envio = await sendTelegramNotification(chatId, mensaje);

    if (envio.success) {
      await markAsSent(project.user_id, 'proyecto_expirado', project.id);
      result.enviados++;
      result.detalles?.push({
        usuario_id: project.user_id,
        tipo_evento: 'proyecto_expirado',
        referencia_id: project.id,
        resultado: 'enviado',
      });
    } else {
      result.errores++;
      result.detalles?.push({
        usuario_id: project.user_id,
        tipo_evento: 'proyecto_expirado',
        referencia_id: project.id,
        resultado: 'error',
        motivo: envio.error,
      });
    }
  }

  return result;
}
