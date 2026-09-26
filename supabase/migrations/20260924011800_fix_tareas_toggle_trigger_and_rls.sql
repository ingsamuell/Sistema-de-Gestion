-- ==============================================================================
-- Migración: Corrección del trigger de tareas y políticas RLS para UPDATE
-- ==============================================================================
-- Soluciona el error de permisos revocados en schema private / set_tarea_completed_at
-- y garantiza que los usuarios autenticados puedan marcar tareas como completadas.

-- 1. Eliminar el trigger conflictivo que bloqueaba los UPDATE a usuarios autenticados
--    (El backend en proyectoActions.ts ya gestiona completed_at de forma directa y segura)
drop trigger if exists set_tarea_completed_at on public.tareas;
drop function if exists private.set_tarea_completed_at();

-- 2. Asegurar que las columnas necesarias existan
alter table public.tareas add column if not exists completed_at timestamp with time zone;
alter table public.tareas add column if not exists completado boolean not null default false;

-- 3. Asegurar Row Level Security (RLS) en la tabla tareas
alter table public.tareas enable row level security;

-- 4. Recrear política de actualización para el propietario del proyecto
drop policy if exists "Tareas: propietario del proyecto puede actualizar" on public.tareas;
drop policy if exists "Los usuarios autenticados pueden actualizar tareas" on public.tareas;
drop policy if exists "Usuarios pueden actualizar tareas" on public.tareas;

create policy "Tareas: propietario del proyecto puede actualizar"
  on public.tareas for update to authenticated
  using (
    exists (
      select 1 from public.projects project
      where project.id = tareas.id_proyecto
        and project.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects project
      where project.id = tareas.id_proyecto
        and project.user_id = auth.uid()
    )
  );
