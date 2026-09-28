-- ==============================================================================
-- Migración: Asegurar ON DELETE CASCADE y SECURITY DEFINER
-- ==============================================================================

-- 1. Eliminar cualquier FK constraint existente de profiles a auth.users (sin importar el nombre) y añadir la correcta con ON DELETE CASCADE
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'profiles'
    AND ccu.table_name = 'users'
    AND ccu.table_schema = 'auth';

  IF fk_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || fk_name;
  END IF;
END $$;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_id_fkey
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Asegurarnos que handle_new_user tiene SECURITY DEFINER (para evitar error 42501 al crear perfiles en el trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF new.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.profiles (
      id,
      nombre_usuario,
      fecha_registro,
      racha_activa,
      racha_maxima
    )
    VALUES (
      new.id,
      COALESCE(
        new.raw_user_meta_data->>'username',
        new.raw_user_meta_data->>'nombre_usuario',
        SPLIT_PART(new.email, '@', 1)
      ),
      NOW(),
      0,
      0
    )
    ON CONFLICT (id) DO UPDATE SET
      nombre_usuario = COALESCE(EXCLUDED.nombre_usuario, public.profiles.nombre_usuario);
  END IF;

  RETURN new;
END;
$$;
