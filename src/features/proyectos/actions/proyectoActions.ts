'use server';

import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import {
  generateProjectTasksFromN8n,
  notifyTaskCompletedToN8n,
} from '@/services/automation/n8nTasksService';
import {
  generateProjectTasksAndScheduleWithGemini,
  checkProjectFeasibilityWithGemini,
} from '@/services/ai/scheduleAiService';
import { validateContent, validateProjectContent } from '@/lib/moderation/contentFilter';

export interface CreateProjectInput {
  titulo: string;
  objetivo: string;
  fecha_limite: string;
  prioridad: string;
  nivel_conocimiento: string;
  material_url?: string;
  minutos_diarios: number;
}

export interface TaskRecord {
  id: string;
  id_proyecto: string;
  titulo: string;
  duracion: number;
  completado: boolean;
  descripcion?: string | null;
  fecha_limite?: string | null;
  prioridad?: string | null;
  fecha_inicio?: string | null;
  resources?: string | null;
  url_recomendada?: string | null;
  quiz_aprobado?: boolean;
}

export interface ProjectRecord {
  id: string;
  user_id: string;
  titulo: string;
  objetivo: string;
  fecha_limite: string;
  prioridad: string;
  nivel_conocimiento: string;
  material_url: string | null;
  minutos_diarios: number;
  progreso: number;
  completado?: boolean;
  tareas?: TaskRecord[];
}

export interface UpdateProjectInput {
  id: string;
  titulo: string;
  objetivo?: string;
  fecha_limite?: string | null;
}

async function userOwnsProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  projectId: string,
) {
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle();

  return !error && Boolean(data);
}

/**
 * checkProjectFeasibilityAction
 * Acción de servidor para evaluar en el backend la viabilidad temporal del proyecto con Gemini.
 */
export async function checkProjectFeasibilityAction(input: {
  titulo: string;
  objetivo?: string;
  fecha_limite?: string;
  minutos_diarios?: number;
  nivel_conocimiento?: string;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return await checkProjectFeasibilityWithGemini({
      ...input,
      usuario_id: user?.id,
    });
  } catch (err) {
    console.error('Error en checkProjectFeasibilityAction:', err);
    return { es_posible: true };
  }
}

/**
 * updateProjectAction
 * Actualiza los datos de un proyecto (título, descripción/objetivo, fecha límite)
 * aplicando todas las validaciones estrictamente en el backend.
 */
export async function updateProjectAction(input: UpdateProjectInput) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'No se encontró una sesión activa.' };
    }

    if (!input.id) {
      return { success: false, error: 'ID de proyecto no proporcionado.' };
    }

    const owns = await userOwnsProject(supabase, user.id, input.id);
    if (!owns) {
      return { success: false, error: 'No tienes permisos para editar este proyecto.' };
    }

    const trimmedTitle = input.titulo ? input.titulo.trim() : '';
    if (!trimmedTitle) {
      return { success: false, error: 'El nombre del proyecto es obligatorio.' };
    }
    if (trimmedTitle.length > 50) {
      return {
        success: false,
        error: 'El nombre del proyecto no puede superar los 50 caracteres.',
      };
    }

    const trimmedObjective = input.objetivo ? input.objetivo.trim() : '';
    if (trimmedObjective.length > 250) {
      return { success: false, error: 'La descripción no puede superar los 250 caracteres.' };
    }

    // [VALIDACIÓN BACKEND DE CONTENIDO]: Palabras obscenas o peligrosas
    const contentValidation = validateProjectContent(trimmedTitle, trimmedObjective);
    if (!contentValidation.isValid) {
      return {
        success: false,
        error:
          contentValidation.error ||
          'El proyecto contiene términos obscenos o peligrosos no permitidos.',
      };
    }

    let parsedFechaLimite: string | null = null;
    if (input.fecha_limite) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selected = new Date(`${input.fecha_limite}T00:00:00`);

      if (isNaN(selected.getTime())) {
        return { success: false, error: 'Formato de fecha inválido.' };
      }

      if (selected < today) {
        return {
          success: false,
          error: 'La fecha límite no puede ser anterior al día de hoy.',
        };
      }

      const maxYear = today.getFullYear() + 10;
      const maxDate = new Date(`${maxYear}-12-31T23:59:59`);
      if (selected > maxDate) {
        return {
          success: false,
          error: `La fecha límite no puede superar los 10 años desde el año actual (${maxYear}).`,
        };
      }

      parsedFechaLimite = new Date(`${input.fecha_limite}T00:00:00Z`).toISOString();
    }

    const { data: updated, error: updateError } = await supabase
      .from('projects')
      .update({
        titulo: trimmedTitle,
        objetivo: trimmedObjective,
        fecha_limite: parsedFechaLimite,
      })
      .eq('id', input.id)
      .eq('user_id', user.id)
      .select('id, titulo, objetivo, fecha_limite, prioridad, progreso, completado')
      .single();

    if (updateError) {
      console.error('Error al actualizar proyecto en Supabase:', updateError);
      return { success: false, error: `Error al actualizar proyecto: ${updateError.message}` };
    }

    revalidatePath('/proyectos');
    revalidatePath(`/proyectos/${input.id}`);
    revalidatePath('/');

    return {
      success: true,
      project: updated,
    };
  } catch (error) {
    console.error('Error en updateProjectAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error inesperado al editar el proyecto.',
    };
  }
}

/**
 * createProjectAction
 * Registra un nuevo proyecto en la tabla 'projects' de Supabase aplicando
 * validaciones de fechas y viabilidad con IA en el backend.
 */
export async function createProjectAction(input: CreateProjectInput) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'No se encontró una sesión activa.' };
    }

    // Validar nombre en backend
    const trimmedTitle = input.titulo ? input.titulo.trim() : '';
    if (!trimmedTitle) {
      return { success: false, error: 'El nombre del proyecto es obligatorio.' };
    }
    if (trimmedTitle.length > 50) {
      return {
        success: false,
        error: 'El nombre del proyecto no puede superar los 50 caracteres.',
      };
    }

    // Validar descripción en backend
    const trimmedObjective = input.objetivo ? input.objetivo.trim() : '';
    if (trimmedObjective.length > 250) {
      return { success: false, error: 'El objetivo no puede superar los 250 caracteres.' };
    }

    // [VALIDACIÓN BACKEND DE CONTENIDO]: Palabras obscenas o peligrosas
    const contentValidation = validateProjectContent(trimmedTitle, trimmedObjective);
    if (!contentValidation.isValid) {
      return {
        success: false,
        error:
          contentValidation.error ||
          'El proyecto contiene términos obscenos o peligrosos no permitidos.',
      };
    }

    // Validar que la fecha límite no sea anterior a hoy ni supere 10 años
    if (input.fecha_limite) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selected = new Date(`${input.fecha_limite}T00:00:00`);
      if (selected < today) {
        return {
          success: false,
          error: 'La fecha límite no puede ser anterior al día de creación.',
        };
      }
      const maxYear = today.getFullYear() + 10;
      const maxDate = new Date(`${maxYear}-12-31T23:59:59`);
      if (selected > maxDate) {
        return {
          success: false,
          error: `La fecha límite no puede superar los 10 años desde el año actual (${maxYear}).`,
        };
      }
    }

    // [VALIDACIÓN PREVIA HEURÍSTICA DE VIABILIDAD]:
    // Detección inmediata sin consumo de tokens de casos manifiestamente imposibles
    if (input.fecha_limite) {
      const todayZero = new Date();
      todayZero.setHours(0, 0, 0, 0);
      const deadlineZero = new Date(input.fecha_limite);
      deadlineZero.setHours(0, 0, 0, 0);
      const diffDays = Math.max(
        1,
        Math.ceil((deadlineZero.getTime() - todayZero.getTime()) / (1000 * 60 * 60 * 24)),
      );
      const minDiarios = Math.round(Number(input.minutos_diarios)) || 30;
      const horasTotales = Math.round((diffDays * minDiarios) / 60);

      const objLower = (trimmedObjective + ' ' + trimmedTitle).toLowerCase();
      const esMetaMasiva =
        objLower.includes('carrera') ||
        objLower.includes('medicina') ||
        objLower.includes('ingeniería desde cero') ||
        objLower.includes('sistema operativo') ||
        objLower.includes('doctorado');

      if (diffDays <= 2 && (esMetaMasiva || (trimmedObjective.length > 200 && horasTotales < 3))) {
        return {
          success: false,
          error: `Es imposible realizar el proyecto en solo ${diffDays} día(s). Se necesita más tiempo para alcanzar este objetivo.`,
          es_imposible: true,
          motivo:
            'El plazo asignado es insuficiente para abarcar la complejidad y alcance del objetivo declarado.',
          tiempo_minimo_recomendado: 'Al menos 1 a 3 meses',
        };
      }
    }

    // [VALIDACIÓN BACKEND DE VIABILIDAD IA]:
    // Evaluar si es pedagógicamente posible realizar el proyecto en el tiempo asignado
    const feasibility = await checkProjectFeasibilityWithGemini({
      titulo: trimmedTitle,
      objetivo: trimmedObjective,
      fecha_limite: input.fecha_limite,
      minutos_diarios: input.minutos_diarios,
      nivel_conocimiento: input.nivel_conocimiento,
      usuario_id: user.id,
    });

    if (!feasibility.es_posible) {
      return {
        success: false,
        error:
          feasibility.error ||
          'Es imposible realizar el proyecto en el tiempo límite indicado, se necesita más tiempo.',
        es_imposible: true,
        motivo: feasibility.motivo,
        tiempo_minimo_recomendado: feasibility.tiempo_minimo_recomendado,
      };
    }

    const projectId = crypto.randomUUID();

    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert({
        id: projectId,
        user_id: user.id,
        titulo: trimmedTitle,
        objetivo: trimmedObjective,
        fecha_limite: input.fecha_limite
          ? new Date(`${input.fecha_limite}T00:00:00Z`).toISOString()
          : null,
        prioridad: input.prioridad || 'Prioritario',
        nivel_conocimiento: input.nivel_conocimiento || '',
        material_url: input.material_url || null,
        minutos_diarios: Math.round(Number(input.minutos_diarios)) || 30,
        progreso: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error insertando en projects:', insertError);
      return { success: false, error: `Error al crear proyecto: ${insertError.message}` };
    }

    // =========================================================================
    // [INTEGRACIÓN IA UNIFICADA - VIABILIDAD + TAREAS Y CALENDARIO]:
    // Realiza 1 sola llamada a la IA que evalúa viabilidad pedagógica y genera
    // tareas calibradas sin colisiones en el calendario (50% ahorro de cuota).
    // =========================================================================
    let tasksGenerated = false;
    if (process.env.GEMINI_API_KEY) {
      try {
        const geminiResult = await generateProjectTasksAndScheduleWithGemini({
          id: project.id,
          user_id: user.id,
          titulo: project.titulo,
          objetivo: project.objetivo,
          fecha_limite: project.fecha_limite ? project.fecha_limite.split('T')[0] : undefined,
          prioridad: project.prioridad,
          nivel_conocimiento: project.nivel_conocimiento,
          minutos_diarios: project.minutos_diarios,
          material_url: project.material_url,
        });

        // Si la IA dictaminó que el proyecto es pedagógicamente inviable
        if ('es_imposible' in geminiResult && geminiResult.es_imposible) {
          // Revertir inserción de proyecto limpio
          await supabase.from('projects').delete().eq('id', project.id);
          return {
            success: false,
            error:
              geminiResult.error ||
              'Es imposible realizar el proyecto en el tiempo límite indicado, se necesita más tiempo.',
            es_imposible: true,
            motivo:
              'motivo' in geminiResult && typeof geminiResult.motivo === 'string'
                ? geminiResult.motivo
                : undefined,
          };
        }

        if (geminiResult.success) {
          tasksGenerated = true;
        } else {
          console.warn(
            'Advertencia: No se pudieron generar tareas con Gemini, intentando fallback:',
            geminiResult.error,
          );
        }
      } catch (geminiErr) {
        console.warn('Advertencia: Excepción al generar tareas con Gemini:', geminiErr);
      }
    }

    // Fallback a n8n si Gemini no generó las tareas y el webhook está configurado
    if (!tasksGenerated && process.env.N8N_WEBHOOK_URL) {
      try {
        const n8nResult = await generateProjectTasksFromN8n({
          id: project.id,
          user_id: user.id,
          titulo: project.titulo,
          objetivo: project.objetivo,
          fecha_limite: project.fecha_limite ? project.fecha_limite.split('T')[0] : undefined,
          prioridad: project.prioridad,
          nivel_conocimiento: project.nivel_conocimiento,
          minutos_diarios: project.minutos_diarios,
          material_url: project.material_url,
        });

        if (!n8nResult.success) {
          console.warn(
            'Advertencia: No se pudieron generar tareas con n8n al crear el proyecto:',
            n8nResult.error,
          );
        } else {
          tasksGenerated = true;
        }
      } catch (n8nErr) {
        console.warn(
          'Advertencia: Excepción al generar tareas con n8n al crear el proyecto:',
          n8nErr,
        );
      }
    }

    revalidatePath('/proyectos');
    revalidatePath('/calendario');
    revalidatePath('/');

    return {
      success: true,
      project,
      tasksGenerated,
      aiAvailable: tasksGenerated,
      aiMessage: tasksGenerated
        ? undefined
        : 'El servicio de Inteligencia Artificial se encuentra temporalmente fuera de servicio o no disponible. Tu proyecto ha sido creado con éxito y puedes añadir tus tareas manualmente.',
    };
  } catch (error: unknown) {
    console.error('Error en createProjectAction:', error);
    const msg = error instanceof Error ? error.message : 'Error inesperado al crear el proyecto.';
    return { success: false, error: msg };
  }
}

/**
 * getProjectsAction
 * Carga todos los proyectos del usuario autenticado con sus tareas y progreso.
 */
export async function getProjectsAction() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'No se encontró una sesión activa.', projects: [] };
    }

    const { data: projects, error } = await supabase
      .from('projects')
      .select(
        'id, user_id, titulo, objetivo, fecha_limite, prioridad, nivel_conocimiento, material_url, minutos_diarios, progreso, completado',
      )
      .eq('user_id', user.id);

    if (error) {
      console.error('Error cargando projects:', error);
      return { success: false, error: error.message, projects: [] };
    }

    const projectRows = (projects ?? []) as ProjectRecord[];
    const projectIds = projectRows.map((project) => project.id);
    if (projectIds.length === 0) return { success: true, projects: [] };

    const { data: taskRows, error: tasksError } = await supabase
      .from('tareas')
      .select('id, id_proyecto, titulo, duracion, completado')
      .in('id_proyecto', projectIds);

    if (tasksError) {
      console.error('Error cargando tareas de projects:', tasksError);
      return { success: false, error: tasksError.message, projects: [] };
    }

    const tasksByProject = new Map<string, TaskRecord[]>();
    for (const task of (taskRows ?? []) as TaskRecord[]) {
      const tasks = tasksByProject.get(task.id_proyecto) ?? [];
      tasks.push(task);
      tasksByProject.set(task.id_proyecto, tasks);
    }

    return {
      success: true,
      projects: projectRows.map((project) => ({
        ...project,
        tareas: tasksByProject.get(project.id) ?? [],
      })),
    };
  } catch (error: unknown) {
    console.error('Error en getProjectsAction:', error);
    const msg = error instanceof Error ? error.message : 'Error inesperado.';
    return { success: false, error: msg, projects: [] };
  }
}

/**
 * getProjectDetailAction
 * Obtiene el detalle de un proyecto y todas sus tareas asociadas desde Supabase.
 */
export async function getProjectDetailAction(id: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'No se encontró una sesión activa.' };
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return { success: false, error: projectError?.message || 'Proyecto no encontrado.' };
    }

    const db = supabase;

    const { data: tareas, error: tareasError } = await db
      .from('tareas')
      .select('*')
      .eq('id_proyecto', id);

    if (tareasError) {
      console.error('Error cargando tareas:', tareasError);
    }

    return {
      success: true,
      project: {
        ...project,
        tareas: tareas || [],
      },
    };
  } catch (error: unknown) {
    console.error('Error en getProjectDetailAction:', error);
    const msg = error instanceof Error ? error.message : 'Error inesperado.';
    return { success: false, error: msg };
  }
}

/**
 * toggleTaskStatusAction
 * Actualiza el campo 'completado' (boolean) de la tarea y recalcula el 'progreso' en 'projects'.
 * Además gestiona la racha: incrementa si se completa a tiempo o restablece a 0 si la tarea expiró.
 */
export async function toggleTaskStatusAction(
  taskId: string,
  isCompleted: boolean,
  projectId?: string,
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'No se encontró una sesión activa.' };
    }

    const adminDb = getAdminClient();
    const db = adminDb || supabase;

    let targetProjectId = projectId;
    if (!targetProjectId) {
      const { data: tRecord } = await db
        .from('tareas')
        .select('id_proyecto')
        .eq('id', taskId)
        .maybeSingle();
      if (tRecord?.id_proyecto) {
        targetProjectId = tRecord.id_proyecto;
      }
    }

    if (!targetProjectId) {
      return { success: false, error: 'No se pudo identificar el proyecto de la tarea.' };
    }

    if (!(await userOwnsProject(supabase, user.id, targetProjectId))) {
      return {
        success: false,
        error: 'No tienes permiso para modificar las tareas de este proyecto.',
      };
    }

    // 1. Obtener la tarea antes de modificar para conocer su estado previo y tiempo
    const { data: existingTask, error: existingTaskErr } = await db
      .from('tareas')
      .select('id, titulo, completado, fecha_inicio, duracion')
      .eq('id', taskId)
      .eq('id_proyecto', targetProjectId)
      .maybeSingle();

    if (existingTaskErr) {
      console.warn('Aviso consultando existingTask en toggleTaskStatusAction:', existingTaskErr);
    }

    const wasCompleted = Boolean(existingTask?.completado);

    // 2. Actualizar la tarea en la tabla 'tareas'
    const nowIso = new Date().toISOString();
    let updateError: { message: string } | null = null;

    // Intento 1: Actualizar completado y completed_at
    const res1 = await db
      .from('tareas')
      .update({
        completado: isCompleted,
        completed_at: isCompleted ? nowIso : null,
      })
      .eq('id', taskId)
      .eq('id_proyecto', targetProjectId);

    if (res1.error) {
      console.warn(
        'Aviso al actualizar con completed_at en tareas, intentando fallback solo con completado:',
        res1.error.message,
      );
      // Intento 2 (Fallback): Si falló el trigger o columna completed_at, actualizar solo completado
      const res2 = await db
        .from('tareas')
        .update({
          completado: isCompleted,
        })
        .eq('id', taskId)
        .eq('id_proyecto', targetProjectId);

      if (res2.error) {
        updateError = res2.error;
      }
    }

    if (updateError) {
      console.error('Error definitivo en Supabase al actualizar tarea:', updateError);
      return { success: false, error: updateError.message };
    }

    // Sincronizar estado en eventos_calendario si la tarea está agendada
    try {
      await db
        .from('eventos_calendario')
        .update({
          estado: isCompleted ? 'completada' : 'pendiente',
        })
        .eq('tarea_id', taskId);
    } catch (calSyncErr) {
      console.warn('Aviso sincronizando estado en eventos_calendario:', calSyncErr);
    }

    // 3. Gestionar racha del usuario en la tabla 'profiles'
    let updatedRacha: number;
    let updatedRachaMaxima: number;

    const { data: profile } = await db
      .from('profiles')
      .select('racha_activa, racha_maxima, telegram_chat_id, nombre_usuario, nombre_completo')
      .eq('id', user.id)
      .maybeSingle();

    const currentStreak = typeof profile?.racha_activa === 'number' ? profile.racha_activa : 0;
    const currentMax = typeof profile?.racha_maxima === 'number' ? profile.racha_maxima : 0;

    if (isCompleted && !wasCompleted) {
      // Al completar una tarea: aumenta siempre el contador de racha
      updatedRacha = currentStreak + 1;
      updatedRachaMaxima = Math.max(currentMax, updatedRacha);

      await db
        .from('profiles')
        .update({
          racha_activa: updatedRacha,
          racha_maxima: updatedRachaMaxima,
        })
        .eq('id', user.id);
    } else if (!isCompleted && wasCompleted) {
      // Al desmarcar una tarea: decrementa la racha sin bajar de 0
      updatedRacha = Math.max(0, currentStreak - 1);
      updatedRachaMaxima = currentMax;

      await db
        .from('profiles')
        .update({
          racha_activa: updatedRacha,
        })
        .eq('id', user.id);
    } else {
      updatedRacha = currentStreak;
      updatedRachaMaxima = currentMax;
    }

    // 4. Obtener todas las tareas del proyecto para recalcular el porcentaje de progreso
    const { data: allTasks, error: fetchError } = await db
      .from('tareas')
      .select('completado')
      .eq('id_proyecto', targetProjectId);

    let newProgreso = 0;
    let isProjectCompleted = false;
    if (!fetchError && allTasks && allTasks.length > 0) {
      const completedCount = allTasks.filter((t) => t.completado).length;
      newProgreso = Math.round((completedCount / allTasks.length) * 100);
      isProjectCompleted = completedCount === allTasks.length;
    }

    // 5. Guardar el nuevo progreso y completado en la tabla 'projects'
    try {
      const { error: projError } = await db
        .from('projects')
        .update({ progreso: newProgreso, completado: isProjectCompleted })
        .eq('id', targetProjectId)
        .eq('user_id', user.id);

      if (projError && projError.message.includes('completado')) {
        await db
          .from('projects')
          .update({ progreso: newProgreso })
          .eq('id', targetProjectId)
          .eq('user_id', user.id);
      }
    } catch {
      await db
        .from('projects')
        .update({ progreso: newProgreso })
        .eq('id', targetProjectId)
        .eq('user_id', user.id);
    }

    // 6. Notificar a n8n en segundo plano si la tarea se acaba de completar
    if (isCompleted && !wasCompleted) {
      (async () => {
        try {
          const { data: projData } = await db
            .from('projects')
            .select('titulo')
            .eq('id', targetProjectId)
            .maybeSingle();

          await notifyTaskCompletedToN8n({
            taskId,
            taskTitle: existingTask?.titulo || 'Tarea completada',
            projectId: targetProjectId,
            projectTitle: projData?.titulo || undefined,
            userId: user.id,
            userName: profile?.nombre_completo || profile?.nombre_usuario || undefined,
            telegramChatId: profile?.telegram_chat_id ?? null,
            completedAt: nowIso,
            rachaActiva: updatedRacha,
          });
        } catch (n8nErr) {
          console.warn('Aviso notificando finalización de tarea a n8n:', n8nErr);
        }
      })();
    }

    revalidatePath(`/proyectos/${targetProjectId}`);
    revalidatePath('/proyectos');
    revalidatePath('/calendario');
    revalidatePath('/');
    revalidatePath('/perfil');
    revalidatePath('/analitica');

    return {
      success: true,
      progreso: newProgreso,
      completado: isProjectCompleted,
      racha_activa: updatedRacha,
      racha_maxima: updatedRachaMaxima,
    };
  } catch (error: unknown) {
    console.error('Error en toggleTaskStatusAction:', error);
    const msg = error instanceof Error ? error.message : 'Error inesperado.';
    return { success: false, error: msg };
  }
}

/**
 * createTaskAction
 * Inserta una nueva tarea manual en la tabla 'tareas' y actualiza el 'progreso' en 'projects'.
 */
export async function createTaskAction(data: {
  projectId: string;
  titulo: string;
  duracion: number; // en minutos
  descripcion?: string;
  prioridad?: string;
  fecha_inicio?: string | null;
  resources?: string | null;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'No se encontró una sesión activa.' };
    }

    if (!(await userOwnsProject(supabase, user.id, data.projectId))) {
      return { success: false, error: 'No tienes permiso para crear tareas en este proyecto.' };
    }

    // [VALIDACIÓN BACKEND DE CONTENIDO]: Palabras obscenas o peligrosas
    const contentValidation = validateContent(`${data.titulo} ${data.descripcion || ''}`);
    if (!contentValidation.isValid) {
      return {
        success: false,
        error:
          contentValidation.error ||
          'La tarea contiene términos obscenos o peligrosos no permitidos.',
      };
    }

    const db = supabase;

    let parsedFechaInicio: string | null = null;
    if (data.fecha_inicio) {
      try {
        const d = new Date(data.fecha_inicio);
        parsedFechaInicio = isNaN(d.getTime()) ? data.fecha_inicio : d.toISOString();
      } catch {
        parsedFechaInicio = data.fecha_inicio;
      }
    }

    const trimmedTitle = (data.titulo || '').trim();
    if (!trimmedTitle) {
      return { success: false, error: 'El título de la tarea es obligatorio.' };
    }
    if (trimmedTitle.length > 100) {
      return {
        success: false,
        error: 'El título de la tarea no puede exceder los 100 caracteres.',
      };
    }

    // Obtener fecha límite del proyecto para validación
    const { data: projectRecord } = await db
      .from('projects')
      .select('fecha_limite')
      .eq('id', data.projectId)
      .maybeSingle();

    // Comprobación de fecha y conflictos de horario en el backend
    if (parsedFechaInicio) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDateTime = new Date(parsedFechaInicio);
      if (startDateTime < today) {
        return {
          success: false,
          error: 'El día de inicio no puede ser anterior a la fecha de hoy.',
        };
      }

      if (projectRecord?.fecha_limite) {
        const deadlineDay = projectRecord.fecha_limite.split('T')[0];
        const [deadY, deadM, deadD] = deadlineDay.split('-').map(Number);
        const projectDeadline = new Date(deadY, deadM - 1, deadD, 23, 59, 59, 999);

        const taskDayStr = data.fecha_inicio
          ? data.fecha_inicio.split('T')[0]
          : parsedFechaInicio.split('T')[0];

        // Se permite registrar tareas hasta el mismo día límite inclusive (taskDayStr <= deadlineDay)
        if (taskDayStr > deadlineDay || startDateTime.getTime() > projectDeadline.getTime()) {
          return {
            success: false,
            error: `El día de inicio no puede superar la fecha límite del proyecto (${deadlineDay}).`,
          };
        }
      }

      const newStart = startDateTime.getTime();
      const newDurationMinutes = Math.max(1, Math.round(Number(data.duracion)) || 1);
      const newEnd = newStart + newDurationMinutes * 60 * 1000;

      // Obtener todos los proyectos del usuario para verificar colisiones en todo su calendario
      const { data: userProjects } = await db.from('projects').select('id').eq('user_id', user.id);
      const userProjIds = (userProjects || []).map((p) => p.id);

      const { data: existingTasks } = await db
        .from('tareas')
        .select('id, titulo, fecha_inicio, duracion')
        .in('id_proyecto', userProjIds.length > 0 ? userProjIds : [data.projectId])
        .not('fecha_inicio', 'is', null);

      if (existingTasks && existingTasks.length > 0) {
        for (const existing of existingTasks) {
          if (!existing.fecha_inicio) continue;
          const exStart = new Date(existing.fecha_inicio).getTime();
          if (isNaN(exStart)) continue;

          const exDuration = Math.max(1, Number(existing.duracion) || 1);
          const exEnd = exStart + exDuration * 60 * 1000;

          // Caso 1: Fecha y hora exactamente igual
          if (newStart === exStart) {
            return {
              success: false,
              error: `El bloque horario seleccionado ya se encuentra ocupado por la tarea "${existing.titulo}". Por favor, intenta utilizar otra hora o bloque disponible dentro del mismo día.`,
            };
          }

          // Caso 2: Conflicto de duración con horario de otra tarea
          if (newStart < exEnd && exStart < newEnd) {
            const exStartStr = new Date(existing.fecha_inicio).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });
            const exEndStr = new Date(exEnd).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });
            return {
              success: false,
              error: `El tiempo de duración entra en conflicto con la tarea "${existing.titulo}" (${exStartStr} - ${exEndStr}). Por favor, intenta utilizar otra hora o bloque disponible dentro del mismo día.`,
            };
          }
        }
      }

      // 2. Verificar colisiones con eventos_calendario (incluyendo eventos de IA u otros proyectos)
      const { data: calEvents } = await db
        .from('eventos_calendario')
        .select('id, titulo, inicio, fin')
        .eq('usuario_id', user.id)
        .neq('estado', 'cancelado');

      if (calEvents && calEvents.length > 0) {
        for (const ev of calEvents) {
          if (!ev.inicio || !ev.fin) continue;
          const evStart = new Date(ev.inicio).getTime();
          const evEnd = new Date(ev.fin).getTime();
          if (isNaN(evStart) || isNaN(evEnd)) continue;

          if (newStart < evEnd && evStart < newEnd) {
            const evStartStr = new Date(ev.inicio).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });
            const evEndStr = new Date(ev.fin).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });
            return {
              success: false,
              error: `El horario seleccionado entra en conflicto con el evento o tarea "${ev.titulo}" (${evStartStr} - ${evEndStr}) en tu calendario. Por favor, intenta utilizar otra hora o bloque disponible.`,
            };
          }
        }
      }

      // 3. Verificar colisiones con bloques_disponibilidad ocupados (estudio, trabajo, ocupado, descanso, otra_actividad)
      const { data: busyBlocks } = await db
        .from('bloques_disponibilidad')
        .select('id, dia_semana, fecha_especifica, hora_inicio, hora_fin, tipo')
        .eq('usuario_id', user.id)
        .neq('tipo', 'tareas');

      if (busyBlocks && busyBlocks.length > 0) {
        const taskDateStr = parsedFechaInicio.split('T')[0];
        const taskDateObj = new Date(parsedFechaInicio);
        const taskDayOfWeek = taskDateObj.getDay();
        const taskStartMin = taskDateObj.getHours() * 60 + taskDateObj.getMinutes();
        const taskEndMin = taskStartMin + newDurationMinutes;

        for (const busy of busyBlocks) {
          let matchesDay = false;
          if (busy.fecha_especifica) {
            matchesDay = busy.fecha_especifica === taskDateStr;
          } else if (busy.dia_semana !== null && busy.dia_semana !== undefined) {
            matchesDay = busy.dia_semana === taskDayOfWeek;
          }

          if (matchesDay) {
            const [bh1, bm1] = busy.hora_inicio.split(':').map(Number);
            const [bh2, bm2] = busy.hora_fin.split(':').map(Number);
            const busyStartMin = (bh1 || 0) * 60 + (bm1 || 0);
            const busyEndMin = (bh2 || 0) * 60 + (bm2 || 0);

            if (Math.max(taskStartMin, busyStartMin) < Math.min(taskEndMin, busyEndMin)) {
              const tipoLabel =
                busy.tipo === 'estudio'
                  ? 'Estudio'
                  : busy.tipo === 'trabajo'
                    ? 'Trabajo'
                    : busy.tipo === 'ocupado'
                      ? 'Ocupado'
                      : busy.tipo === 'otra_actividad'
                        ? 'Otra actividad'
                        : busy.tipo === 'descanso'
                          ? 'Descanso'
                          : busy.tipo;
              return {
                success: false,
                error: `El horario entra en conflicto con un bloque ocupado en tu calendario (${tipoLabel}) de ${busy.hora_inicio.slice(0, 5)} a ${busy.hora_fin.slice(0, 5)}. Por favor, intenta utilizar otra hora o bloque disponible.`,
              };
            }
          }
        }
      }
    }

    const newTaskId = crypto.randomUUID();

    const { data: task, error: insertError } = await db
      .from('tareas')
      .insert({
        id: newTaskId,
        id_proyecto: data.projectId,
        titulo: data.titulo.trim(),
        duracion: Math.round(Number(data.duracion)) || 0,
        completado: false,
        descripcion: data.descripcion?.trim() || null,
        prioridad: data.prioridad || null,
        fecha_inicio: parsedFechaInicio,
        resources: data.resources?.trim() || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error insertando en tareas:', insertError);
      return {
        success: false,
        error: insertError.message.includes('row-level security')
          ? 'Error de permisos RLS en Supabase: ejecuta la migración SQL 20260920200000_fix_tareas_rls.sql en tu panel de Supabase o añade SUPABASE_SERVICE_ROLE_KEY a .env.local.'
          : insertError.message,
      };
    }

    // Recalcular progreso del proyecto
    const { data: allTasks } = await db
      .from('tareas')
      .select('completado')
      .eq('id_proyecto', data.projectId);

    let newProgreso = 0;
    if (allTasks && allTasks.length > 0) {
      const completedCount = allTasks.filter((t) => t.completado).length;
      newProgreso = Math.round((completedCount / allTasks.length) * 100);
    }

    try {
      const { error: projError } = await db
        .from('projects')
        .update({ progreso: newProgreso, completado: false })
        .eq('id', data.projectId)
        .eq('user_id', user.id);

      if (projError && projError.message.includes('completado')) {
        await db
          .from('projects')
          .update({ progreso: newProgreso })
          .eq('id', data.projectId)
          .eq('user_id', user.id);
      }
    } catch {
      await db
        .from('projects')
        .update({ progreso: newProgreso })
        .eq('id', data.projectId)
        .eq('user_id', user.id);
    }

    // Sincronizar en eventos_calendario si la tarea tiene fecha asignada
    if (task && parsedFechaInicio) {
      try {
        const startIso = new Date(parsedFechaInicio).toISOString();
        const durMin = Math.max(15, Number(task.duracion) || 30);
        const endIso = new Date(
          new Date(parsedFechaInicio).getTime() + durMin * 60 * 1000,
        ).toISOString();
        await db.from('eventos_calendario').insert({
          id: crypto.randomUUID(),
          usuario_id: user.id,
          proyecto_id: data.projectId,
          tarea_id: task.id,
          titulo: task.titulo,
          descripcion: task.descripcion || '',
          inicio: startIso,
          fin: endIso,
          estado: 'pendiente',
          generado_por_ia: false,
        });
      } catch (calErr) {
        console.warn('Aviso: no se pudo registrar evento en calendario para tarea:', calErr);
      }
    }

    revalidatePath(`/proyectos/${data.projectId}`);
    revalidatePath('/proyectos');
    revalidatePath('/calendario');
    revalidatePath('/');

    return { success: true, task, progreso: newProgreso, completado: false };
  } catch (error: unknown) {
    console.error('Error en createTaskAction:', error);
    const msg = error instanceof Error ? error.message : 'Error inesperado.';
    return { success: false, error: msg };
  }
}

/**
 * deleteTaskAction
 * Elimina una tarea de la tabla 'tareas' y actualiza el progreso en 'projects'.
 */
export async function deleteTaskAction(taskId: string, projectId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'No se encontró una sesión activa.' };
    }

    if (!(await userOwnsProject(supabase, user.id, projectId))) {
      return { success: false, error: 'No tienes permiso para eliminar tareas de este proyecto.' };
    }

    const db = supabase;

    const { error: deleteError } = await db
      .from('tareas')
      .delete()
      .eq('id', taskId)
      .eq('id_proyecto', projectId);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    try {
      await db.from('eventos_calendario').delete().eq('tarea_id', taskId);
    } catch {
      // Ignorar si se eliminó en cascada por foreign key
    }

    // Recalcular progreso con las tareas restantes
    const { data: allTasks } = await db
      .from('tareas')
      .select('completado')
      .eq('id_proyecto', projectId);

    let newProgreso = 0;
    let isProjectCompleted = false;
    if (allTasks && allTasks.length > 0) {
      const completedCount = allTasks.filter((t) => t.completado).length;
      newProgreso = Math.round((completedCount / allTasks.length) * 100);
      isProjectCompleted = completedCount === allTasks.length;
    }

    try {
      const { error: projError } = await db
        .from('projects')
        .update({ progreso: newProgreso, completado: isProjectCompleted })
        .eq('id', projectId)
        .eq('user_id', user.id);

      if (projError && projError.message.includes('completado')) {
        await db
          .from('projects')
          .update({ progreso: newProgreso })
          .eq('id', projectId)
          .eq('user_id', user.id);
      }
    } catch {
      await db
        .from('projects')
        .update({ progreso: newProgreso })
        .eq('id', projectId)
        .eq('user_id', user.id);
    }

    // Sincronizar racha de forma consistente: si el usuario ya no tiene tareas completadas, resetear racha a 0
    try {
      const { data: userProjects } = await db.from('projects').select('id').eq('user_id', user.id);

      const uProjIds = (userProjects ?? []).map((p) => p.id);
      if (uProjIds.length > 0) {
        const { data: remainingCompleted } = await db
          .from('tareas')
          .select('id')
          .in('id_proyecto', uProjIds)
          .eq('completado', true);

        const totalCompleted = remainingCompleted?.length ?? 0;
        if (totalCompleted === 0) {
          await db.from('profiles').update({ racha_activa: 0 }).eq('id', user.id);
        } else {
          const { data: prof } = await db
            .from('profiles')
            .select('racha_activa')
            .eq('id', user.id)
            .maybeSingle();

          if (prof && typeof prof.racha_activa === 'number' && prof.racha_activa > totalCompleted) {
            await db.from('profiles').update({ racha_activa: totalCompleted }).eq('id', user.id);
          }
        }
      } else {
        await db.from('profiles').update({ racha_activa: 0 }).eq('id', user.id);
      }
    } catch (streakSyncErr) {
      console.error('Error sincronizando racha al eliminar tarea:', streakSyncErr);
    }

    revalidatePath(`/proyectos/${projectId}`);
    revalidatePath('/proyectos');
    revalidatePath('/calendario');
    revalidatePath('/perfil');
    revalidatePath('/');

    return { success: true, progreso: newProgreso, completado: isProjectCompleted };
  } catch (error: unknown) {
    console.error('Error en deleteTaskAction:', error);
    const msg = error instanceof Error ? error.message : 'Error inesperado.';
    return { success: false, error: msg };
  }
}

/**
 * deleteProjectAction
 * Elimina un proyecto de la tabla 'projects' y sus tareas asociadas en 'tareas'.
 */
export async function deleteProjectAction(projectId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'No se encontró una sesión activa.' };
    }

    if (!(await userOwnsProject(supabase, user.id, projectId))) {
      return { success: false, error: 'No tienes permiso para eliminar este proyecto.' };
    }

    const db = supabase;

    // Eliminar tareas asociadas primero
    await db.from('tareas').delete().eq('id_proyecto', projectId);

    // Eliminar eventos de calendario asociados al proyecto
    try {
      await db.from('eventos_calendario').delete().eq('proyecto_id', projectId);
    } catch {
      // Ignorar si no existen o se eliminaron por cascade
    }

    // Eliminar el proyecto
    const { error: projectDeleteError } = await db
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', user.id);

    if (projectDeleteError) {
      return { success: false, error: projectDeleteError.message };
    }

    // Sincronizar racha de forma consistente: si tras eliminar el proyecto no quedan tareas completadas, resetear racha a 0
    try {
      const { data: userProjects } = await db.from('projects').select('id').eq('user_id', user.id);

      const remainingProjIds = (userProjects ?? []).map((p) => p.id);
      if (remainingProjIds.length > 0) {
        const { data: remainingCompleted } = await db
          .from('tareas')
          .select('id')
          .in('id_proyecto', remainingProjIds)
          .eq('completado', true);

        const totalCompleted = remainingCompleted?.length ?? 0;
        if (totalCompleted === 0) {
          await db.from('profiles').update({ racha_activa: 0 }).eq('id', user.id);
        } else {
          const { data: prof } = await db
            .from('profiles')
            .select('racha_activa')
            .eq('id', user.id)
            .maybeSingle();

          if (prof && typeof prof.racha_activa === 'number' && prof.racha_activa > totalCompleted) {
            await db.from('profiles').update({ racha_activa: totalCompleted }).eq('id', user.id);
          }
        }
      } else {
        await db.from('profiles').update({ racha_activa: 0 }).eq('id', user.id);
      }
    } catch (streakSyncErr) {
      console.error('Error sincronizando racha al eliminar proyecto:', streakSyncErr);
    }

    revalidatePath('/proyectos');
    revalidatePath('/calendario');
    revalidatePath('/perfil');
    revalidatePath('/');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error en deleteProjectAction:', error);
    const msg = error instanceof Error ? error.message : 'Error inesperado.';
    return { success: false, error: msg };
  }
}

/**
 * updateTaskAction
 * Actualiza los datos de una tarea existente en 'tareas' y recalcula progreso y completado en 'projects'.
 */
export async function updateTaskAction(data: {
  taskId: string;
  projectId: string;
  titulo: string;
  duracion: number; // en minutos
  descripcion?: string;
  prioridad?: string;
  fecha_inicio?: string | null;
  resources?: string | null;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'No se encontró una sesión activa.' };
    }

    if (!(await userOwnsProject(supabase, user.id, data.projectId))) {
      return {
        success: false,
        error: 'No tienes permiso para modificar las tareas de este proyecto.',
      };
    }

    // [VALIDACIÓN BACKEND DE CONTENIDO]: Palabras obscenas o peligrosas
    const contentValidation = validateContent(`${data.titulo} ${data.descripcion || ''}`);
    if (!contentValidation.isValid) {
      return {
        success: false,
        error:
          contentValidation.error ||
          'La tarea contiene términos obscenos o peligrosos no permitidos.',
      };
    }

    const db = supabase;

    let parsedFechaInicio: string | null = null;
    if (data.fecha_inicio) {
      try {
        const d = new Date(data.fecha_inicio);
        parsedFechaInicio = isNaN(d.getTime()) ? data.fecha_inicio : d.toISOString();
      } catch {
        parsedFechaInicio = data.fecha_inicio;
      }
    }

    const trimmedTitle = (data.titulo || '').trim();
    if (!trimmedTitle) {
      return { success: false, error: 'El título de la tarea es obligatorio.' };
    }
    if (trimmedTitle.length > 100) {
      return {
        success: false,
        error: 'El título de la tarea no puede exceder los 100 caracteres.',
      };
    }

    // Comprobación de fecha y conflictos de horario con otras tareas del proyecto (excluyendo la tarea actual)
    if (parsedFechaInicio) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDateTime = new Date(parsedFechaInicio);
      if (startDateTime < today) {
        return {
          success: false,
          error: 'El día de inicio no puede ser anterior a la fecha de hoy.',
        };
      }

      // Validar contra la fecha límite del proyecto
      const { data: projectRecord } = await db
        .from('projects')
        .select('fecha_limite')
        .eq('id', data.projectId)
        .maybeSingle();

      if (projectRecord?.fecha_limite) {
        const deadlineDay = projectRecord.fecha_limite.split('T')[0];
        const [deadY, deadM, deadD] = deadlineDay.split('-').map(Number);
        const projectDeadline = new Date(deadY, deadM - 1, deadD, 23, 59, 59, 999);

        const taskDayStr = data.fecha_inicio
          ? data.fecha_inicio.split('T')[0]
          : parsedFechaInicio.split('T')[0];

        // Se permite registrar o editar tareas hasta el mismo día límite inclusive (taskDayStr <= deadlineDay)
        if (taskDayStr > deadlineDay || startDateTime.getTime() > projectDeadline.getTime()) {
          return {
            success: false,
            error: `El día de inicio no puede superar la fecha límite del proyecto (${deadlineDay}).`,
          };
        }
      }
      const newStart = new Date(parsedFechaInicio).getTime();
      const newDurationMinutes = Math.max(1, Math.round(Number(data.duracion)) || 1);
      const newEnd = newStart + newDurationMinutes * 60 * 1000;

      // Obtener todos los proyectos del usuario para verificar colisiones en todo su calendario
      const { data: userProjects } = await db.from('projects').select('id').eq('user_id', user.id);
      const userProjIds = (userProjects || []).map((p) => p.id);

      const { data: existingTasks } = await db
        .from('tareas')
        .select('id, titulo, fecha_inicio, duracion')
        .in('id_proyecto', userProjIds.length > 0 ? userProjIds : [data.projectId])
        .neq('id', data.taskId)
        .not('fecha_inicio', 'is', null);

      if (existingTasks && existingTasks.length > 0) {
        for (const existing of existingTasks) {
          if (!existing.fecha_inicio) continue;
          const exStart = new Date(existing.fecha_inicio).getTime();
          if (isNaN(exStart)) continue;

          const exDuration = Math.max(1, Number(existing.duracion) || 1);
          const exEnd = exStart + exDuration * 60 * 1000;

          // Caso 1: Fecha y hora exactamente igual
          if (newStart === exStart) {
            return {
              success: false,
              error: `El bloque horario seleccionado ya se encuentra ocupado por la tarea "${existing.titulo}". Por favor, intenta utilizar otra hora o bloque disponible dentro del mismo día.`,
            };
          }

          // Caso 2: Conflicto de duración con horario de otra tarea
          if (newStart < exEnd && exStart < newEnd) {
            const exStartStr = new Date(existing.fecha_inicio).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });
            const exEndStr = new Date(exEnd).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });
            return {
              success: false,
              error: `El tiempo de duración entra en conflicto con la tarea "${existing.titulo}" (${exStartStr} - ${exEndStr}). Por favor, intenta utilizar otra hora o bloque disponible dentro del mismo día.`,
            };
          }
        }
      }

      // 2. Verificar colisiones con eventos_calendario (excluyendo el evento de esta misma tarea)
      const { data: calEvents } = await db
        .from('eventos_calendario')
        .select('id, titulo, inicio, fin, tarea_id')
        .eq('usuario_id', user.id)
        .neq('estado', 'cancelado');

      if (calEvents && calEvents.length > 0) {
        for (const ev of calEvents) {
          if (ev.tarea_id === data.taskId) continue;
          if (!ev.inicio || !ev.fin) continue;
          const evStart = new Date(ev.inicio).getTime();
          const evEnd = new Date(ev.fin).getTime();
          if (isNaN(evStart) || isNaN(evEnd)) continue;

          if (newStart < evEnd && evStart < newEnd) {
            const evStartStr = new Date(ev.inicio).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });
            const evEndStr = new Date(ev.fin).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });
            return {
              success: false,
              error: `El horario seleccionado entra en conflicto con el evento o tarea "${ev.titulo}" (${evStartStr} - ${evEndStr}) en tu calendario. Por favor, intenta utilizar otra hora o bloque disponible.`,
            };
          }
        }
      }

      // 3. Verificar colisiones con bloques_disponibilidad ocupados (estudio, trabajo, ocupado, descanso, otra_actividad)
      const { data: busyBlocks } = await db
        .from('bloques_disponibilidad')
        .select('id, dia_semana, fecha_especifica, hora_inicio, hora_fin, tipo')
        .eq('usuario_id', user.id)
        .neq('tipo', 'tareas');

      if (busyBlocks && busyBlocks.length > 0) {
        const taskDateStr = parsedFechaInicio.split('T')[0];
        const taskDateObj = new Date(parsedFechaInicio);
        const taskDayOfWeek = taskDateObj.getDay();
        const taskStartMin = taskDateObj.getHours() * 60 + taskDateObj.getMinutes();
        const taskEndMin = taskStartMin + newDurationMinutes;

        for (const busy of busyBlocks) {
          let matchesDay = false;
          if (busy.fecha_especifica) {
            matchesDay = busy.fecha_especifica === taskDateStr;
          } else if (busy.dia_semana !== null && busy.dia_semana !== undefined) {
            matchesDay = busy.dia_semana === taskDayOfWeek;
          }

          if (matchesDay) {
            const [bh1, bm1] = busy.hora_inicio.split(':').map(Number);
            const [bh2, bm2] = busy.hora_fin.split(':').map(Number);
            const busyStartMin = (bh1 || 0) * 60 + (bm1 || 0);
            const busyEndMin = (bh2 || 0) * 60 + (bm2 || 0);

            if (Math.max(taskStartMin, busyStartMin) < Math.min(taskEndMin, busyEndMin)) {
              const tipoLabel =
                busy.tipo === 'estudio'
                  ? 'Estudio'
                  : busy.tipo === 'trabajo'
                    ? 'Trabajo'
                    : busy.tipo === 'ocupado'
                      ? 'Ocupado'
                      : busy.tipo === 'otra_actividad'
                        ? 'Otra actividad'
                        : busy.tipo === 'descanso'
                          ? 'Descanso'
                          : busy.tipo;
              return {
                success: false,
                error: `El horario entra en conflicto con un bloque ocupado en tu calendario (${tipoLabel}) de ${busy.hora_inicio.slice(0, 5)} a ${busy.hora_fin.slice(0, 5)}. Por favor, intenta utilizar otra hora o bloque disponible.`,
              };
            }
          }
        }
      }
    }

    const { data: updatedTask, error: updateError } = await db
      .from('tareas')
      .update({
        titulo: data.titulo.trim(),
        duracion: Math.round(Number(data.duracion)) || 0,
        descripcion: data.descripcion?.trim() || null,
        prioridad: data.prioridad || null,
        fecha_inicio: parsedFechaInicio,
        resources: data.resources?.trim() || null,
      })
      .eq('id', data.taskId)
      .eq('id_proyecto', data.projectId)
      .select()
      .single();

    if (updateError) {
      console.error('Error actualizando tarea:', updateError);
      return { success: false, error: updateError.message };
    }

    // Recalcular progreso y completado del proyecto
    const { data: allTasks } = await db
      .from('tareas')
      .select('completado')
      .eq('id_proyecto', data.projectId);

    let newProgreso = 0;
    let isProjectCompleted = false;
    if (allTasks && allTasks.length > 0) {
      const completedCount = allTasks.filter((t) => t.completado).length;
      newProgreso = Math.round((completedCount / allTasks.length) * 100);
      isProjectCompleted = completedCount === allTasks.length;
    }

    try {
      const { error: projError } = await db
        .from('projects')
        .update({ progreso: newProgreso, completado: isProjectCompleted })
        .eq('id', data.projectId)
        .eq('user_id', user.id);

      if (projError && projError.message.includes('completado')) {
        await db
          .from('projects')
          .update({ progreso: newProgreso })
          .eq('id', data.projectId)
          .eq('user_id', user.id);
      }
    } catch {
      await db
        .from('projects')
        .update({ progreso: newProgreso })
        .eq('id', data.projectId)
        .eq('user_id', user.id);
    }

    // Sincronizar en eventos_calendario para reflejar inmediatamente en el calendario
    try {
      if (parsedFechaInicio) {
        const startIso = new Date(parsedFechaInicio).toISOString();
        const durMin = Math.max(15, Number(data.duracion) || 30);
        const endIso = new Date(
          new Date(parsedFechaInicio).getTime() + durMin * 60 * 1000,
        ).toISOString();

        // Verificar si ya existe un evento para esta tarea
        const { data: existingCalEv } = await db
          .from('eventos_calendario')
          .select('id')
          .eq('tarea_id', data.taskId)
          .maybeSingle();

        if (existingCalEv) {
          await db
            .from('eventos_calendario')
            .update({
              titulo: data.titulo.trim(),
              descripcion: data.descripcion?.trim() || '',
              inicio: startIso,
              fin: endIso,
            })
            .eq('id', existingCalEv.id);
        } else {
          await db.from('eventos_calendario').insert({
            id: crypto.randomUUID(),
            usuario_id: user.id,
            proyecto_id: data.projectId,
            tarea_id: data.taskId,
            titulo: data.titulo.trim(),
            descripcion: data.descripcion?.trim() || '',
            inicio: startIso,
            fin: endIso,
            estado: 'pendiente',
            generado_por_ia: false,
          });
        }
      } else {
        // Si se desasignó la fecha, eliminar el evento del calendario
        await db.from('eventos_calendario').delete().eq('tarea_id', data.taskId);
      }
    } catch (calSyncErr) {
      console.warn('Aviso sincronizando evento de calendario en updateTaskAction:', calSyncErr);
    }

    revalidatePath(`/proyectos/${data.projectId}`);
    revalidatePath('/proyectos');
    revalidatePath('/calendario');
    revalidatePath('/');

    return {
      success: true,
      task: updatedTask,
      progreso: newProgreso,
      completado: isProjectCompleted,
    };
  } catch (error: unknown) {
    console.error('Error en updateTaskAction:', error);
    const msg = error instanceof Error ? error.message : 'Error inesperado al actualizar la tarea.';
    return { success: false, error: msg };
  }
}

/**
 * generateTasksWithN8nAction
 * Server Action para invocar la generación inteligente de tareas para un proyecto existente.
 * Prioridad 1: Gemini (con scheduleAiService, respetando disponibilidad y tareas previas).
 * Prioridad 2 / Fallback: Webhook de n8n (generateProjectTasksFromN8n).
 */
export async function generateTasksWithN8nAction(
  projectId: string,
  extraOptions?: {
    material_url?: string;
    file_content?: string;
    file_name?: string;
  },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'No se encontró una sesión activa.' };
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return { success: false, error: 'Proyecto no encontrado.' };
    }

    // Obtener tareas ya existentes de este proyecto para darles continuidad y no repetirlas
    const { data: existingTasks } = await supabase
      .from('tareas')
      .select('id, titulo, descripcion, completado, fecha_inicio, duracion')
      .eq('id_proyecto', projectId)
      .order('fecha_inicio', { ascending: true });

    // Validar si las tareas existentes ya cubren toda la duración del proyecto hasta su fecha límite
    if (project.fecha_limite && existingTasks && existingTasks.length > 0) {
      const deadlineDay = project.fecha_limite.split('T')[0];
      const hasTaskAtDeadline = existingTasks.some((t) => {
        if (!t.fecha_inicio) return false;
        const taskDay = t.fecha_inicio.split('T')[0];
        return taskDay >= deadlineDay;
      });

      if (hasTaskAtDeadline) {
        return {
          success: false,
          error:
            'Las tareas ya están asignadas a toda la duración del proyecto. Si deseas agregar más tareas, por favor modifica la fecha límite del proyecto.',
        };
      }
    }

    let result: {
      success: boolean;
      count?: number;
      tasks?: TaskRecord[];
      progreso?: number;
      error?: string;
    } | null = null;

    const materialUrl = extraOptions?.material_url?.trim() || project.material_url;

    // =========================================================================
    // PRIORIDAD 1: Google Gemini (@google/genai con gemini-3.8-flash)
    // =========================================================================
    if (process.env.GEMINI_API_KEY) {
      try {
        const geminiResult = await generateProjectTasksAndScheduleWithGemini({
          id: project.id,
          user_id: user.id,
          titulo: project.titulo,
          objetivo: project.objetivo,
          fecha_limite: project.fecha_limite ? project.fecha_limite.split('T')[0] : undefined,
          prioridad: project.prioridad,
          nivel_conocimiento: project.nivel_conocimiento,
          material_url: materialUrl,
          minutos_diarios: project.minutos_diarios,
          file_content: extraOptions?.file_content,
          file_name: extraOptions?.file_name,
          existing_tasks: existingTasks || [],
        });

        if (geminiResult.success && geminiResult.tasks && geminiResult.tasks.length > 0) {
          result = {
            success: true,
            count: geminiResult.count,
            tasks: geminiResult.tasks as unknown as TaskRecord[],
            progreso: geminiResult.progreso,
          };
        } else {
          console.warn(
            'Advertencia: Falló generación con Gemini en proyecto existente, recurriendo a n8n:',
            geminiResult.error,
          );
        }
      } catch (geminiErr) {
        console.warn(
          'Advertencia: Excepción al generar tareas con Gemini en proyecto existente, recurriendo a n8n:',
          geminiErr,
        );
      }
    }

    // =========================================================================
    // PRIORIDAD 2 / FALLBACK: n8n Webhook
    // =========================================================================
    if ((!result || !result.success) && process.env.N8N_WEBHOOK_URL) {
      try {
        const n8nResult = await generateProjectTasksFromN8n({
          user_id: user.id,
          id: project.id,
          titulo: project.titulo,
          objetivo: project.objetivo,
          fecha_limite: project.fecha_limite ? project.fecha_limite.split('T')[0] : undefined,
          prioridad: project.prioridad,
          nivel_conocimiento: project.nivel_conocimiento,
          material_url: materialUrl,
          minutos_diarios: project.minutos_diarios,
          file_content: extraOptions?.file_content,
          file_name: extraOptions?.file_name,
          existing_tasks: existingTasks || [],
        });

        if (n8nResult.success) {
          result = n8nResult;
        } else {
          console.warn(
            'Advertencia: Falló generación con n8n en proyecto existente:',
            n8nResult.error,
          );
        }
      } catch (n8nErr) {
        console.warn(
          'Advertencia: Excepción al generar tareas con n8n en proyecto existente:',
          n8nErr,
        );
      }
    }

    if (!result || !result.success) {
      return {
        success: false,
        isAiUnavailable: true,
        error:
          'El servicio de Inteligencia Artificial se encuentra temporalmente fuera de servicio o no disponible. Puedes crear y organizar tus tareas manualmente usando el botón "Nueva tarea".',
      };
    }

    revalidatePath(`/proyectos/${projectId}`);
    revalidatePath('/proyectos');
    revalidatePath('/');

    return {
      success: true,
      count: result.count,
      tasks: result.tasks,
      progreso: result.progreso,
    };
  } catch (error: unknown) {
    console.error('Error en generateTasksWithN8nAction:', error);
    return {
      success: false,
      isAiUnavailable: true,
      error:
        'El servicio de Inteligencia Artificial no está disponible en este momento. Puedes crear y organizar tus tareas manualmente usando el botón "Nueva tarea".',
    };
  }
}

/**
 * resetStreakOnOverdueAction
 * Reinicia la racha activa a 0 cuando una tarea programada expira sin completarse en el plazo establecido.
 */
export async function resetStreakOnOverdueAction() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'No se encontró una sesión activa.' };
    }

    await supabase.from('profiles').update({ racha_activa: 0 }).eq('id', user.id);

    revalidatePath('/perfil');
    revalidatePath('/');
    return { success: true, racha_activa: 0 };
  } catch (error: unknown) {
    console.error('Error en resetStreakOnOverdueAction:', error);
    return { success: false, error: 'Error al reiniciar racha.' };
  }
}

/**
 * saveTaskStudyFeedbackAction
 * Guarda la información del método de estudio, tiempo empleado y la valoración
 * de si le sirvió la técnica (sí/no) en la tabla 'tareas'.
 */
export async function saveTaskStudyFeedbackAction(input: {
  taskId: string;
  projectId?: string;
  metodoEstudio?: string;
  tiempoEmpleado?: number;
  tecnicaSirvio?: boolean;
  tecnicaPreferida?: string;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'No se encontró una sesión activa.' };
    }

    if (!input.taskId) {
      return { success: false, error: 'ID de tarea no proporcionado.' };
    }

    const adminDb = getAdminClient();
    const db = adminDb || supabase;

    // 1. Guardar la técnica preferida en la tabla 'profiles'
    if (input.tecnicaPreferida) {
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ tecnica_preferida: input.tecnicaPreferida })
        .eq('id', user.id);

      if (profileErr) {
        console.warn('Aviso guardando tecnica_preferida en profiles:', profileErr.message);
      }
    }

    // 2. Verificar pertenencia del proyecto/tarea
    const { data: taskRecord, error: taskFetchError } = await db
      .from('tareas')
      .select('id, id_proyecto, completado, completed_at, duracion')
      .eq('id', input.taskId)
      .maybeSingle();

    if (taskFetchError || !taskRecord) {
      return { success: false, error: 'Tarea no encontrada.' };
    }

    const targetProjectId = input.projectId || taskRecord.id_proyecto;
    if (targetProjectId) {
      const owns = await userOwnsProject(supabase, user.id, targetProjectId);
      if (!owns) {
        return { success: false, error: 'No tienes permiso para modificar esta tarea.' };
      }
    }

    const updatePayload: Record<string, unknown> = {};
    if (input.metodoEstudio !== undefined) {
      updatePayload.metodo_estudio = input.metodoEstudio;
    } else if (input.tecnicaPreferida) {
      updatePayload.metodo_estudio = input.tecnicaPreferida;
    }

    if (input.tiempoEmpleado !== undefined) {
      updatePayload.tiempo_empleado = input.tiempoEmpleado;
    }
    if (input.tecnicaSirvio !== undefined) {
      updatePayload.tecnica_sirvio = input.tecnicaSirvio;
    } else if (input.tecnicaPreferida) {
      updatePayload.tecnica_sirvio = true;
    }

    // Si aún no tenía completed_at y está completada, asegurar timestamp
    if (taskRecord.completado && !taskRecord.completed_at) {
      updatePayload.completed_at = new Date().toISOString();
    }

    const { error: updateError } = await db
      .from('tareas')
      .update(updatePayload)
      .eq('id', input.taskId);

    // Fallback tolerante si las columnas no están aún en la BD remota
    if (
      updateError &&
      (updateError.message?.includes('metodo_estudio') ||
        updateError.message?.includes('tecnica_sirvio') ||
        updateError.message?.includes('tiempo_empleado') ||
        updateError.code === '42703')
    ) {
      console.warn(
        '[saveTaskStudyFeedbackAction] Columnas de feedback aún no migradas en Supabase:',
        updateError.message,
      );
      return {
        success: true,
        warning: 'Guardado localmente. Recuerda ejecutar la migración de feedback en Supabase.',
      };
    }

    if (updateError) {
      console.error('Error al guardar feedback de técnica en tareas:', updateError);
      return { success: false, error: updateError.message };
    }

    if (targetProjectId) {
      revalidatePath(`/proyectos/${targetProjectId}`);
    }
    revalidatePath('/perfil');

    return { success: true };
  } catch (error: unknown) {
    console.error('Error en saveTaskStudyFeedbackAction:', error);
    const msg = error instanceof Error ? error.message : 'Error inesperado al guardar feedback.';
    return { success: false, error: msg };
  }
}
