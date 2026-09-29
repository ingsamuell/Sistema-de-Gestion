/**
 * Calcula la fecha_limite de una tarea sumando su duración en minutos a su fecha_inicio.
 * fecha_limite = fecha_inicio + duracion (en minutos)
 */
export function calculateTaskDeadline(
  fechaInicio?: string | null,
  duracionMinutos?: number | null,
): string | null {
  if (!fechaInicio) return null;
  const startMs = new Date(fechaInicio).getTime();
  if (Number.isNaN(startMs)) return null;

  const duration = Math.max(1, Math.round(Number(duracionMinutos)) || 30);
  return new Date(startMs + duration * 60 * 1000).toISOString();
}
