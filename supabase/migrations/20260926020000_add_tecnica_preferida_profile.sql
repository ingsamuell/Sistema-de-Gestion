-- ==============================================================================
-- Migración: Técnica de estudio preferida en profiles
-- ==============================================================================

-- 1. Agregar columna tecnica_preferida en public.profiles
alter table public.profiles add column if not exists tecnica_preferida text;

-- 2. Índice para consultas rápidas
create index if not exists idx_profiles_tecnica_preferida on public.profiles(tecnica_preferida);
