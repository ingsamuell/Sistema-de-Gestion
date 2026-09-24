import { getAdminClient } from '@/lib/supabase/admin';
import { NotificationEventType } from './types';
import { getCaracasDateKey } from './dateUtils';

/**
 * Verifica si una notificación ya fue enviada previamente para evitar duplicados.
 *
 * Reglas de deduplicación:
 * - 'proyecto_proximo': único por (usuario_id, 'proyecto_proximo', referencia_id, fecha_envio::date).
 * - Resto de eventos con referencia_id: único por (usuario_id, tipo_evento, referencia_id).
 * - Eventos sin referencia_id (racha): único por (usuario_id, tipo_evento) con referencia_id is null.
 */
export async function wasSent(
  usuarioId: string,
  tipoEvento: NotificationEventType,
  referenciaId?: string | null,
  fecha: Date | string | null = null,
): Promise<boolean> {
  const supabase = getAdminClient();
  if (!supabase) {
    console.warn('[notifications.service] No se pudo obtener el cliente admin de Supabase.');
    return false;
  }

  try {
    let query = supabase
      .from('notificaciones_enviadas')
      .select('id, fecha_envio')
      .eq('usuario_id', usuarioId)
      .eq('tipo_evento', tipoEvento);

    if (referenciaId) {
      query = query.eq('referencia_id', referenciaId);
    } else {
      query = query.is('referencia_id', null);
    }

    if (tipoEvento === 'proyecto_proximo') {
      const targetDate = fecha instanceof Date ? fecha : fecha ? new Date(fecha) : new Date();
      const caracasDateKey = getCaracasDateKey(targetDate);
      // Rango de todo el día en hora de Caracas (UTC-4)
      const startOfDay = new Date(`${caracasDateKey}T00:00:00-04:00`).toISOString();
      const endOfDay = new Date(`${caracasDateKey}T23:59:59.999-04:00`).toISOString();

      query = query.gte('fecha_envio', startOfDay).lte('fecha_envio', endOfDay);
    }

    const { data, error } = await query.limit(1);

    if (error) {
      console.error('[notifications.service] Error consultando notificaciones_enviadas:', error);
      return false;
    }

    return Boolean(data && data.length > 0);
  } catch (err) {
    console.error('[notifications.service] Error inesperado en wasSent:', err);
    return false;
  }
}

/**
 * Registra una notificación enviada en la tabla notificaciones_enviadas.
 * Captura códigos de error de Postgres:
 * - '23505' (unique violation): detecta colisión concurrente (deduplicado exitosamente).
 * - '23503' (foreign key violation): maneja el caso de transición si el FK antiguo en BD aún no fue eliminado.
 */
export async function markAsSent(
  usuarioId: string,
  tipoEvento: NotificationEventType,
  referenciaId?: string | null,
  fechaEnvio: string = new Date().toISOString(),
): Promise<boolean> {
  const supabase = getAdminClient();
  if (!supabase) {
    console.error('[notifications.service] Imposible registrar notificación: falta cliente admin de Supabase.');
    return false;
  }

  try {
    const payload = {
      usuario_id: usuarioId,
      tipo_evento: tipoEvento,
      referencia_id: referenciaId || null,
      fecha_envio: fechaEnvio,
    };

    const { error } = await supabase.from('notificaciones_enviadas').insert(payload);

    if (error) {
      // 23505: unique_violation (otra instancia envió y registró exactamente en el mismo instante)
      if (error.code === '23505') {
        console.info(`[notifications.service] Registro ya existente (violación única 23505) para usuario=${usuarioId} tipo=${tipoEvento}. Deduplicado.`);
        return true;
      }

      // 23503: foreign_key_violation (si la BD aún tiene referencia_id_fkey apuntando solo a tareas y es un proyecto)
      if (error.code === '23503' && referenciaId) {
        console.warn(
          `[notifications.service] Advertencia de FK en referencia_id (código 23503). Aplicando fallback registrando con referencia_id nulo para no perder la auditoría del usuario. (Asegúrate de ejecutar la migración 20260923000000_fix_notificaciones_enviadas_schema.sql en Supabase):`,
          error.message,
        );
        const { error: fallbackErr } = await supabase.from('notificaciones_enviadas').insert({
          ...payload,
          referencia_id: null,
        });
        return !fallbackErr;
      }

      console.error('[notifications.service] Error insertando en notificaciones_enviadas:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[notifications.service] Error inesperado en markAsSent:', err);
    return false;
  }
}
