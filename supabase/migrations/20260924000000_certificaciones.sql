-- ==============================================================================
-- Migración: Certificaciones por Inversión de Tiempo
-- ==============================================================================

-- 1. Agregar campo de nombre completo al perfil (si no existe)
alter table public.profiles add column if not exists nombre_completo text;

-- 2. Crear tabla de certificados emitidos
create table if not exists public.certificados_emitidos (
    id uuid default gen_random_uuid() primary key,
    profile_id uuid not null references public.profiles(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,
    hash_sha256 text not null unique,
    fecha_emision timestamptz default now() not null,
    horas_invertidas numeric(10,2) not null default 0,
    temas_aprobados integer not null default 0,
    -- Asegurar que solo haya un certificado por proyecto y perfil
    unique(profile_id, project_id)
);

-- 3. Políticas RLS para certificados_emitidos
alter table public.certificados_emitidos enable row level security;

-- Los certificados son públicos para permitir la validación por hash
drop policy if exists "Los certificados son públicamente legibles" on public.certificados_emitidos;
create policy "Los certificados son públicamente legibles"
    on public.certificados_emitidos for select
    to public
    using (true);

-- Solo el dueño o el sistema puede insertar su propio certificado
drop policy if exists "Usuarios autenticados pueden insertar sus propios certificados" on public.certificados_emitidos;
create policy "Usuarios autenticados pueden insertar sus propios certificados"
    on public.certificados_emitidos for insert
    to authenticated
    with check (auth.uid() = profile_id);

-- Solo el dueño puede ver su lista privada de certificados
drop policy if exists "Usuarios autenticados pueden actualizar sus certificados" on public.certificados_emitidos;
create policy "Usuarios autenticados pueden actualizar sus certificados"
    on public.certificados_emitidos for update
    to authenticated
    using (auth.uid() = profile_id);

-- 4. Índice para búsquedas rápidas por hash
create index if not exists idx_certificados_hash on public.certificados_emitidos(hash_sha256);
