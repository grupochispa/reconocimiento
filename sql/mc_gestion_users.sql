-- mc_gestion_users: login aparte del panel de gestión (compensaciones)
-- Run in Supabase SQL Editor for project zgbsrbjtjnozpzxifpua
-- Independiente de mc_dashboard_users (panel reconocimiento)

create table if not exists public.mc_gestion_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mc_gestion_users_activo_idx
  on public.mc_gestion_users (activo);

alter table public.mc_gestion_users enable row level security;

drop policy if exists "mc_gestion_users_select" on public.mc_gestion_users;
drop policy if exists "mc_gestion_users_insert" on public.mc_gestion_users;
drop policy if exists "mc_gestion_users_update" on public.mc_gestion_users;
drop policy if exists "mc_gestion_users_delete" on public.mc_gestion_users;

create policy "mc_gestion_users_select" on public.mc_gestion_users
  for select to anon, authenticated using (true);
create policy "mc_gestion_users_insert" on public.mc_gestion_users
  for insert to anon, authenticated with check (true);
create policy "mc_gestion_users_update" on public.mc_gestion_users
  for update to anon, authenticated using (true) with check (true);
create policy "mc_gestion_users_delete" on public.mc_gestion_users
  for delete to anon, authenticated using (true);
