'use server';

import { createClient } from '@/lib/supabase/server';
import {
  CreateFileSourceInput,
  CreateLinkSourceInput,
  CreateNoteSourceInput,
  TopicSource,
} from '../types';
import { formatFileSize, formatRelativeDate } from '../utils/formatters';
import { validateContent } from '@/lib/moderation/contentFilter';

interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function createNoteSourceAction(
  input: CreateNoteSourceInput,
): Promise<ActionResponse<TopicSource>> {
  const title = input.title.trim();
  const content = input.content.trim();

  if (!title) {
    return { success: false, error: 'El título de la nota es obligatorio.' };
  }

  // [VALIDACIÓN BACKEND DE CONTENIDO]: Términos obscenos o peligrosos
  const noteValidation = validateContent(`${title} ${content}`);
  if (!noteValidation.isValid) {
    return {
      success: false,
      error: noteValidation.error || 'No se permiten contenidos obscenos.',
    };
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

    const { data, error } = await supabase
      .from('sources')
      .insert({
        topic_id: input.topicId,
        user_id: user.id,
        title,
        kind: 'Nota',
        content,
        status: 'ready',
        is_in_context: false,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Actualizar updated_at del tema
    await supabase
      .from('topics')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', input.topicId);

    const source: TopicSource = {
      id: data.id,
      topicId: data.topic_id,
      title: data.title,
      kind: 'Nota',
      content: data.content || '',
      fileUrl: '',
      filePath: '',
      fileSize: 0,
      fileType: '',
      detail: formatRelativeDate(data.created_at),
      status: data.status,
      enabledForAi: data.is_in_context,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return { success: true, data: source };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al guardar la nota',
    };
  }
}

export async function createLinkSourceAction(
  input: CreateLinkSourceInput,
): Promise<ActionResponse<TopicSource>> {
  let url = input.url.trim();
  const title = (input.title || '').trim() || url;

  if (!url) {
    return { success: false, error: 'La URL del enlace es obligatoria.' };
  }

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    new URL(url);
  } catch {
    return { success: false, error: 'La dirección URL introducida no es válida.' };
  }

  // [VALIDACIÓN BACKEND DE CONTENIDO]: Términos obscenos o peligrosos en el enlace o título
  const urlValidation = validateContent(url);
  if (!urlValidation.isValid) {
    return {
      success: false,
      error: urlValidation.error || 'No se permiten contenidos obscenos.',
    };
  }

  if (title) {
    const linkValidation = validateContent(title);
    if (!linkValidation.isValid) {
      return {
        success: false,
        error: linkValidation.error || 'No se permiten contenidos obscenos.',
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

    const { data, error } = await supabase
      .from('sources')
      .insert({
        topic_id: input.topicId,
        user_id: user.id,
        title,
        kind: 'Enlace',
        content: url,
        status: 'ready',
        is_in_context: false,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Actualizar updated_at del tema
    await supabase
      .from('topics')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', input.topicId);

    const source: TopicSource = {
      id: data.id,
      topicId: data.topic_id,
      title: data.title,
      kind: 'Enlace',
      content: data.content || '',
      fileUrl: '',
      filePath: '',
      fileSize: 0,
      fileType: '',
      detail: url,
      status: data.status,
      enabledForAi: data.is_in_context,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return { success: true, data: source };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al añadir el enlace',
    };
  }
}

export async function createFileSourceAction(
  input: CreateFileSourceInput,
): Promise<ActionResponse<TopicSource>> {
  const title = input.title.trim();

  if (!title) {
    return { success: false, error: 'Nombre del archivo obligatorio.' };
  }

  // [VALIDACIÓN BACKEND DE CONTENIDO]: Términos obscenos o peligrosos en el nombre de archivo
  const fileValidation = validateContent(title);
  if (!fileValidation.isValid) {
    return {
      success: false,
      error: fileValidation.error || 'No se permiten contenidos obscenos.',
    };
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

    const { data, error } = await supabase
      .from('sources')
      .insert({
        topic_id: input.topicId,
        user_id: user.id,
        title,
        kind: 'Archivo',
        file_url: input.fileUrl,
        file_path: input.filePath,
        file_size: input.fileSize,
        file_type: input.fileType,
        status: 'ready',
        is_in_context: false,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Actualizar updated_at del tema
    await supabase
      .from('topics')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', input.topicId);

    const sizeStr = formatFileSize(input.fileSize);
    const ext = input.fileType ? input.fileType.toUpperCase() : 'ARCHIVO';

    const source: TopicSource = {
      id: data.id,
      topicId: data.topic_id,
      title: data.title,
      kind: 'Archivo',
      content: '',
      fileUrl: data.file_url || '',
      filePath: data.file_path || '',
      fileSize: input.fileSize,
      fileType: input.fileType,
      detail: `${ext} · ${sizeStr}`,
      status: data.status,
      enabledForAi: data.is_in_context,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return { success: true, data: source };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al registrar archivo',
    };
  }
}

export async function toggleSourceContextAction(
  sourceId: string,
  currentStatus: boolean,
): Promise<ActionResponse<boolean>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    const newStatus = !currentStatus;

    const { error } = await supabase
      .from('sources')
      .update({ is_in_context: newStatus, updated_at: new Date().toISOString() })
      .eq('id', sourceId)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: newStatus };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al alternar contexto',
    };
  }
}

export async function deleteSourceAction(sourceId: string): Promise<ActionResponse<boolean>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    // Consultar primero si tiene archivo para borrarlo del bucket
    const { data: source } = await supabase
      .from('sources')
      .select('file_path')
      .eq('id', sourceId)
      .eq('user_id', user.id)
      .single();

    if (source?.file_path) {
      await supabase.storage.from('topic-files').remove([source.file_path]);
    }

    const { error } = await supabase
      .from('sources')
      .delete()
      .eq('id', sourceId)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar fuente',
    };
  }
}
