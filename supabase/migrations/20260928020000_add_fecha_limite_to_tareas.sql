-- ==============================================================================
-- Migración: Agregar columna 'fecha_limite' a la tabla 'tareas' y cálculo automático
-- ==============================================================================
-- Calcula la fecha límite de las tareas sumando la duración en minutos a la hora de inicio.
-- URL de ejecución en Supabase: https://supabase.com/dashboard/project/nxjqilasqjrjpvmmjxve/sql
-- ==============================================================================

-- 1. Asegurar la columna 'fecha_limite' en public.tareas
alter table public.tareas add column if not exists fecha_limite timestamp with time zone;

-- 2. Backfill para calcular fecha_limite en registros existentes con fecha_inicio
update public.tareas
set fecha_limite = fecha_inicio + (coalesce(duracion, 30) * interval '1 minute')
where fecha_inicio is not null and fecha_limite is null;

-- 3. Función trigger para calcular automáticamente fecha_limite ante inserciones y modificaciones
create or replace function public.calculate_tarea_fecha_limite()
returns trigger
security definer
language plpgsql
as $$
begin
  if new.fecha_inicio is not null then
    if tg_op = 'INSERT' then
      if new.fecha_limite is null then
        new.fecha_limite := new.fecha_inicio + (coalesce(new.duracion, 30) * interval '1 minute');
      end if;
    elsif tg_op = 'UPDATE' then
      if new.fecha_limite is null or (new.fecha_inicio is distinct from old.fecha_inicio) or (new.duracion is distinct from old.duracion) then
        new.fecha_limite := new.fecha_inicio + (coalesce(new.duracion, 30) * interval '1 minute');
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- 4. Asociar el trigger a la tabla tareas
drop trigger if exists trigger_calculate_tarea_fecha_limite on public.tareas;
create trigger trigger_calculate_tarea_fecha_limite
before insert or update of fecha_inicio, duracion, fecha_limite on public.tareas
for each row
execute function public.calculate_tarea_fecha_limite();

-- 5. Otorgar permisos de ejecución
grant execute on function public.calculate_tarea_fecha_limite() to authenticated, anon, service_role;
