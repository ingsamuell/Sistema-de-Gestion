import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  extractScheduleFromImageWithGemini,
  rescheduleConflictingCalendarTasksWithGemini,
} from '@/services/ai/scheduleAiService';
import { z } from 'zod';
import { eachDayOfInterval, endOfMonth, parseISO, format, addDays } from 'date-fns';

const extractScheduleBodySchema = z.object({
  base64Data: z.string().min(1, 'El contenido base64 es requerido'),
  mimeType: z.string().min(1, 'El mimeType es requerido'),
  guardarEnDisponibilidad: z.boolean().optional().default(true),
  categoria: z.enum(['trabajo', 'estudio']).optional(),
  replicarOpcion: z.enum(['mes', 'todos', 'semanas']).optional().default('todos'),
  semanasEspecificas: z.array(z.string()).optional(),
  mesEspecifico: z.number().optional(),
  anoEspecifico: z.number().optional(),
});

/**
 * POST /api/calendar/extract-schedule
 * Recibe una imagen (PNG, JPG, WEBP) o documento PDF del horario académico/laboral,
 * utiliza Gemini con visión multimodal para extraer las materias y horas,
 * opcionalmente guarda los bloques en 'bloques_disponibilidad', evalúa si hay
 * tareas asignadas en conflicto y las reagenda automáticamente con IA,
 * retornando los bloques y el resultado del reagendamiento.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado. Inicia sesión.' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = extractScheduleBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: parsed.error.issues },
        { status: 400 },
      );
    }

    const {
      base64Data,
      mimeType,
      guardarEnDisponibilidad,
      categoria,
      replicarOpcion,
      semanasEspecificas,
      mesEspecifico,
      anoEspecifico,
    } = parsed.data;

    // Ejecutar extracción con visión multimodal de Gemini
    const resultado = await extractScheduleFromImageWithGemini({
      base64Data,
      mimeType,
      usuarioId: user.id,
    });

    // Si el usuario especificó categoría explícita ("trabajo" o "estudio"), asignarla a todos los bloques
    const bloquesConCategoria = resultado.bloques.map((b) => ({
      ...b,
      tipo: categoria || b.tipo,
    }));

    let reagendamientoResult = null;

    if (guardarEnDisponibilidad && bloquesConCategoria.length > 0) {
      // 1. Eliminar bloques previos de estudio y trabajo en bloques_disponibilidad
      const { error: deleteDispErr } = await supabase
        .from('bloques_disponibilidad')
        .delete()
        .eq('usuario_id', user.id)
        .in('tipo', ['estudio', 'trabajo', 'estudiando']);

      if (deleteDispErr) {
        console.warn('Advertencia eliminando bloques de bloques_disponibilidad:', deleteDispErr);
      }

      // 2. Eliminar bloques previos de estudio y trabajo en calendar_availability
      try {
        const { data: calData } = await supabase
          .from('calendar_availability')
          .select('availability')
          .eq('user_id', user.id)
          .single();

        if (calData?.availability?.blocks) {
          const newBlocks = calData.availability.blocks.filter(
            (b: { type?: string }) =>
              b.type !== 'estudio' && b.type !== 'trabajo' && b.type !== 'estudiando',
          );
          await supabase
            .from('calendar_availability')
            .update({ availability: { blocks: newBlocks } })
            .eq('user_id', user.id);
        }
      } catch (calErr) {
        console.warn('Advertencia limpiando calendar_availability:', calErr);
      }

      let inserts: {
        usuario_id: string;
        dia_semana?: number;
        fecha_especifica?: string;
        hora_inicio: string;
        hora_fin: string;
        tipo: string;
        origen: 'extraido_ia';
      }[] = [];

      if (replicarOpcion === 'todos') {
        inserts = bloquesConCategoria.map((b) => ({
          usuario_id: user.id,
          dia_semana: b.dia_semana,
          hora_inicio: b.hora_inicio,
          hora_fin: b.hora_fin,
          tipo: b.tipo,
          origen: 'extraido_ia',
        }));
      } else {
        const today = new Date();
        let targetDates: Date[] = [];

        if (replicarOpcion === 'mes') {
          const targetMonth = mesEspecifico !== undefined ? mesEspecifico : today.getMonth();
          const targetYear =
            anoEspecifico !== undefined
              ? anoEspecifico
              : targetMonth < today.getMonth()
                ? today.getFullYear() + 1
                : today.getFullYear();
          const targetDate = new Date(targetYear, targetMonth, 1);
          targetDates = eachDayOfInterval({ start: targetDate, end: endOfMonth(targetDate) });
        } else if (replicarOpcion === 'semanas' && semanasEspecificas) {
          semanasEspecificas.forEach((weekStartIso) => {
            const weekStart = parseISO(weekStartIso);
            const weekDates = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
            targetDates.push(...weekDates);
          });
        }

        bloquesConCategoria.forEach((b) => {
          const matchingDates = targetDates.filter((d) => d.getDay() === b.dia_semana);
          matchingDates.forEach((d) => {
            inserts.push({
              usuario_id: user.id,
              fecha_especifica: format(d, 'yyyy-MM-dd'),
              hora_inicio: b.hora_inicio,
              hora_fin: b.hora_fin,
              tipo: b.tipo,
              origen: 'extraido_ia',
            });
          });
        });
      }

      const { error: insertErr } = await supabase.from('bloques_disponibilidad').insert(inserts);

      if (insertErr) {
        console.warn('Advertencia guardando bloques en bloques_disponibilidad:', insertErr);
      }

      // Reagendar automáticamente cualquier tarea que colisione con el nuevo horario
      try {
        reagendamientoResult = await rescheduleConflictingCalendarTasksWithGemini(user.id);
      } catch (rescheduleErr) {
        console.warn('Aviso reagendando tareas en conflicto tras subir horario:', rescheduleErr);
      }
    }

    return NextResponse.json({
      success: true,
      bloques: bloquesConCategoria,
      observaciones: resultado.observaciones || null,
      reagendamiento: reagendamientoResult,
    });
  } catch (error) {
    console.error('Error en POST /api/calendar/extract-schedule:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error procesando horario con IA',
      },
      { status: 500 },
    );
  }
}
