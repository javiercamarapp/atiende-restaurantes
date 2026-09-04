-- Reconstructs the multi-tenant objects that exist in the hosted database but
-- were never captured in the migration history.  This migration intentionally
-- precedes the restaurant-specific seed migrations so a clean restore has the
-- same tenant keys and authorization primitives as the application runtime.

alter type public.app_role add value if not exists 'superadmin';

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.restaurants (id, name, slug)
values ('be3fbdeb-80e7-4e7b-9b44-22b476c08298', 'Los Taquitos de PM', 'los-taquitos-de-pm')
on conflict (id) do nothing;

create table if not exists public.restaurant_staff (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'admin', 'staff', 'repartidor')),
  notify_nuevo boolean not null default true,
  notify_preparando boolean not null default true,
  notify_en_camino boolean not null default true,
  notify_entregado boolean not null default true,
  notify_cancelado boolean not null default true,
  notify_queja boolean not null default true,
  notify_escalar boolean not null default true,
  created_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);

create table if not exists public.merida_colonias (
  nombre text primary key,
  lat numeric not null,
  lng numeric not null
);

create or replace function public.is_superadmin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role::text = 'superadmin'
  )
$$;

create or replace function public.is_restaurant_staff(_user_id uuid, _restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.restaurant_staff
    where user_id = _user_id and restaurant_id = _restaurant_id
  )
$$;

revoke all on function public.is_superadmin(uuid) from public;
revoke all on function public.is_restaurant_staff(uuid, uuid) from public;
grant execute on function public.is_superadmin(uuid) to authenticated, service_role;
grant execute on function public.is_restaurant_staff(uuid, uuid) to authenticated, service_role;

alter table public.restaurants enable row level security;
alter table public.restaurant_staff enable row level security;

create policy "Members can view their restaurant"
  on public.restaurants for select to authenticated
  using (public.is_restaurant_staff(auth.uid(), id) or public.is_superadmin(auth.uid()));

create policy "Staff can view own membership"
  on public.restaurant_staff for select to authenticated
  using (user_id = auth.uid() or public.is_superadmin(auth.uid()));

create policy "Staff can update own notification preferences"
  on public.restaurant_staff for update to authenticated
  using (user_id = auth.uid() or public.is_superadmin(auth.uid()))
  with check (user_id = auth.uid() or public.is_superadmin(auth.uid()));

-- The legacy dump predates tenants.  Defaults exist only long enough for the
-- historical single-restaurant seed to replay; a later migration removes them
-- so all new writes must name their tenant explicitly.
alter table public.categories
  add column if not exists restaurant_id uuid references public.restaurants(id)
    default 'be3fbdeb-80e7-4e7b-9b44-22b476c08298';
update public.categories set restaurant_id = 'be3fbdeb-80e7-4e7b-9b44-22b476c08298'
where restaurant_id is null;
alter table public.categories alter column restaurant_id set not null;
alter table public.categories drop constraint if exists categories_slug_key;
alter table public.categories
  add constraint categories_restaurant_slug_key unique (restaurant_id, slug);

alter table public.products
  add column if not exists restaurant_id uuid references public.restaurants(id)
    default 'be3fbdeb-80e7-4e7b-9b44-22b476c08298';
update public.products set restaurant_id = 'be3fbdeb-80e7-4e7b-9b44-22b476c08298'
where restaurant_id is null;
alter table public.products alter column restaurant_id set not null;

alter table public.orders
  add column if not exists restaurant_id uuid references public.restaurants(id)
    default 'be3fbdeb-80e7-4e7b-9b44-22b476c08298',
  add column if not exists notes text;
update public.orders set restaurant_id = 'be3fbdeb-80e7-4e7b-9b44-22b476c08298'
where restaurant_id is null;
alter table public.orders alter column restaurant_id set not null;

alter table public.promos
  add column if not exists restaurant_id uuid references public.restaurants(id)
    default 'be3fbdeb-80e7-4e7b-9b44-22b476c08298';
update public.promos set restaurant_id = 'be3fbdeb-80e7-4e7b-9b44-22b476c08298'
where restaurant_id is null;
alter table public.promos alter column restaurant_id set not null;

create index if not exists restaurant_staff_user_restaurant_idx
  on public.restaurant_staff (user_id, restaurant_id);
