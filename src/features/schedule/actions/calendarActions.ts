'use server';

import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export interface CalendarEventItem {
  id: string;
  usuario_id: string;
  proyecto_id?: string | null;
  tarea_id?: string | null;
  titulo: string;
  descripcion?: string | null;
  inicio: string;
  fin: string;
  estado: string;
  generado_por_ia: boolean;
}

export interface AvailabilityBlockItem {
  id: string;
  usuario_id: string;
  dia_semana: number | null;
  fecha_especifica?: string | null;
  hora_inicio: string;
  hora_fin: string;
  tipo: 'ocupado' | 'tareas' | 'estudio' | 'trabajo' | 'otra_actividad';
  origen: string;
}

/**
 * Carga todos los eventos de calendario y bloques de disponibilidad del usuario autenticado.
 */
export async function getCalendarDataAction() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'No autenticado', events: [], availabilities: [] };
    }

    const adminDb = getAdminClient();
    const db = adminDb || supabase;

    // Consultar eventos de calendario (tareas programadas por IA o usuario)
    const { data: events, error: eventsErr } = await db
      .from('eventos_calendario')
      .select('*')
      .eq('usuario_id', user.id)
      .neq('estado', 'cancelado')
      .order('inicio', { ascending: true });

    if (eventsErr) {
      console.warn('Error al cargar eventos_calendario:', eventsErr);
    }

    const eventList: CalendarEventItem[] = (events as CalendarEventItem[]) || [];

    // Sincronizar de forma resiliente cualquier tarea del usuario con fecha_inicio que no tenga aún eventos_calendario
    try {
      const { data: userProjects } = await db.from('projects').select('id').eq('user_id', user.id);

      const projectIds = (userProjects || []).map((p) => p.id);
      if (projectIds.length > 0) {
        const { data: tareasList } = await db
          .from('tareas')
          .select('id, id_proyecto, titulo, descripcion, fecha_inicio, duracion, completado')
          .in('id_proyecto', projectIds)
          .eq('completado', false)
          .not('fecha_inicio', 'is', null);

        if (tareasList && tareasList.length > 0) {
          const existingTareaIds = new Set(
            eventList.filter((e) => e.tarea_id).map((e) => e.tarea_id),
          );

          const missingEvents: CalendarEventItem[] = [];

          for (const t of tareasList) {
            if (!t.fecha_inicio || existingTareaIds.has(t.id)) continue;

            const startD = new Date(t.fecha_inicio);
            if (isNaN(startD.getTime())) continue;

            const durMin = Math.max(15, Number(t.duracion) || 30);
            const endD = new Date(startD.getTime() + durMin * 60 * 1000);
            const newEvent: CalendarEventItem = {
              id: crypto.randomUUID(),
              usuario_id: user.id,
              proyecto_id: t.id_proyecto,
              tarea_id: t.id,
              titulo: t.titulo,
              descripcion: t.descripcion || '',
              inicio: startD.toISOString(),
              fin: endD.toISOString(),
              estado: 'pendiente',
              generado_por_ia: false,
            };

            missingEvents.push(newEvent);
            eventList.push(newEvent);
          }

          if (missingEvents.length > 0) {
            const { error: insertErr } = await db.from('eventos_calendario').insert(missingEvents);
            if (insertErr) {
              console.warn('Aviso insertando eventos huérfanos:', insertErr);
            }
          }
        }
      }
    } catch (syncErr) {
      console.warn('Aviso sincronizando tareas hacia calendario:', syncErr);
    }

    // Consultar bloques de disponibilidad guardados en Supabase
    const { data: availabilities, error: availErr } = await db
      .from('bloques_disponibilidad')
      .select('*')
      .eq('usuario_id', user.id)
      .order('dia_semana', { ascending: true });

    if (availErr) {
      console.warn('Error al cargar bloques_disponibilidad:', availErr);
    }

    // Consultar calendar_availability para recuperar nombres y categorías personalizados
    let customBlocks: Array<{
      date: string;
      startTime: string;
      endTime: string;
      label: string;
      type: string;
      color?: string | null;
      origen?: string;
    }> = [];

    try {
      const { data: calAvailData, error: calAvailErr } = await db
        .from('calendar_availability')
        .select('availability')
        .eq('user_id', user.id)
        .maybeSingle();

      if (
        !calAvailErr &&
        calAvailData?.availability &&
        typeof calAvailData.availability === 'object'
      ) {
        const availObj = calAvailData.availability as {
          blocks?: Array<{
            date: string;
            startTime: string;
            endTime: string;
            label: string;
            type: string;
            color?: string | null;
            origen?: string;
          }>;
        };
        if (Array.isArray(availObj.blocks)) {
          customBlocks = availObj.blocks;
        }
      }
    } catch (calErr) {
      console.warn('Aviso cargando calendar_availability:', calErr);
    }

    return {
      success: true,
      events: eventList,
      availabilities: (availabilities as AvailabilityBlockItem[]) || [],
      customBlocks,
    };
  } catch (error) {
    console.error('Error en getCalendarDataAction:', error);
    return {
      success: false,
      error: 'Error al consultar calendario',
      events: [],
      availabilities: [],
      customBlocks: [],
    };
  }
}

/**
 * Elimina un evento o bloque específico del calendario en Supabase
 */
export async function deleteCalendarEventAction(eventId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'No autenticado' };
    }

    const adminDb = getAdminClient();
    const db = adminDb || supabase;

    await db.from('eventos_calendario').delete().eq('id', eventId).eq('usuario_id', user.id);

    revalidatePath('/calendario');
    return { success: true };
  } catch (error) {
    console.error('Error en deleteCalendarEventAction:', error);
    return { success: false, error: 'Error al eliminar evento' };
  }
}

/**
 * Actualiza el horario de inicio y fin de un evento (usado por Drag & Drop en el calendario)
 * y sincroniza de forma inmediata la tarea correspondiente en la tabla 'tareas'.
 */
export async function updateCalendarEventScheduleAction(input: {
  eventId: string;
  inicio: string;
  fin: string;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'No autenticado' };
    }

    const adminDb = getAdminClient();
    const db = adminDb || supabase;

    // Obtener el evento para verificar pertenencia y recuperar tarea_id y proyecto_id
    const { data: existingEvent, error: findErr } = await db
      .from('eventos_calendario')
      .select('id, tarea_id, proyecto_id, usuario_id')
      .eq('id', input.eventId)
      .eq('usuario_id', user.id)
      .maybeSingle();

    if (findErr || !existingEvent) {
      return { success: false, error: 'Evento no encontrado o sin permisos' };
    }

    // Actualizar inicio y fin en eventos_calendario
    const { error: updateEvErr } = await db
      .from('eventos_calendario')
      .update({
        inicio: input.inicio,
        fin: input.fin,
      })
      .eq('id', input.eventId)
      .eq('usuario_id', user.id);

    if (updateEvErr) {
      return { success: false, error: updateEvErr.message };
    }

    // Si tiene tarea_id, sincronizar en la tabla tareas
    if (existingEvent.tarea_id) {
      const startMs = new Date(input.inicio).getTime();
      const endMs = new Date(input.fin).getTime();
      const durationMin = Math.max(5, Math.round((endMs - startMs) / (60 * 1000)));

      await db
        .from('tareas')
        .update({
          fecha_inicio: input.inicio,
          duracion: durationMin,
        })
        .eq('id', existingEvent.tarea_id);
    }

    revalidatePath('/calendario');
    if (existingEvent.proyecto_id) {
      revalidatePath(`/proyectos/${existingEvent.proyecto_id}`);
    }
    revalidatePath('/proyectos');

    return { success: true };
  } catch (error) {
    console.error('Error en updateCalendarEventScheduleAction:', error);
    return { success: false, error: 'Error al actualizar horario del evento' };
  }
}

/**
 * Sincroniza y guarda los bloques de disponibilidad del usuario en Supabase (tanto en 'bloques_disponibilidad'
 * para algoritmos de IA/conflictos, como en 'calendar_availability' para conservar nombres y colores exactos).
 */
export async function syncAvailabilityBlocksAction(
  blocks: Array<{
    dia_semana?: number | null;
    fecha_especifica?: string | null;
    hora_inicio: string;
    hora_fin: string;
    tipo: 'ocupado' | 'tareas' | 'estudio' | 'trabajo' | 'otra_actividad' | 'descanso' | string;
    origen?: string;
    label?: string;
    color?: string | null;
  }>,
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'No autenticado' };
    }

    const adminDb = getAdminClient();
    const db = adminDb || supabase;

    // Eliminar bloques previos del usuario en bloques_disponibilidad para actualizarlos de forma consistente
    await db.from('bloques_disponibilidad').delete().eq('usuario_id', user.id);

    if (blocks.length > 0) {
      const inserts = blocks.map((b) => ({
        usuario_id: user.id,
        dia_semana: b.dia_semana ?? null,
        fecha_especifica: b.fecha_especifica ?? null,
        hora_inicio: b.hora_inicio.length === 5 ? `${b.hora_inicio}:00` : b.hora_inicio,
        hora_fin: b.hora_fin.length === 5 ? `${b.hora_fin}:00` : b.hora_fin,
        tipo: b.tipo,
        origen: b.origen || 'manual',
      }));

      const { error: insErr } = await db.from('bloques_disponibilidad').insert(inserts);
      if (insErr) {
        console.warn('Error insertando bloques_disponibilidad:', insErr);
      }
    }

    // Guardar en calendar_availability para conservar nombres, categorías y colores exactos
    const customBlocks = blocks.map((b) => ({
      date: b.fecha_especifica || '',
      startTime: b.hora_inicio.slice(0, 5),
      endTime: b.hora_fin.slice(0, 5),
      label:
        b.label ||
        (b.tipo === 'estudio'
          ? 'Estudio'
          : b.tipo === 'trabajo'
            ? 'Trabajo'
            : b.tipo === 'descanso'
              ? 'Descanso'
              : 'Tareas'),
      type: b.tipo,
      color: b.color || null,
      origen: b.origen || 'manual',
    }));

    try {
      const { error: calErr } = await db.from('calendar_availability').upsert({
        user_id: user.id,
        availability: { blocks: customBlocks },
        updated_at: new Date().toISOString(),
      });

      if (calErr) {
        console.warn('Aviso guardando en calendar_availability:', calErr);
      }
    } catch (calUpsertErr) {
      console.warn('Error en upsert calendar_availability:', calUpsertErr);
    }

    revalidatePath('/calendario');
    return { success: true };
  } catch (error) {
    console.error('Error en syncAvailabilityBlocksAction:', error);
    return { success: false, error: 'Error al sincronizar bloques de disponibilidad' };
  }
}

/**
 * Actualiza el título y descripción de un evento de calendario (y su tarea correspondiente en 'tareas').
 */
export async function updateCalendarEventDetailsAction(input: {
  eventId: string;
  titulo: string;
  descripcion?: string;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'No autenticado' };
    }

    const adminDb = getAdminClient();
    const db = adminDb || supabase;

    // Obtener el evento para recuperar tarea_id y proyecto_id
    const { data: existingEvent, error: findErr } = await db
      .from('eventos_calendario')
      .select('id, tarea_id, proyecto_id, usuario_id')
      .eq('id', input.eventId)
      .eq('usuario_id', user.id)
      .maybeSingle();

    if (findErr || !existingEvent) {
      return { success: false, error: 'Evento no encontrado o sin permisos' };
    }

    // Actualizar en eventos_calendario
    const updatePayload: { titulo: string; descripcion?: string } = {
      titulo: input.titulo,
    };
    if (input.descripcion !== undefined) {
      updatePayload.descripcion = input.descripcion;
    }

    const { error: updateErr } = await db
      .from('eventos_calendario')
      .update(updatePayload)
      .eq('id', input.eventId)
      .eq('usuario_id', user.id);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // Si tiene tarea_id, sincronizar en la tabla tareas
    if (existingEvent.tarea_id) {
      const taskUpdatePayload: { titulo: string; descripcion?: string } = {
        titulo: input.titulo,
      };
      if (input.descripcion !== undefined) {
        taskUpdatePayload.descripcion = input.descripcion;
      }

      await db.from('tareas').update(taskUpdatePayload).eq('id', existingEvent.tarea_id);
    }

    revalidatePath('/calendario');
    if (existingEvent.proyecto_id) {
      revalidatePath(`/proyectos/${existingEvent.proyecto_id}`);
    }
    revalidatePath('/proyectos');

    return { success: true };
  } catch (error) {
    console.error('Error en updateCalendarEventDetailsAction:', error);
    return { success: false, error: 'Error al actualizar detalles del evento' };
  }
}
