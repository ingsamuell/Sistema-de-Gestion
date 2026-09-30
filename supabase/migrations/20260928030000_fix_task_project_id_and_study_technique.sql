-- ==============================================================================
-- Migración: Garantizar id_proyecto obligatorio y remover default de metodo_estudio
-- ==============================================================================
-- 1. Elimina el valor por defecto 'Técnica Pomodoro' de la columna metodo_estudio
--    para que solo se guarde la técnica que el usuario elija al iniciar la tarea.
-- 2. Asegura que todas las tareas tengan un id_proyecto válido (NOT NULL) y ON DELETE CASCADE.
-- URL de ejecución: https://supabase.com/dashboard/project/nxjqilasqjrjpvmmjxve/sql
-- ==============================================================================

-- 1. Remover el valor por defecto 'Técnica Pomodoro' en la columna metodo_estudio
alter table public.tareas alter column metodo_estudio drop default;

-- 2. Limpiar metodo_estudio en tareas que tenían 'Técnica Pomodoro' por defecto y no han sido iniciadas
update public.tareas
set metodo_estudio = null
where metodo_estudio = 'Técnica Pomodoro'
  and tiempo_empleado is null
  and tecnica_sirvio is null;

-- 3. Limpiar cualquier fila residual sin título ni descripción
delete from public.tareas
where id_proyecto is null
  and (titulo is null or trim(titulo) = '' or titulo = 'null');

-- 4. Asegurar restricción NOT NULL y clave foránea ON DELETE CASCADE en id_proyecto
do $$
begin
  -- Si existiese alguna tarea huérfana, asignarla al proyecto más reciente
  if exists (select 1 from public.tareas where id_proyecto is null) then
    update public.tareas
    set id_proyecto = (select id from public.projects order by created_at desc limit 1)
    where id_proyecto is null;
  end if;

  -- Establecer NOT NULL en id_proyecto
  alter table public.tareas alter column id_proyecto set not null;

  -- Asegurar restricción de clave foránea con borrado en cascada
  if not exists (
    select 1 from pg_constraint
    where conname = 'tareas_id_proyecto_fkey'
      and conrelid = 'public.tareas'::regclass
  ) then
    alter table public.tareas
      add constraint tareas_id_proyecto_fkey
      foreign key (id_proyecto) references public.projects(id) on delete cascade;
  end if;
end;
$$;
