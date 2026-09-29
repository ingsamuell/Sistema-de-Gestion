-- ==============================================================================
-- Migración: Función RPC para eliminación de cuenta de usuario autenticado
-- Permite que un usuario autenticado elimine completamente su propia cuenta y registros
-- sin necesidad de exponer el Service Role key en entornos donde no esté configurado.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró un usuario autenticado para eliminar';
  END IF;

  -- 1. Eliminar tareas vinculadas a proyectos del usuario
  DELETE FROM public.tareas WHERE id_proyecto IN (SELECT id FROM public.projects WHERE user_id = current_user_id);
  DELETE FROM public.tareas WHERE user_id = current_user_id;

  -- 2. Eliminar eventos de calendario y cronogramas
  DELETE FROM public.eventos_calendario WHERE usuario_id = current_user_id;
  DELETE FROM public.cronogramas WHERE usuario_id = current_user_id;
  DELETE FROM public.bloques_disponibilidad WHERE usuario_id = current_user_id;
  DELETE FROM public.calendar_availability WHERE user_id = current_user_id;

  -- 3. Eliminar notificaciones y relaciones
  DELETE FROM public.notificaciones_enviadas WHERE usuario_id = current_user_id;
  DELETE FROM public.topic_projects WHERE project_id IN (SELECT id FROM public.projects WHERE user_id = current_user_id);

  -- 4. Eliminar proyectos, temas y fuentes
  DELETE FROM public.projects WHERE user_id = current_user_id;
  DELETE FROM public.topics WHERE user_id = current_user_id;
  DELETE FROM public.sources WHERE user_id = current_user_id;

  -- 5. Eliminar preferencias y perfil
  DELETE FROM public.onboarding_inclusive_preferences WHERE user_id = current_user_id;
  DELETE FROM public.profiles WHERE id = current_user_id;

  -- 6. Eliminar usuario de auth.users
  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;

-- Permisos
REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
