import { TelegramSendResult } from './types';

/**
 * Espera un número determinado de milisegundos.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Envía un mensaje a un chat de Telegram utilizando native fetch.
 * Implementa backoff exponencial para 429 (Too Many Requests),
 * y rechaza sin reintentar si el usuario bloqueó el bot (403) o el chat_id es inválido (400).
 */
export async function sendTelegramNotification(
  chatId: string | number,
  text: string,
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token || token.trim() === '') {
    console.error('sendTelegramNotification: TELEGRAM_BOT_TOKEN no está configurado en las variables de entorno.');
    return {
      success: false,
      error: 'TELEGRAM_BOT_TOKEN no configurado.',
    };
  }

  const cleanChatId = String(chatId).trim();
  if (!cleanChatId) {
    return {
      success: false,
      error: 'telegram_chat_id no proporcionado o vacío.',
    };
  }

  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
  const maxAttempts = 3;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: cleanChatId,
          text: text,
        }),
      });

      const statusCode = response.status;
      const data = await response.json().catch(() => null);

      if (response.ok && data?.ok) {
        return {
          success: true,
          statusCode,
          retryCount: attempt - 1,
        };
      }

      // Si el chat_id es inválido o el usuario bloqueó el bot (400 / 403), no reintentar
      if (statusCode === 400 || statusCode === 403) {
        const desc = data?.description || 'Error del cliente de Telegram';
        console.warn(`[Telegram API] Intento a chat_id ${cleanChatId} falló sin reintento (${statusCode}): ${desc}`);
        return {
          success: false,
          error: desc,
          statusCode,
          retryCount: attempt - 1,
        };
      }

      // Manejo de rate limit 429 con backoff exponencial
      if (statusCode === 429) {
        const retryAfterSeconds = data?.parameters?.retry_after || Math.pow(2, attempt - 1);
        const waitMs = retryAfterSeconds * 1000;
        console.warn(`[Telegram API] 429 Too Many Requests para ${cleanChatId}. Reintentando en ${waitMs}ms (intento ${attempt}/${maxAttempts})...`);
        if (attempt < maxAttempts) {
          await sleep(waitMs);
          continue;
        }
      }

      // Errores 5xx o transitorios
      if (statusCode >= 500 && attempt < maxAttempts) {
        const waitMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        console.warn(`[Telegram API] Error de servidor (${statusCode}). Reintentando en ${waitMs}ms...`);
        await sleep(waitMs);
        continue;
      }

      return {
        success: false,
        error: data?.description || `HTTP ${statusCode}`,
        statusCode,
        retryCount: attempt - 1,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido de red';
      console.error(`[Telegram API] Error de conexión enviando a ${cleanChatId} (intento ${attempt}):`, message);

      if (attempt < maxAttempts) {
        const waitMs = Math.pow(2, attempt - 1) * 1000;
        await sleep(waitMs);
        continue;
      }

      return {
        success: false,
        error: message,
        retryCount: attempt - 1,
      };
    }
  }

  return {
    success: false,
    error: 'Excedido el número máximo de reintentos.',
    retryCount: maxAttempts,
  };
}
