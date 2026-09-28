'use server';

import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export interface DeleteUserAccountResponse {
  success: boolean;
  error?: string;
}

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

    const adminClient = getAdminClient();
    if (!adminClient) {
      return { success: false, error: 'Configuración del servidor incompleta (falta Service Role).' };
    }

    // Se recomienda eliminar el perfil manualmente por precaución, aunque haya borrado en cascada.
    const { error: profileDeleteError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', user.id);

    if (profileDeleteError) {
        console.error('Error eliminando perfil:', profileDeleteError);
    }

    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteAuthError) {
      return { success: false, error: 'No se pudo eliminar la cuenta de usuario.' };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : 'Ocurrió un error inesperado al eliminar la cuenta.',
    };
  }
}
