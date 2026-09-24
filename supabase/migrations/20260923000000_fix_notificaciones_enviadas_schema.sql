-- ==============================================================================
-- Migración: Ajuste de tabla notificaciones_enviadas
-- Permite guardar IDs de proyectos o tareas en referencia_id y previene duplicados
-- ==============================================================================
-- Ejecutar en el SQL Editor de Supabase:
-- https://supabase.com/dashboard/project/nxjqilasqjrjpvmmjxve/sql
-- ==============================================================================

-- 1. Asegurar la tabla si no existe
create table if not exists public.notificaciones_enviadas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  tipo_evento text not null,
  referencia_id uuid null,
  fecha_envio timestamptz not null default now()
);

-- 2. Eliminar restricción de clave foránea que limitaba referencia_id únicamente a la tabla tareas
alter table public.notificaciones_enviadas
  drop constraint if exists notificaciones_enviadas_referencia_id_fkey;

-- 3. Índices únicos para deduplicación estricta y protección contra condiciones de carrera:

-- Deduplicación para notificaciones con referencia específica (ej: tarea_completada, proyecto_expirado)
create unique index if not exists notif_unique_con_referencia_idx
  on public.notificaciones_enviadas (usuario_id, tipo_evento, referencia_id)
  where referencia_id is not null and tipo_evento != 'proyecto_proximo';

-- Deduplicación para notificaciones a nivel de usuario sin referencia (ej: racha_3h, racha_expirada)
create unique index if not exists notif_unique_sin_referencia_idx
  on public.notificaciones_enviadas (usuario_id, tipo_evento)
  where referencia_id is null;

-- NOTA: La deduplicación diaria de 'proyecto_proximo' se maneja en el código
-- del backend (wasSent con rango de fecha). No se usa índice único aquí
-- porque timestamptz::date no es IMMUTABLE en Postgres.

-- 4. Habilitar RLS y políticas
alter table public.notificaciones_enviadas enable row level security;

drop policy if exists "Usuarios pueden ver sus propias notificaciones enviadas" on public.notificaciones_enviadas;
create policy "Usuarios pueden ver sus propias notificaciones enviadas"
  on public.notificaciones_enviadas for select
  to authenticated
  using (auth.uid() = usuario_id);
