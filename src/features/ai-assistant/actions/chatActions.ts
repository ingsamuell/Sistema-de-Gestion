'use server';

import { createClient } from '@/lib/supabase/server';
import type { AssistantMessage, FileAttachment, GeneratedTaskItem } from '@/components/ia/types';
import { validateContent } from '@/lib/moderation/contentFilter';

export interface ConversationSummary {
  id: string;
  user_id: string;
  title: string;
  model_used?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Obtiene todas las conversaciones activas del usuario autenticado ordenadas por última actualización.
 */
export async function getConversationsAction(): Promise<{
  success: boolean;
  data: ConversationSummary[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      return { success: false, data: [], error: 'Usuario no autenticado' };
    }

    const { data, error } = await supabase
      .from('conversations')
      .select('id, user_id, title, model_used, is_archived, created_at, updated_at')
      .eq('user_id', auth.user.id)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error al obtener conversaciones:', error);
      return { success: false, data: [], error: error.message };
    }

    return { success: true, data: (data as ConversationSummary[]) || [] };
  } catch (error) {
    console.error('Error inesperado en getConversationsAction:', error);
    return { success: false, data: [], error: 'Error inesperado al cargar historial' };
  }
}

/**
 * Obtiene los mensajes de una conversación específica.
 */
export async function getConversationMessagesAction(conversationId: string): Promise<{
  success: boolean;
  data: AssistantMessage[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      return { success: false, data: [], error: 'Usuario no autenticado' };
    }

    const { data, error } = await supabase
      .from('messages')
      .select('id, conversation_id, sender, content, context_data, tokens_count, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error al obtener mensajes:', error);
      return { success: false, data: [], error: error.message };
    }

    const messages: AssistantMessage[] = (data || []).map((row) => {
      const contextData = (row.context_data as Record<string, unknown>) || {};
      return {
        id: row.id,
        role: row.sender === 'user' ? 'user' : 'assistant',
        content: row.content,
        createdAt: row.created_at,
        conversationId: row.conversation_id,
        contextData,
        tasks: (contextData.tasks as unknown as GeneratedTaskItem[]) || undefined,
        planTitle: (contextData.planTitle as string) || undefined,
        fileAttachment: (contextData.file as unknown as FileAttachment) || undefined,
        intent: (contextData.intent as AssistantMessage['intent']) || undefined,
        targetProjectId: (contextData.targetProjectId as string) || undefined,
        targetProjectTitle: (contextData.targetProjectTitle as string) || undefined,
        projectLink: (contextData.projectLink as string) || undefined,
        skipQuestions: (contextData.skipQuestions as number) || undefined,
        suggestedTopicTitle: (contextData.suggestedTopicTitle as string) || undefined,
        suggestedTopicObjective: (contextData.suggestedTopicObjective as string) || undefined,
      };
    });

    return { success: true, data: messages };
  } catch (error) {
    console.error('Error inesperado en getConversationMessagesAction:', error);
    return { success: false, data: [], error: 'Error al cargar mensajes' };
  }
}

/**
 * Crea una nueva conversación para el usuario.
 */
export async function createConversationAction(title?: string): Promise<{
  success: boolean;
  data?: ConversationSummary;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    const cleanTitle = (
      title && title.trim().length > 0 ? title.trim() : 'Nueva conversación'
    ).slice(0, 80);

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: auth.user.id,
        title: cleanTitle,
        model_used: 'n8n-komo',
        is_archived: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error al crear conversación:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as ConversationSummary };
  } catch (error) {
    console.error('Error inesperado en createConversationAction:', error);
    return { success: false, error: 'Error al crear la conversación' };
  }
}

/**
 * Guarda un mensaje (de usuario o asistente) en la tabla messages y actualiza el timestamp de la conversación.
 */
export async function saveMessageAction(params: {
  conversationId: string;
  sender: 'user' | 'assistant';
  content: string;
  contextData?: Record<string, unknown>;
}): Promise<{
  success: boolean;
  data?: AssistantMessage;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: params.conversationId,
        sender: params.sender,
        content: params.content,
        context_data: params.contextData || {},
        tokens_count: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error al guardar mensaje:', error);
      return { success: false, error: error.message };
    }

    // Actualizar updated_at en conversations
    await supabase
      .from('conversations')
      .update({ updated_at: now })
      .eq('id', params.conversationId);

    const ctx = (data.context_data as Record<string, unknown>) || {};
    const savedMessage: AssistantMessage = {
      id: data.id,
      role: data.sender === 'user' ? 'user' : 'assistant',
      content: data.content,
      createdAt: data.created_at,
      conversationId: data.conversation_id,
      contextData: ctx,
      tasks: (ctx.tasks as unknown as GeneratedTaskItem[]) || undefined,
      planTitle: (ctx.planTitle as string) || undefined,
      fileAttachment: (ctx.file as unknown as FileAttachment) || undefined,
      intent: (ctx.intent as AssistantMessage['intent']) || undefined,
      targetProjectId: (ctx.targetProjectId as string) || undefined,
      targetProjectTitle: (ctx.targetProjectTitle as string) || undefined,
      projectLink: (ctx.projectLink as string) || undefined,
      skipQuestions: (ctx.skipQuestions as number) || undefined,
      suggestedTopicTitle: (ctx.suggestedTopicTitle as string) || undefined,
      suggestedTopicObjective: (ctx.suggestedTopicObjective as string) || undefined,
    };

    return { success: true, data: savedMessage };
  } catch (error) {
    console.error('Error inesperado en saveMessageAction:', error);
    return { success: false, error: 'Error al registrar mensaje' };
  }
}

/**
 * Actualiza el título de una conversación.
 */
export async function updateConversationTitleAction(
  conversationId: string,
  title: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    const cleanTitle = title.trim().slice(0, 100);
    if (!cleanTitle) return { success: false, error: 'Título inválido' };

    const { error } = await supabase
      .from('conversations')
      .update({
        title: cleanTitle,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('user_id', auth.user.id);

    if (error) {
      console.error('Error al actualizar título de conversación:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error inesperado en updateConversationTitleAction:', error);
    return { success: false, error: 'Error al actualizar título' };
  }
}

/**
 * Elimina una conversación y sus mensajes asociados.
 */
export async function deleteConversationAction(
  conversationId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    // Eliminar mensajes primero si no hubiera cascade
    await supabase.from('messages').delete().eq('conversation_id', conversationId);

    // Eliminar conversación
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', auth.user.id);

    if (error) {
      console.error('Error al eliminar conversación:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error inesperado en deleteConversationAction:', error);
    return { success: false, error: 'Error al eliminar conversación' };
  }
}

/**
 * Crea un nuevo proyecto en Supabase a partir de las tareas y plan generados por la IA.
 */
export async function createProjectFromAITasksAction(params: {
  title: string;
  tasks: Array<{
    title?: string;
    titulo?: string;
    description?: string;
    descripcion?: string;
    duration?: string | number;
    duracion?: string | number;
    resourceUrl?: string;
    resource_url?: string;
  }>;
}): Promise<{ success: boolean; projectId?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    const projectTitle = (params.title || 'Plan de estudio sugerido').trim().slice(0, 100);

    const titleValidation = validateContent(projectTitle);
    if (!titleValidation.isValid) {
      return {
        success: false,
        error: titleValidation.error || 'El título del proyecto contiene términos no permitidos.',
      };
    }

    const { data: project, error: projErr } = await supabase
      .from('projects')
      .insert({
        user_id: auth.user.id,
        titulo: projectTitle,
        objetivo: 'Plan de estudio e ideas generadas por el Asistente IA',
        fecha_limite: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        prioridad: 'Prioritario',
        nivel_conocimiento: 'Principiante',
        progreso: 0,
        completado: false,
        minutos_diarios: 30,
      })
      .select()
      .single();

    if (projErr || !project) {
      console.error('Error al crear proyecto desde tareas de IA:', projErr);
      return { success: false, error: projErr?.message || 'Error al crear proyecto' };
    }

    if (params.tasks && params.tasks.length > 0) {
      const baseDate = new Date();
      const tasksToInsert = params.tasks.map((t, idx) => {
        const rawDur = t.duration || t.duracion;
        let durMins = 30;
        if (typeof rawDur === 'number' && rawDur > 0) durMins = Math.round(rawDur);
        else if (typeof rawDur === 'string') {
          const num = parseInt(rawDur.replace(/\D+/g, ''), 10);
          if (!isNaN(num) && num > 0) durMins = num;
        }

        const targetNumber = idx + 1;
        const rawTitle = (t.title || t.titulo || `Tarea ${targetNumber}`).trim().slice(0, 120);
        const cleanTitle = rawTitle.replace(/^(?:tarea\s*)?\d+[\.\)\-:\s]+/i, '').trim();
        const taskTitle = cleanTitle
          ? `${targetNumber}. ${cleanTitle}`
          : `${targetNumber}. ${rawTitle}`;

        const taskDesc = (t.description || t.descripcion || '').trim();
        const taskRes = (t.resourceUrl || t.resource_url || '').trim() || null;

        const d = new Date(baseDate);
        d.setDate(d.getDate() + idx + 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const fechaInicio = new Date(`${y}-${m}-${day}T09:00:00`).toISOString();
        const fechaLimite = new Date(
          new Date(fechaInicio).getTime() + durMins * 60 * 1000,
        ).toISOString();

        return {
          id: crypto.randomUUID(),
          id_proyecto: project.id,
          titulo: taskTitle,
          descripcion: taskDesc || null,
          duracion: durMins,
          completado: false,
          fecha_inicio: fechaInicio,
          fecha_limite: fechaLimite,
          resources: taskRes,
          prioridad: 'Prioritario',
          metodo_estudio: null,
        };
      });

      const { error: taskErr } = await supabase.from('tareas').insert(tasksToInsert);
      if (taskErr) {
        console.warn('Advertencia insertando tareas en proyecto:', taskErr);
      } else {
        const eventsToInsert = tasksToInsert.map((t) => ({
          id: crypto.randomUUID(),
          usuario_id: auth.user.id,
          proyecto_id: project.id,
          tarea_id: t.id,
          titulo: t.titulo,
          descripcion: t.descripcion || '',
          inicio: t.fecha_inicio,
          fin: t.fecha_limite,
          estado: 'pendiente' as const,
          generado_por_ia: true,
        }));
        await supabase.from('eventos_calendario').insert(eventsToInsert);
      }
    }

    return { success: true, projectId: project.id };
  } catch (error) {
    console.error('Error inesperado en createProjectFromAITasksAction:', error);
    return { success: false, error: 'Error al generar proyecto desde tareas de IA' };
  }
}

/**
 * Agrega tareas generadas por la IA a un proyecto existente y recalcula su progreso.
 */
export async function addTasksToExistingProjectAction(params: {
  projectId: string;
  tasks: Array<{
    title?: string;
    titulo?: string;
    description?: string;
    descripcion?: string;
    duration?: string | number;
    duracion?: string | number;
    resourceUrl?: string;
    resource_url?: string;
  }>;
}): Promise<{ success: boolean; projectTitle?: string; addedCount?: number; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    // Verificar que el proyecto pertenece al usuario
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('id, titulo')
      .eq('id', params.projectId)
      .eq('user_id', auth.user.id)
      .single();

    if (projErr || !project) {
      return { success: false, error: 'Proyecto no encontrado o sin permisos' };
    }

    if (params.tasks && params.tasks.length > 0) {
      const { data: existingTasks } = await supabase
        .from('tareas')
        .select('id, titulo, fecha_inicio')
        .eq('id_proyecto', project.id);

      const existingCount = existingTasks ? existingTasks.length : 0;
      let latestDate = new Date();
      if (existingTasks && existingTasks.length > 0) {
        for (const et of existingTasks) {
          if (et.fecha_inicio) {
            const ed = new Date(et.fecha_inicio);
            if (ed > latestDate) latestDate = ed;
          }
        }
      }

      const tasksToInsert = params.tasks.map((t, idx) => {
        const rawDur = t.duration || t.duracion;
        let durMins = 30;
        if (typeof rawDur === 'number' && rawDur > 0) durMins = Math.round(rawDur);
        else if (typeof rawDur === 'string') {
          const num = parseInt(rawDur.replace(/\D+/g, ''), 10);
          if (!isNaN(num) && num > 0) durMins = num;
        }

        const targetNumber = existingCount + idx + 1;
        const rawTitle = (t.title || t.titulo || `Tarea ${targetNumber}`).trim().slice(0, 120);
        const cleanTitle = rawTitle.replace(/^(?:tarea\s*)?\d+[\.\)\-:\s]+/i, '').trim();
        const taskTitle = cleanTitle
          ? `${targetNumber}. ${cleanTitle}`
          : `${targetNumber}. ${rawTitle}`;

        const taskDesc = (t.description || t.descripcion || '').trim();
        const taskRes = (t.resourceUrl || t.resource_url || '').trim() || null;

        const d = new Date(latestDate);
        d.setDate(d.getDate() + idx + 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const fechaInicio = new Date(`${y}-${m}-${day}T09:00:00`).toISOString();
        const fechaLimite = new Date(
          new Date(fechaInicio).getTime() + durMins * 60 * 1000,
        ).toISOString();

        return {
          id: crypto.randomUUID(),
          id_proyecto: project.id,
          titulo: taskTitle,
          descripcion: taskDesc || null,
          duracion: durMins,
          completado: false,
          fecha_inicio: fechaInicio,
          fecha_limite: fechaLimite,
          resources: taskRes,
          prioridad: 'Prioritario',
          metodo_estudio: null,
        };
      });

      const { error: taskErr } = await supabase.from('tareas').insert(tasksToInsert);
      if (taskErr) {
        console.error('Error al insertar tareas adicionales:', taskErr);
        return { success: false, error: taskErr.message };
      }

      const eventsToInsert = tasksToInsert.map((t) => ({
        id: crypto.randomUUID(),
        usuario_id: auth.user.id,
        proyecto_id: project.id,
        tarea_id: t.id,
        titulo: t.titulo,
        descripcion: t.descripcion || '',
        inicio: t.fecha_inicio,
        fin: t.fecha_limite,
        estado: 'pendiente' as const,
        generado_por_ia: true,
      }));
      await supabase.from('eventos_calendario').insert(eventsToInsert);

      // Recalcular progreso del proyecto
      const { data: allTasks } = await supabase
        .from('tareas')
        .select('completado')
        .eq('id_proyecto', project.id);

      let newProgreso = 0;
      if (allTasks && allTasks.length > 0) {
        const completed = allTasks.filter((t) => t.completado).length;
        newProgreso = Math.round((completed / allTasks.length) * 100);
      }

      await supabase.from('projects').update({ progreso: newProgreso }).eq('id', project.id);

      return {
        success: true,
        projectTitle: project.titulo,
        addedCount: tasksToInsert.length,
      };
    }

    return { success: true, projectTitle: project.titulo, addedCount: 0 };
  } catch (error) {
    console.error('Error inesperado en addTasksToExistingProjectAction:', error);
    return { success: false, error: 'Error al actualizar tareas del proyecto' };
  }
}

/**
 * Obtiene los proyectos activos del usuario (id y titulo) para usarlos en el selector del chat.
 */
export async function getUserProjectsForChatAction(): Promise<{
  success: boolean;
  data: Array<{ id: string; titulo: string; progreso: number }>;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      return { success: false, data: [] };
    }

    const { data, error } = await supabase
      .from('projects')
      .select('id, titulo, progreso')
      .eq('user_id', auth.user.id)
      .eq('completado', false)
      .order('progreso', { ascending: true });

    if (error) {
      return { success: false, data: [] };
    }

    return { success: true, data: data || [] };
  } catch {
    return { success: false, data: [] };
  }
}
