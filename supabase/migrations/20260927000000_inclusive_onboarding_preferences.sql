-- Preferencias voluntarias para el onboarding inclusivo.
-- No almacena adjuntos clínicos ni documentos de diagnóstico.
create table if not exists public.onboarding_inclusive_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  onboarding_path text not null check (onboarding_path in ('parent_inclusive', 'student_inclusive')),
  answers jsonb not null default '{}'::jsonb,
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.onboarding_inclusive_preferences enable row level security;

drop policy if exists "Onboarding inclusivo: propietario puede leer" on public.onboarding_inclusive_preferences;
create policy "Onboarding inclusivo: propietario puede leer"
  on public.onboarding_inclusive_preferences for select
  to authenticated using (auth.uid() = user_id);

drop policy if exists "Onboarding inclusivo: propietario puede crear" on public.onboarding_inclusive_preferences;
create policy "Onboarding inclusivo: propietario puede crear"
  on public.onboarding_inclusive_preferences for insert
  to authenticated with check (auth.uid() = user_id);

drop policy if exists "Onboarding inclusivo: propietario puede actualizar" on public.onboarding_inclusive_preferences;
create policy "Onboarding inclusivo: propietario puede actualizar"
  on public.onboarding_inclusive_preferences for update
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Onboarding inclusivo: propietario puede eliminar" on public.onboarding_inclusive_preferences;
create policy "Onboarding inclusivo: propietario puede eliminar"
  on public.onboarding_inclusive_preferences for delete
  to authenticated using (auth.uid() = user_id);

