-- ==============================================================================
-- Migración: Código único de validación y número de certificado
-- ==============================================================================

-- 1. Agregar columna numero_certificado si no existe
alter table public.certificados_emitidos 
  add column if not exists numero_certificado text unique;

-- 2. Crear índice para búsqueda ultra rápida por numero_certificado
create index if not exists idx_certificados_numero on public.certificados_emitidos(numero_certificado);

-- 3. Rellenar retrospectivamente certificados existentes que no tengan numero_certificado
update public.certificados_emitidos
set numero_certificado = 'KMB-' || to_char(fecha_emision, 'YYYY') || '-' || upper(substring(hash_sha256 from 1 for 4)) || '-' || upper(substring(hash_sha256 from 5 for 4))
where numero_certificado is null;
