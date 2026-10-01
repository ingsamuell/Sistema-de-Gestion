'use server';

import { createClient } from '@/lib/supabase/server';
import { validateContent } from '@/lib/moderation/contentFilter';

export interface UpdateProfileIdentityInput {
  firstName: string;
  lastName: string;
  username: string;
  description: string;
  avatarUrl?: string;
  uploadedAvatars?: string[];
  role?: string;
  age?: string;
  workSituation?: string;
}

export interface UpdateProfileIdentityResponse {
  success: boolean;
  error?: string;
}

export async function updateProfileIdentity(
  input: UpdateProfileIdentityInput,
): Promise<UpdateProfileIdentityResponse> {
  const normalizedFirstName = input.firstName.trim();
  const normalizedLastName = input.lastName.trim();
  const fullName = `${normalizedFirstName} ${normalizedLastName}`.trim();
  const normalizedUsername = input.username.trim().replace(/^@+/, '');
  const normalizedDescription = input.description.trim();

  if (!normalizedFirstName) {
    return { success: false, error: 'Por favor ingresa tu nombre.' };
  }

  if (normalizedFirstName.length > 30) {
    return { success: false, error: 'El nombre no puede exceder los 30 caracteres.' };
  }

  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/.test(normalizedFirstName)) {
    return { success: false, error: 'El nombre solo puede contener letras y espacios.' };
  }

  if (!normalizedLastName) {
    return { success: false, error: 'Por favor ingresa tu apellido.' };
  }

  if (normalizedLastName.length > 30) {
    return { success: false, error: 'El apellido no puede exceder los 30 caracteres.' };
  }

  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/.test(normalizedLastName)) {
    return { success: false, error: 'El apellido solo puede contener letras y espacios.' };
  }

  // [VALIDACIÓN BACKEND DE CONTENIDO]: Nombre y Apellido
  const nameValidation = validateContent(`${normalizedFirstName} ${normalizedLastName}`);
  if (!nameValidation.isValid) {
    return {
      success: false,
      error: nameValidation.error || 'El nombre o apellido contiene términos no permitidos.',
    };
  }

  if (!normalizedUsername || normalizedUsername.length < 3) {
    return { success: false, error: 'El nombre de usuario debe tener al menos 3 caracteres.' };
  }

  if (normalizedUsername.length > 30) {
    return { success: false, error: 'El nombre de usuario no puede exceder los 30 caracteres.' };
  }

  if (!/^[a-zA-Z0-9_.-]+$/.test(normalizedUsername)) {
    return {
      success: false,
      error: 'El nombre de usuario solo puede contener letras, números, guiones y guiones bajos.',
    };
  }

  // [VALIDACIÓN BACKEND DE CONTENIDO]: Nombre de usuario
  const usernameValidation = validateContent(normalizedUsername);
  if (!usernameValidation.isValid) {
    return {
      success: false,
      error: usernameValidation.error || 'El nombre de usuario contiene términos no permitidos.',
    };
  }

  if (normalizedDescription.length > 1000) {
    return {
      success: false,
      error: 'La descripción del perfil debe tener como máximo 1000 caracteres.',
    };
  }

  // [VALIDACIÓN BACKEND DE CONTENIDO]: Descripción de perfil
  if (normalizedDescription) {
    const descValidation = validateContent(normalizedDescription);
    if (!descValidation.isValid) {
      return {
        success: false,
        error: descValidation.error || 'La descripción del perfil contiene términos no permitidos.',
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
      return { success: false, error: 'No se encontró una sesión activa. Inicia sesión de nuevo.' };
    }

    // [VALIDACIÓN BACKEND DE UNICIDAD]: Verificar que el nombre de usuario no pertenezca a otra cuenta
    const { data: existingUserWithUsername } = await supabase
      .from('profiles')
      .select('id')
      .ilike('nombre_usuario', normalizedUsername)
      .neq('id', user.id)
      .maybeSingle();

    if (existingUserWithUsername) {
      return {
        success: false,
        error: 'El nombre de usuario ya está registrado por otra persona.',
      };
    }

    // 1. Preparar payload para la tabla profiles (sin contexto_personal)
    const payload: Record<string, unknown> = {
      nombre_usuario: normalizedUsername,
      nombre_completo: fullName,
      descripcion: normalizedDescription || null,
      avatar_url: input.avatarUrl || null,
      updated_at: new Date().toISOString(),
    };

    if (input.uploadedAvatars && input.uploadedAvatars.length > 0) {
      payload.avatares_subidos = input.uploadedAvatars;
    }

    if (input.role) payload.rol_condicion = input.role;
    if (input.age) payload.edad = input.age;
    if (input.workSituation) payload.situacion_laboral = input.workSituation;

    let updateResult = await supabase.from('profiles').update(payload).eq('id', user.id);

    if (updateResult.error) {
      const errorMsg = updateResult.error.message.toLowerCase();
      const cleanPayload = { ...payload };

      if (errorMsg.includes('avatares_subidos')) delete cleanPayload.avatares_subidos;
      if (errorMsg.includes('nombre_completo')) delete cleanPayload.nombre_completo;
      if (errorMsg.includes('descripcion')) delete cleanPayload.descripcion;

      updateResult = await supabase.from('profiles').update(cleanPayload).eq('id', user.id);
    }

    if (updateResult.error) {
      return {
        success: false,
        error: `No fue posible actualizar tu perfil: ${updateResult.error.message}`,
      };
    }

    // 2. Sincronizar metadatos en auth.users
    try {
      const metadataUpdates: Record<string, unknown> = {
        first_name: normalizedFirstName,
        last_name: normalizedLastName,
        full_name: fullName,
        name: fullName,
        username: normalizedUsername,
        nombre_usuario: normalizedUsername,
      };

      // CRÍTICO: Las cookies de sesión almacenan user_metadata dentro del JWT.
      // Si se guarda un data URI base64, las cookies exceden los límites HTTP
      // y Node.js lanza el error "431 Request Header Fields Too Large".
      // Por tanto, la imagen base64 se guarda EXCLUSIVAMENTE en la tabla 'profiles'.
      // En auth.users solo guardamos URLs HTTP/HTTPS o limpiamos si había base64 previo.
      if (
        input.avatarUrl &&
        (input.avatarUrl.startsWith('http://') || input.avatarUrl.startsWith('https://'))
      ) {
        metadataUpdates.avatar_url = input.avatarUrl;
      } else {
        metadataUpdates.avatar_url = null;
      }

      await supabase.auth.updateUser({
        data: metadataUpdates,
      });
    } catch {
      // Ignorar fallo de metadatos si BD ya actualizó
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : 'Ocurrió un error inesperado al guardar tu perfil.',
    };
  }
}
