import { getAdminClient } from '@/lib/supabase/admin';
import { sendTelegramNotification } from '../telegram.service';
import { wasSent, markAsSent } from '../notifications.service';
import { isInStreak3hWindow } from '../dateUtils';
import { JobExecutionResult } from '../types';

/**
 * Job: Racha próxima a expirar (3 horas antes).
 * Disparado a las 21:00 America/Caracas por orquestador n8n.
 * Condición: racha_expira_en en ventana [2h45m, 3h15m] desde ahora.
 * Mensaje: 🔥-¡Tu racha expira en 3 horas! Racha actual: {racha_activa} días
 */
export async function runStreak3hJob(): Promise<JobExecutionResult> {
  const result: JobExecutionResult = {
    enviados: 0,
    omitidos: 0,
    errores: 0,
    detalles: [],
  };

  const supabase = getAdminClient();
  if (!supabase) {
    console.error('[streak3hJob] Error: no se pudo inicializar getAdminClient().');
    return { ...result, errores: 1 };
  }

  // 1. Consultar usuarios con telegram_chat_id configurado y racha_expira_en no nula
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, telegram_chat_id, racha_activa, racha_expira_en')
    .not('telegram_chat_id', 'is', null)
    .not('racha_expira_en', 'is', null);

  if (error) {
    console.error('[streak3hJob] Error al consultar profiles:', error);
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

    // Verificar si cae en la ventana de 3 horas (165 a 195 min)
    if (!isInStreak3hWindow(expiraEn, now)) {
      result.omitidos++;
      continue;
    }

    // Deduplicación: único por (usuario_id, 'racha_3h', NULL)
    const yaEnviado = await wasSent(userId, 'racha_3h', null);
    if (yaEnviado) {
      result.omitidos++;
      result.detalles?.push({
        usuario_id: userId,
        tipo_evento: 'racha_3h',
        referencia_id: null,
        resultado: 'omitido',
        motivo: 'Ya fue enviada previamente',
      });
      continue;
    }

    const rachaActiva = Number(user.racha_activa) || 0;
    const mensaje = `🔥-¡Tu racha expira en 3 horas! Racha actual: ${rachaActiva} días`;

    const envio = await sendTelegramNotification(chatId, mensaje);

    if (envio.success) {
      await markAsSent(userId, 'racha_3h', null);
      result.enviados++;
      result.detalles?.push({
        usuario_id: userId,
        tipo_evento: 'racha_3h',
        referencia_id: null,
        resultado: 'enviado',
      });
    } else {
      result.errores++;
      result.detalles?.push({
        usuario_id: userId,
        tipo_evento: 'racha_3h',
        referencia_id: null,
        resultado: 'error',
        motivo: envio.error,
      });
    }
  }

  return result;
}
