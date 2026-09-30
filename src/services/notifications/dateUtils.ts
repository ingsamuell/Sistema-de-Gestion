export const CARACAS_TIMEZONE = 'America/Caracas';

/**
 * Devuelve la clave de fecha YYYY-MM-DD en zona horaria America/Caracas.
 */
export function getCaracasDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CARACAS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Retorna la fecha YYYY-MM-DD actual en zona horaria America/Caracas.
 */
export function getCaracasToday(): string {
  return getCaracasDateKey(new Date());
}

/**
 * Retorna el ISO timestamp de las próximas 12 AM (mañana) en Caracas.
 * Ejemplo: Si hoy es Lunes, retorna el timestamp de Martes 00:00:00 VET.
 */
export function getCaracasNextMidnightISO(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CARACAS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;

  const caracasMidnightToday = new Date(`${y}-${m}-${d}T00:00:00.000-04:00`);
  const nextMidnight = new Date(caracasMidnightToday.getTime() + 24 * 60 * 60 * 1000);
  return nextMidnight.toISOString();
}

/**
 * Calcula la diferencia en minutos entre una fecha futura y el momento actual.
 * Valor positivo significa que la fecha está en el futuro.
 */
export function getMinutesUntil(futureDateStr: string | Date, now: Date = new Date()): number {
  const target = new Date(futureDateStr).getTime();
  const current = now.getTime();
  if (Number.isNaN(target)) return -1;
  return Math.round((target - current) / (60 * 1000));
}

/**
 * Determina si la racha expira en una ventana de ~3 horas
 * (entre 2h45m = 165 minutos y 3h15m = 195 minutos).
 */
export function isInStreak3hWindow(
  rachaExpiraEn: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!rachaExpiraEn) return false;
  const diffMinutes = getMinutesUntil(rachaExpiraEn, now);
  return diffMinutes >= 165 && diffMinutes <= 195;
}

/**
 * Determina si una racha ya expiró respecto al momento actual.
 */
export function isStreakExpired(
  rachaExpiraEn: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!rachaExpiraEn) return false;
  const targetTime = new Date(rachaExpiraEn).getTime();
  if (Number.isNaN(targetTime)) return false;
  return targetTime < now.getTime();
}

/**
 * Convierte cualquier fecha o string a clave YYYY-MM-DD en America/Caracas.
 */
export function toCaracasDateKey(dateInput: string | Date): string {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return String(dateInput).slice(0, 10);
  return getCaracasDateKey(d);
}

/**
 * Comprueba si la fecha límite de un proyecto está dentro de los próximos 7 días
 * (fecha_limite >= hoy y fecha_limite <= hoy + 7 días) en zona America/Caracas.
 */
export function isProjectUpcomingWithin7Days(
  fechaLimite: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!fechaLimite) return false;
  const todayKey = getCaracasDateKey(now);
  const targetKey = toCaracasDateKey(fechaLimite);

  if (targetKey < todayKey) return false; // ya venció

  const today = new Date(`${todayKey}T00:00:00-04:00`);
  const maxDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const maxKey = getCaracasDateKey(maxDate);

  return targetKey >= todayKey && targetKey <= maxKey;
}

/**
 * Comprueba si la fecha límite de un proyecto ya venció (fecha_limite < hoy) en America/Caracas.
 */
export function isProjectExpiredDate(
  fechaLimite: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!fechaLimite) return false;
  const todayKey = getCaracasDateKey(now);
  const targetKey = toCaracasDateKey(fechaLimite);
  return targetKey < todayKey;
}
