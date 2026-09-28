import { getAdminClient } from '@/lib/supabase/admin';
import { sendTelegramNotification } from '../telegram.service';
import { wasSent, markAsSent } from '../notifications.service';
import { isStreakExpired } from '../dateUtils';
import { JobExecutionResult } from '../types';

/**
 * Job: Racha expirada.
 * Disparado a las 00:00 America/Caracas por orquestador n8n.
 * Condición: racha_expira_en < now() y racha_activa > 0.
 * Mensaje: 💔-Tu racha ha expirado. ¡Empieza una nueva hoy!
 */
export async function runStreakExpiredJob(): Promise<JobExecutionResult> {
  const result: JobExecutionResult = {
    enviados: 0,
    omitidos: 0,
    errores: 0,
    detalles: [],
  };

  const supabase = getAdminClient();
  if (!supabase) {
    console.error('[streakExpiredJob] Error: no se pudo inicializar getAdminClient().');
    return { ...result, errores: 1 };
  }

  // Consultar perfiles con chat de Telegram, racha activa mayor a 0 y racha_expira_en no nula
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, telegram_chat_id, racha_activa, racha_expira_en')
    .not('telegram_chat_id', 'is', null)
    .gt('racha_activa', 0)
    .not('racha_expira_en', 'is', null);

  if (error) {
    console.error('[streakExpiredJob] Error al consultar profiles:', error);
    return { ...result, errores: 1 };
  }

  if (!profiles || profiles.length === 0) {
    return result;
  }

  const now = new Date();

  for (const user of profiles) {
    const userId = user.id;
    const chatId = user.telegram_chat_id;
    const expiraEn = user.racha_expira_en;

    // Verificar si la fecha de expiración ya fue superada
    if (!isStreakExpired(expiraEn, now)) {
      result.omitidos++;
      continue;
    }

    // Deduplicación: único por (usuario_id, 'racha_expirada', NULL)
    const yaEnviado = await wasSent(userId, 'racha_expirada', null);
    if (yaEnviado) {
      result.omitidos++;
      result.detalles?.push({
        usuario_id: userId,
        tipo_evento: 'racha_expirada',
        referencia_id: null,
        resultado: 'omitido',
        motivo: 'Ya fue enviada previamente',
      });
      continue;
    }

    const mensaje = `💔-Tu racha ha expirado. ¡Empieza una nueva hoy!`;
    const envio = await sendTelegramNotification(chatId, mensaje);

    if (envio.success) {
      await markAsSent(userId, 'racha_expirada', null);
      result.enviados++;
      result.detalles?.push({
        usuario_id: userId,
        tipo_evento: 'racha_expirada',
        referencia_id: null,
        resultado: 'enviado',
      });
    } else {
      result.errores++;
      result.detalles?.push({
        usuario_id: userId,
        tipo_evento: 'racha_expirada',
        referencia_id: null,
        resultado: 'error',
        motivo: envio.error,
      });
    }
  }

  return result;
}
