import { GoogleGenAI } from '@google/genai';

interface GeminiKeySlot {
  key: string;
  exhaustedUntil: number; // timestamp ms
  client: GoogleGenAI;
}

let keySlots: GeminiKeySlot[] = [];
let activeSlotIndex = 0;

/**
 * Carga o refresca las claves configuradas desde las variables de entorno.
 * Soporta GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3 y GEMINI_API_KEYS (separadas por comas).
 */
function initializeKeyPool(): void {
  const rawKeys: string[] = [];

  const mainKey = process.env.GEMINI_API_KEY?.trim();
  if (mainKey) rawKeys.push(mainKey);

  // Soporte dinámico para GEMINI_API_KEY_2 hasta GEMINI_API_KEY_10
  for (let i = 2; i <= 10; i++) {
    const keyN = process.env[`GEMINI_API_KEY_${i}`]?.trim();
    if (keyN) rawKeys.push(keyN);
  }

  const commaKeys = process.env.GEMINI_API_KEYS?.split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  if (commaKeys && commaKeys.length > 0) {
    rawKeys.push(...commaKeys);
  }

  // Eliminar duplicados manteniendo orden
  const uniqueKeys = Array.from(new Set(rawKeys.filter(Boolean)));

  if (uniqueKeys.length === 0) {
    throw new Error('No hay ninguna GEMINI_API_KEY configurada en las variables de entorno.');
  }

  // Si las keys cambiaron o se inicializa por primera vez
  const existingMap = new Map(keySlots.map((s) => [s.key, s]));
  keySlots = uniqueKeys.map((key) => {
    const existing = existingMap.get(key);
    if (existing) return existing;
    return {
      key,
      exhaustedUntil: 0,
      client: new GoogleGenAI({ apiKey: key }),
    };
  });

  if (activeSlotIndex >= keySlots.length) {
    activeSlotIndex = 0;
  }
}

/**
 * Devuelve el cliente actual de Gemini disponible en el pool.
 */
export function getGeminiClient(): GoogleGenAI {
  if (keySlots.length === 0) {
    initializeKeyPool();
  }

  const now = Date.now();
  // Buscar el primer slot disponible a partir del índice activo
  for (let i = 0; i < keySlots.length; i++) {
    const idx = (activeSlotIndex + i) % keySlots.length;
    if (keySlots[idx].exhaustedUntil <= now) {
      activeSlotIndex = idx;
      return keySlots[idx].client;
    }
  }

  // Si todas están temporalmente agotadas, devolver el slot activo pero advertir
  console.warn(
    '[Gemini Pool] Todas las claves configuradas han alcanzado límite de cuota recientemente.',
  );
  return keySlots[activeSlotIndex].client;
}

/**
 * Marca la clave activa como agotada por cuota (RESOURCE_EXHAUSTED / 429) y rota al siguiente cliente.
 * @param cooldownMs Tiempo en ms antes de volver a intentar con esta clave (por defecto 1 hora)
 * @returns true si se encontró otra clave disponible en el pool, false si todas están agotadas
 */
export function markActiveKeyExhaustedAndRotate(cooldownMs = 60 * 60 * 1000): boolean {
  if (keySlots.length === 0) {
    initializeKeyPool();
  }

  const now = Date.now();
  const currentSlot = keySlots[activeSlotIndex];
  currentSlot.exhaustedUntil = now + cooldownMs;
  const maskedKey = currentSlot.key.slice(0, 6) + '...' + currentSlot.key.slice(-4);

  console.warn(
    `[Gemini Pool] Clave ${activeSlotIndex + 1}/${keySlots.length} (${maskedKey}) marcada como agotada por ${Math.round(
      cooldownMs / 60000,
    )} min. Rotando...`,
  );

  // Buscar si hay otra clave con cuota libre
  for (let i = 1; i < keySlots.length; i++) {
    const nextIdx = (activeSlotIndex + i) % keySlots.length;
    if (keySlots[nextIdx].exhaustedUntil <= now) {
      activeSlotIndex = nextIdx;
      const nextMasked =
        keySlots[nextIdx].key.slice(0, 6) + '...' + keySlots[nextIdx].key.slice(-4);
      console.info(
        `[Gemini Pool] Cambiado exitosamente a Clave ${nextIdx + 1}/${keySlots.length} (${nextMasked})`,
      );
      return true;
    }
  }

  console.error('[Gemini Pool] Se han agotado todas las claves de Gemini configuradas en el pool.');
  return false;
}

/**
 * Retorna la cantidad total de claves configuradas en el pool.
 */
export function getGeminiKeyCount(): number {
  if (keySlots.length === 0) {
    try {
      initializeKeyPool();
    } catch {
      return 0;
    }
  }
  return keySlots.length;
}

export const GEMINI_DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
export const GEMINI_FALLBACK_MODEL = 'gemini-3.6-flash';
export const GEMINI_LITE_MODEL = 'gemini-3.5-flash-lite';
