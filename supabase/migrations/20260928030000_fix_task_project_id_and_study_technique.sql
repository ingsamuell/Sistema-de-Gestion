-- ==============================================================================
-- Migración: Remover default de metodo_estudio y permitir id_proyecto opcional
-- ==============================================================================
-- 1. Elimina el valor por defecto 'Técnica Pomodoro' de la columna metodo_estudio
--    para que solo se guarde la técnica que el usuario elija al iniciar la tarea.
-- 2. Asegura que id_proyecto sea opcional (DROP NOT NULL) para evitar errores con n8n/IA.
-- 3. Mantiene la clave foránea ON DELETE CASCADE para cuando una tarea sí pertenezca a un proyecto.
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

-- 3. Limpiar cualquier fila residual sin título ni contenido válido
delete from public.tareas
where id_proyecto is null
  and (titulo is null or trim(titulo) = '' or titulo = 'null');

-- 4. Permitir que id_proyecto sea opcional (DROP NOT NULL) para compatibilidad con la IA de n8n
alter table public.tareas alter column id_proyecto drop not null;

-- 5. Asegurar restricción de clave foránea con borrado en cascada (aplica cuando id_proyecto no sea null)
do $$
begin
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

