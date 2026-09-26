-- ==============================================================================
-- Migración: Corrección del Esquema de Certificaciones
-- ==============================================================================

-- 1. Asegurar campo nombre_completo en profiles
alter table public.profiles add column if not exists nombre_completo text;

-- 2. Crear tabla certificados_emitidos con referencia correcta a public.projects(id)
create table if not exists public.certificados_emitidos (
    id uuid default gen_random_uuid() primary key,
    profile_id uuid not null references public.profiles(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,
    numero_certificado text unique,
    hash_sha256 text not null unique,
    fecha_emision timestamptz default now() not null,
    horas_invertidas numeric(10,2) not null default 0,
    temas_aprobados integer not null default 0,
    unique(profile_id, project_id)
);

alter table public.certificados_emitidos add column if not exists numero_certificado text unique;

-- 3. Vista de compatibilidad para evitar fallos si algún servicio busca 'proyectos'
create or replace view public.proyectos as 
  select * from public.projects;

-- 4. Habilitar RLS y políticas
alter table public.certificados_emitidos enable row level security;

drop policy if exists "Los certificados son públicamente legibles" on public.certificados_emitidos;
create policy "Los certificados son públicamente legibles"
    on public.certificados_emitidos for select
    to public
    using (true);

drop policy if exists "Usuarios autenticados pueden insertar sus propios certificados" on public.certificados_emitidos;
create policy "Usuarios autenticados pueden insertar sus propios certificados"
    on public.certificados_emitidos for insert
    to authenticated
    with check (auth.uid() = profile_id);

drop policy if exists "Usuarios autenticados pueden actualizar sus certificados" on public.certificados_emitidos;
create policy "Usuarios autenticados pueden actualizar sus certificados"
    on public.certificados_emitidos for update
    to authenticated
    using (auth.uid() = profile_id);

-- 5. Índice para búsquedas rápidas por hash
create index if not exists idx_certificados_hash on public.certificados_emitidos(hash_sha256);
