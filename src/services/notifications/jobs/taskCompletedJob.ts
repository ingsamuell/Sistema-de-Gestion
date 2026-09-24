import { getAdminClient } from '@/lib/supabase/admin';
import { sendTelegramNotification } from '../telegram.service';
import { wasSent, markAsSent } from '../notifications.service';
import { JobExecutionResult } from '../types';

export interface TaskCompletedPayload {
  tarea_id?: string;
  id?: string;
  emoji?: string;
  type?: string;
  table?: string;
  record?: {
    id?: string;
    id_proyecto?: string;
    proyecto_id?: string;
    titulo?: string;
    completado?: boolean;
    emoji?: string;
  };
  old_record?: {
    completado?: boolean;
  };
}

/**
 * Extrae el primer emoji presente en un texto, si existe.
 */
function extractEmoji(text?: string): string | null {
  if (!text) return null;
  const match = text.match(/\p{Extended_Pictographic}/u);
  return match ? match[0] : null;
}

/**
 * Borra los bloques correspondientes a la tarea en el calendario (tabla eventos_calendario).
 * Cumple con la petición especial:
 * "Cuando se marque una tarea como completada, se borre automáticamente sus bloques respectivos en el calendario".
 */
export async function deleteCalendarBlocksForTask(taskId: string): Promise<number> {
  const supabase = getAdminClient();
  if (!supabase || !taskId) return 0;

  try {
    const { data: deleted, error } = await supabase
      .from('eventos_calendario')
      .delete()
      .eq('tarea_id', taskId)
      .select('id');

    if (error) {
      console.warn(`[taskCompletedJob] Aviso eliminando eventos de calendario para tarea ${taskId}:`, error.message);
      return 0;
    }

    const count = deleted?.length || 0;
    if (count > 0) {
      console.info(`[taskCompletedJob] Se eliminaron ${count} bloque(s) de calendario asociados a la tarea ${taskId}.`);
    }
    return count;
  } catch (err) {
    console.error(`[taskCompletedJob] Error eliminando bloques de calendario para tarea ${taskId}:`, err);
    return 0;
  }
}

/**
 * Job: Tarea completada.
 * Disparado por Webhook de Supabase (reenviado por n8n) al marcar completado = true.
 * - Borra automáticamente los bloques respectivos de la tarea en el calendario.
 * - Notifica al usuario dueño del proyecto por Telegram: {emoji}-Tarea completada: {titulo_tarea} (Proyecto: {nombre_proyecto})
 * - Deduplica por (usuario_id, 'tarea_completada', tarea_id).
 */
export async function runTaskCompletedJob(payload: TaskCompletedPayload): Promise<JobExecutionResult> {
  const result: JobExecutionResult = {
    enviados: 0,
    omitidos: 0,
    errores: 0,
    detalles: [],
  };

  const supabase = getAdminClient();
  if (!supabase) {
    console.error('[taskCompletedJob] Error: no se pudo inicializar getAdminClient().');
    return { ...result, errores: 1 };
  }

  // 1. Extraer ID de la tarea desde distintos formatos de payload de Supabase Webhook o llamada directa
  const taskId =
    payload.tarea_id ||
    payload.id ||
    payload.record?.id;

  if (!taskId) {
    console.warn('[taskCompletedJob] Payload no contiene tarea_id o id:', payload);
    return {
      ...result,
      errores: 1,
      detalles: [{
        usuario_id: 'desconocido',
        tipo_evento: 'tarea_completada',
        referencia_id: null,
        resultado: 'error',
        motivo: 'Falta tarea_id en el payload',
      }],
    };
  }

  // 2. Eliminar automáticamente los bloques de calendario de esta tarea completada
  await deleteCalendarBlocksForTask(taskId);

  // 3. Consultar la tarea en la base de datos para obtener id_proyecto, titulo y completado
  const { data: task, error: taskError } = await supabase
    .from('tareas')
    .select('id, id_proyecto, titulo, completado')
    .eq('id', taskId)
    .maybeSingle();

  if (taskError || !task) {
    console.error(`[taskCompletedJob] Tarea ${taskId} no encontrada en BD:`, taskError);
    return {
      ...result,
      errores: 1,
      detalles: [{
        usuario_id: 'desconocido',
        tipo_evento: 'tarea_completada',
        referencia_id: taskId,
        resultado: 'error',
        motivo: 'Tarea no encontrada en la base de datos',
      }],
    };
  }

  // Si en la base de datos la tarea no está completada (o fue desmarcada), omitir notificación
  if (task.completado !== true) {
    result.omitidos++;
    result.detalles?.push({
      usuario_id: 'desconocido',
      tipo_evento: 'tarea_completada',
      referencia_id: taskId,
      resultado: 'omitido',
      motivo: 'La tarea no tiene completado = true',
    });
    return result;
  }

  // 4. Consultar el proyecto al que pertenece la tarea para obtener user_id y titulo
  const { data: project, error: projError } = await supabase
    .from('projects')
    .select('id, user_id, titulo')
    .eq('id', task.id_proyecto)
    .maybeSingle();

  if (projError || !project) {
    console.error(`[taskCompletedJob] Proyecto ${task.id_proyecto} no encontrado:`, projError);
    return {
      ...result,
      errores: 1,
      detalles: [{
        usuario_id: 'desconocido',
        tipo_evento: 'tarea_completada',
        referencia_id: taskId,
        resultado: 'error',
        motivo: 'Proyecto no encontrado',
      }],
    };
  }

  const userId = project.user_id;

  // 5. Consultar telegram_chat_id del usuario
  const { data: profile, error: profError } = await supabase
    .from('profiles')
    .select('id, telegram_chat_id')
    .eq('id', userId)
    .maybeSingle();

  if (profError || !profile?.telegram_chat_id) {
    result.omitidos++;
    result.detalles?.push({
      usuario_id: userId,
      tipo_evento: 'tarea_completada',
      referencia_id: taskId,
      resultado: 'omitido',
      motivo: 'El usuario no tiene telegram_chat_id vinculado',
    });
    return result;
  }

  // 6. Deduplicación: único por (usuario_id, 'tarea_completada', tarea_id)
  const yaEnviado = await wasSent(userId, 'tarea_completada', taskId);
  if (yaEnviado) {
    result.omitidos++;
    result.detalles?.push({
      usuario_id: userId,
      tipo_evento: 'tarea_completada',
      referencia_id: taskId,
      resultado: 'omitido',
      motivo: 'Ya fue enviada previamente para esta tarea',
    });
    return result;
  }

  // 7. Determinar emoji (fallback: 📝)
  const payloadEmoji = payload.emoji || payload.record?.emoji;
  const emoji = payloadEmoji || extractEmoji(task.titulo) || '📝';

  // 8. Construir mensaje en formato {emoji}-{texto}
  const mensaje = `${emoji}-Tarea completada: ${task.titulo} (Proyecto: ${project.titulo})`;

  const envio = await sendTelegramNotification(profile.telegram_chat_id, mensaje);

  if (envio.success) {
    await markAsSent(userId, 'tarea_completada', taskId);
    result.enviados++;
    result.detalles?.push({
      usuario_id: userId,
      tipo_evento: 'tarea_completada',
      referencia_id: taskId,
      resultado: 'enviado',
    });
  } else {
    result.errores++;
    result.detalles?.push({
      usuario_id: userId,
      tipo_evento: 'tarea_completada',
      referencia_id: taskId,
      resultado: 'error',
      motivo: envio.error,
    });
  }

  return result;
}
