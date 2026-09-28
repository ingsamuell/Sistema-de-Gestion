'use server';

import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export interface DeleteUserAccountResponse {
  success: boolean;
  error?: string;
}

/**
 * Elimina completamente todos los registros vinculados a la cuenta del usuario en la base de datos
 * y elimina la entidad en auth.users mediante el Service Role de Supabase.
 */
export async function deleteUserAccountAction(): Promise<DeleteUserAccountResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'No se encontró una sesión activa. Inicia sesión de nuevo.' };
    }

    const userId = user.id;
    const adminClient = getAdminClient();

    // Si no está disponible el cliente admin, intentamos primero mediante la función RPC segura de Postgres
    if (!adminClient) {
      try {
        const { error: rpcError } = await supabase.rpc('delete_user_account');
        if (!rpcError) {
          try {
            await supabase.auth.signOut();
          } catch {
            // Sesión cerrada
          }
          return { success: true };
        }
        console.warn(
          '[deleteUserAccount] RPC delete_user_account no disponible:',
          rpcError.message,
        );
      } catch (rpcErr) {
        console.warn('[deleteUserAccount] Error invocando RPC delete_user_account:', rpcErr);
      }

      // Limpieza manual con permisos de usuario autenticado en las tablas con RLS
      try {
        await supabase.from('eventos_calendario').delete().eq('usuario_id', userId);
        await supabase.from('cronogramas').delete().eq('usuario_id', userId);
        await supabase.from('bloques_disponibilidad').delete().eq('usuario_id', userId);
        await supabase.from('calendar_availability').delete().eq('user_id', userId);
        await supabase.from('notificaciones_enviadas').delete().eq('usuario_id', userId);
        await supabase.from('topics').delete().eq('user_id', userId);
        await supabase.from('projects').delete().eq('user_id', userId);
        await supabase.from('onboarding_inclusive_preferences').delete().eq('user_id', userId);
      } catch (cleanupErr) {
        console.warn('[deleteUserAccount] Error en limpieza RLS de usuario:', cleanupErr);
      }

      return {
        success: false,
        error:
          'Para eliminar completamente la cuenta en Supabase Auth, se requiere configurar SUPABASE_SERVICE_ROLE_KEY en el archivo .env.local o ejecutar la función delete_user_account en la base de datos.',
      };
    }

    // Helper para borrado seguro que maneja tablas o columnas opcionales sin detener el flujo
    const safeDelete = async (table: string, column: string, val: string | string[]) => {
      try {
        if (Array.isArray(val)) {
          if (val.length > 0) {
            await adminClient.from(table).delete().in(column, val);
          }
        } else {
          await adminClient.from(table).delete().eq(column, val);
        }
      } catch (err) {
        console.warn(`[deleteUserAccount] Limpieza en ${table}.${column}:`, err);
      }
    };

    // 1. Obtener proyectos del usuario para eliminar dependencias relacionales
    try {
      const { data: userProjects } = await adminClient
        .from('projects')
        .select('id')
        .eq('user_id', userId);
      const projectIds = (userProjects || []).map((p) => p.id);

      if (projectIds.length > 0) {
        await safeDelete('tareas', 'id_proyecto', projectIds);
        await safeDelete('eventos_calendario', 'proyecto_id', projectIds);
        await safeDelete('cronogramas', 'proyecto_id', projectIds);
        await safeDelete('certificados_emitidos', 'project_id', projectIds);
        await safeDelete('topic_projects', 'project_id', projectIds);
      }
    } catch (err) {
      console.warn('[deleteUserAccount] Error limpiando dependencias de proyectos:', err);
    }

    // 2. Tareas directas del usuario
    await safeDelete('tareas', 'user_id', userId);

    // 3. Conversaciones y mensajes del asistente Komo
    try {
      const { data: userConvs } = await adminClient
        .from('conversations')
        .select('id')
        .eq('user_id', userId);
      const convIds = (userConvs || []).map((c) => c.id);
      if (convIds.length > 0) {
        await safeDelete('messages', 'conversation_id', convIds);
        await safeDelete('conversations', 'user_id', userId);
      }
    } catch (err) {
      console.warn('[deleteUserAccount] Error limpiando conversaciones:', err);
    }

    // 4. Calendario, cronogramas y disponibilidad
    await safeDelete('eventos_calendario', 'usuario_id', userId);
    await safeDelete('bloques_disponibilidad', 'usuario_id', userId);
    await safeDelete('calendar_availability', 'user_id', userId);
    await safeDelete('cronogramas', 'usuario_id', userId);

    // 5. Notificaciones, certificados y logs
    await safeDelete('notificaciones_enviadas', 'usuario_id', userId);
    await safeDelete('certificados_emitidos', 'usuario_id', userId);
    await safeDelete('logs_ia', 'usuario_id', userId);

    // 6. Temas y fuentes de estudio
    await safeDelete('sources', 'user_id', userId);
    await safeDelete('topics', 'user_id', userId);

    // 7. Proyectos del usuario
    await safeDelete('projects', 'user_id', userId);

    // 8. Preferencias inclusivas del onboarding
    await safeDelete('onboarding_inclusive_preferences', 'user_id', userId);

    // 9. Perfil de usuario en public.profiles
    const { error: profileDeleteError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileDeleteError) {
      console.warn('[deleteUserAccount] Error al eliminar perfil:', profileDeleteError.message);
    }

    // 10. Eliminar usuario de auth.users usando el cliente admin
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error('[deleteUserAccount] Error al eliminar usuario de auth:', deleteAuthError);
      return {
        success: false,
        error: `No fue posible eliminar la cuenta: ${deleteAuthError.message}`,
      };
    }

    // 11. Cerrar sesión en el servidor y purgar cookies
    try {
      await supabase.auth.signOut();
    } catch (signOutErr) {
      console.warn(
        '[deleteUserAccount] Error cerrando sesión en servidor tras eliminar:',
        signOutErr,
      );
    }

    return { success: true };
  } catch (err) {
    console.error('[deleteUserAccount] Error inesperado:', err);
    return {
      success: false,
      error:
        err instanceof Error ? err.message : 'Ocurrió un error inesperado al eliminar la cuenta.',
    };
  }
}
