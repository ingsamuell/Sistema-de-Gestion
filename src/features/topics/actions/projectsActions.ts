'use server';

import { createClient } from '@/lib/supabase/server';
import { CreateProjectWithMilestonesInput, LinkedProject, ProjectOption } from '../types';
import { validateContent, validateProjectContent } from '@/lib/moderation/contentFilter';

interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function getUserProjectsAction(
  topicId?: string,
): Promise<ActionResponse<ProjectOption[]>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    // 1. Proyectos del usuario
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, titulo, objetivo, progreso, completado')
      .eq('user_id', user.id)
      // .order('created_at', { ascending: false }); // Real projects schema doesn't have created_at
      .order('titulo', { ascending: true });

    if (projectsError) {
      return { success: false, error: projectsError.message };
    }

    if (!projects || projects.length === 0) {
      return { success: true, data: [] };
    }

    const projectIds = projects.map((p) => p.id);

    // 2. Tareas para calcular progreso real
    const { data: tareasData } = await supabase
      .from('tareas')
      .select('*')
      .in('id_proyecto', projectIds);

    const statsMap: Record<string, { total: number; completed: number }> = {};
    (tareasData || []).forEach((t) => {
      if (!statsMap[t.id_proyecto]) {
        statsMap[t.id_proyecto] = { total: 0, completed: 0 };
      }
      statsMap[t.id_proyecto].total += 1;
      if (t.completado) {
        statsMap[t.id_proyecto].completed += 1;
      }
    });

    // 3. Proyectos ya vinculados al topicId (si se proporciona)
    let linkedProjectId: string | undefined;
    if (topicId) {
      const { data: topic } = await supabase
        .from('topics')
        .select('project_id')
        .eq('id', topicId)
        .eq('user_id', user.id)
        .single();

      if (topic?.project_id) {
        linkedProjectId = topic.project_id;
      }
    }

    const result: ProjectOption[] = projects.map((p) => {
      const stats = statsMap[p.id] || { total: 0, completed: 0 };
      const progress =
        p.progreso || (stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0);
      return {
        id: p.id,
        name: p.titulo,
        description: p.objetivo || '',
        status: p.completado ? 'completed' : 'active',
        progress,
        totalMilestones: stats.total,
        completedMilestones: stats.completed,
        isLinked: p.id === linkedProjectId,
      };
    });

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener proyectos',
    };
  }
}

export async function linkProjectAction(
  topicId: string,
  projectId: string,
): Promise<ActionResponse<LinkedProject>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    // Vincular actualizando el topic
    const { error: updateError } = await supabase
      .from('topics')
      .update({ project_id: projectId })
      .eq('id', topicId)
      .eq('user_id', user.id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Obtener detalles del proyecto y sus tareas para calcular progreso
    const { data: project, error: pError } = await supabase
      .from('projects')
      .select('id, titulo, objetivo, progreso, completado')
      .eq('id', projectId)
      .single();

    if (pError || !project) {
      return { success: false, error: 'Proyecto no encontrado' };
    }

    const { data: tareasData } = await supabase
      .from('tareas')
      .select('completado')
      .eq('id_proyecto', projectId);

    const totalMilestones = tareasData?.length || 0;
    const completedMilestones = tareasData?.filter((t) => t.completado).length || 0;
    const progress =
      project.progreso ||
      (totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0);

    const linkedProject: LinkedProject = {
      id: project.id,
      name: project.titulo,
      description: project.objetivo || '',
      detail: project.completado ? 'Proyecto completado' : 'Proyecto activo',
      status: project.completado ? 'completed' : 'active',
      progress,
      totalMilestones,
      completedMilestones,
    };

    return { success: true, data: linkedProject };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al vincular el proyecto',
    };
  }
}

export async function unlinkProjectAction(
  topicId: string,
  _projectId?: string, // No longer strictly necessary but kept for signature compatibility
): Promise<ActionResponse<boolean>> {
  void _projectId;
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    const { error } = await supabase
      .from('topics')
      .update({ project_id: null })
      .eq('id', topicId)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al desvincular el proyecto',
    };
  }
}

export async function createProjectWithMilestonesAction(
  input: CreateProjectWithMilestonesInput,
  topicIdToLink?: string,
): Promise<ActionResponse<LinkedProject>> {
  const name = input.name.trim();
  if (!name) {
    return { success: false, error: 'El nombre del proyecto es obligatorio.' };
  }

  // [VALIDACIÓN BACKEND DE CONTENIDO]: Nombre y descripción de proyecto
  const projectValidation = validateProjectContent(name, input.description);
  if (!projectValidation.isValid) {
    return {
      success: false,
      error: projectValidation.error || 'El proyecto contiene términos no permitidos.',
    };
  }

  // [VALIDACIÓN BACKEND DE CONTENIDO]: Hitos/Tareas
  const cleanMilestones = (input.milestones || []).map((m) => m.trim()).filter((m) => m.length > 0);

  for (const milestone of cleanMilestones) {
    const milestoneValidation = validateContent(milestone);
    if (!milestoneValidation.isValid) {
      return {
        success: false,
        error: milestoneValidation.error || 'Uno de los hitos contiene términos no permitidos.',
      };
    }
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    // 1. Crear proyecto (con el schema real)
    const projectId = crypto.randomUUID();
    const { data: project, error: pError } = await supabase
      .from('projects')
      .insert({
        id: projectId,
        user_id: user.id,
        titulo: name,
        objetivo: input.description?.trim() || '',
        fecha_limite: new Date().toISOString(), // Necesita una fecha límite por el tipo
        prioridad: 'Media',
        nivel_conocimiento: 'Intermedio',
        minutos_diarios: 30,
        progreso: 0,
        completado: false,
      })
      .select('id, titulo, objetivo, progreso, completado')
      .single();

    if (pError || !project) {
      return { success: false, error: pError?.message || 'Error al crear proyecto' };
    }

    // 2. Crear tareas si existen
    const cleanMilestones = (input.milestones || [])
      .map((m) => m.trim())
      .filter((m) => m.length > 0);

    const completedCount = 0;
    if (cleanMilestones.length > 0) {
      const baseDate = new Date();
      const milestoneRows = cleanMilestones.map((title, idx) => {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + idx + 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const fechaInicio = new Date(`${y}-${m}-${day}T09:00:00`).toISOString();
        const fechaLimite = new Date(
          new Date(fechaInicio).getTime() + 30 * 60 * 1000,
        ).toISOString();

        return {
          id: crypto.randomUUID(),
          id_proyecto: project.id,
          user_id: user.id,
          titulo: title,
          completado: false,
          duracion: 30,
          fecha_inicio: fechaInicio,
          fecha_limite: fechaLimite,
          metodo_estudio: null,
        };
      });

      await supabase.from('tareas').insert(milestoneRows);
    }

    // 3. Vincular al tema si se solicitó
    if (topicIdToLink) {
      await supabase
        .from('topics')
        .update({ project_id: project.id })
        .eq('id', topicIdToLink)
        .eq('user_id', user.id);
    }

    const totalMilestones = cleanMilestones.length;
    const progress = totalMilestones > 0 ? Math.round((completedCount / totalMilestones) * 100) : 0;

    const linkedProject: LinkedProject = {
      id: project.id,
      name: project.titulo,
      description: project.objetivo || '',
      detail: 'Proyecto activo',
      status: 'active',
      progress,
      totalMilestones,
      completedMilestones: completedCount,
    };

    return { success: true, data: linkedProject };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear proyecto',
    };
  }
}
