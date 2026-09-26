-- ==============================================================================
-- Migración: Micro-evaluaciones por Tarea
-- ==============================================================================

-- Agregar campo para estado de quiz aprobado en la tabla de tareas
alter table public.tareas add column if not exists quiz_aprobado boolean default false not null;
