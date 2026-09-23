-- Setup completo panel reconocimiento (usuarios + zonas)
-- Proyecto Supabase: zgbsrbjtjnozpzxifpua
-- Pegar y ejecutar en SQL Editor (una sola vez)

-- ========== mc_dashboard_users ==========
create table if not exists public.mc_dashboard_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mc_dashboard_users_activo_idx
  on public.mc_dashboard_users (activo);

alter table public.mc_dashboard_users enable row level security;

drop policy if exists "mc_dash_users_select" on public.mc_dashboard_users;
drop policy if exists "mc_dash_users_insert" on public.mc_dashboard_users;
drop policy if exists "mc_dash_users_update" on public.mc_dashboard_users;
drop policy if exists "mc_dash_users_delete" on public.mc_dashboard_users;

create policy "mc_dash_users_select" on public.mc_dashboard_users
  for select to anon, authenticated using (true);
create policy "mc_dash_users_insert" on public.mc_dashboard_users
  for insert to anon, authenticated with check (true);
create policy "mc_dash_users_update" on public.mc_dashboard_users
  for update to anon, authenticated using (true) with check (true);
create policy "mc_dash_users_delete" on public.mc_dashboard_users
  for delete to anon, authenticated using (true);

-- ========== mc_zonas + mc_zona_vendedores ==========
create table if not exists public.mc_zonas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mc_zonas_activo_orden_idx
  on public.mc_zonas (activo, orden);

create table if not exists public.mc_zona_vendedores (
  id uuid primary key default gen_random_uuid(),
  zona_id uuid not null references public.mc_zonas(id) on delete cascade,
  vendedor_id uuid not null references public.mc_vendedores(id) on delete cascade,
  activo boolean not null default true,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  notas text,
  created_at timestamptz not null default now()
);

create unique index if not exists mc_zona_vendedores_one_active_per_vendor
  on public.mc_zona_vendedores (vendedor_id)
  where (activo = true);

create index if not exists mc_zona_vendedores_zona_activo_idx
  on public.mc_zona_vendedores (zona_id, activo);

alter table public.mc_zonas enable row level security;
alter table public.mc_zona_vendedores enable row level security;

drop policy if exists "mc_zonas_select" on public.mc_zonas;
drop policy if exists "mc_zonas_insert" on public.mc_zonas;
drop policy if exists "mc_zonas_update" on public.mc_zonas;
drop policy if exists "mc_zonas_delete" on public.mc_zonas;
drop policy if exists "mc_zona_vend_select" on public.mc_zona_vendedores;
drop policy if exists "mc_zona_vend_insert" on public.mc_zona_vendedores;
drop policy if exists "mc_zona_vend_update" on public.mc_zona_vendedores;
drop policy if exists "mc_zona_vend_delete" on public.mc_zona_vendedores;

create policy "mc_zonas_select" on public.mc_zonas
  for select to anon, authenticated using (true);
create policy "mc_zonas_insert" on public.mc_zonas
  for insert to anon, authenticated with check (true);
create policy "mc_zonas_update" on public.mc_zonas
  for update to anon, authenticated using (true) with check (true);
create policy "mc_zonas_delete" on public.mc_zonas
  for delete to anon, authenticated using (true);

create policy "mc_zona_vend_select" on public.mc_zona_vendedores
  for select to anon, authenticated using (true);
create policy "mc_zona_vend_insert" on public.mc_zona_vendedores
  for insert to anon, authenticated with check (true);
create policy "mc_zona_vend_update" on public.mc_zona_vendedores
  for update to anon, authenticated using (true) with check (true);
create policy "mc_zona_vend_delete" on public.mc_zona_vendedores
  for delete to anon, authenticated using (true);

insert into public.mc_zonas (codigo, nombre, orden)
values
  ('CAPITAL', 'CAPITAL', 1),
  ('CENTRO_LLANOS', 'CENTRO LLANOS', 2),
  ('OCCIDENTE', 'OCCIDENTE', 3),
  ('CENTRO_OCCIDENTE', 'CENTRO OCCIDENTE', 4),
  ('ORIENTE_NORTE', 'ORIENTE NORTE', 5),
  ('ORIENTE_SUR', 'ORIENTE SUR', 6),
  ('ANDES', 'ANDES', 7)
on conflict (codigo) do update
  set nombre = excluded.nombre,
      orden = excluded.orden,
      activo = true,
      updated_at = now();
