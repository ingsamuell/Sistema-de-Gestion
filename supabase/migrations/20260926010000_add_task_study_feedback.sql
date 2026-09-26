-- ==============================================================================
-- Migración: Información y retroalimentación de técnica de estudio por tarea
-- ==============================================================================

-- 1. Campos de método de estudio, tiempo empleado y valoración de la técnica en tareas
alter table public.tareas add column if not exists metodo_estudio text default 'Técnica Pomodoro';
alter table public.tareas add column if not exists tiempo_empleado integer;
alter table public.tareas add column if not exists tecnica_sirvio boolean;

-- 2. Asegurar que la columna completed_at exista
alter table public.tareas add column if not exists completed_at timestamptz;

-- 3. Crear índice para consultas de analítica de técnicas
create index if not exists idx_tareas_metodo_estudio on public.tareas(metodo_estudio);
