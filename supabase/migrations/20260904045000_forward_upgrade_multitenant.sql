-- Forward-only companion for installations that already applied the original
-- historical migrations.  The earlier files are corrected for clean restores;
-- this file upgrades an existing hosted schema without replaying CREATE TABLE.

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
  role text not null default 'staff',
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
alter table public.restaurant_staff drop constraint if exists restaurant_staff_role_check;
alter table public.restaurant_staff add constraint restaurant_staff_role_check
  check (role in ('owner', 'admin', 'staff', 'repartidor'));

create table if not exists public.merida_colonias (
  nombre text primary key,
  lat numeric not null,
  lng numeric not null
);

alter table public.branches add column if not exists restaurant_id uuid references public.restaurants(id);
alter table public.categories add column if not exists restaurant_id uuid references public.restaurants(id);
alter table public.products add column if not exists restaurant_id uuid references public.restaurants(id);
alter table public.orders add column if not exists restaurant_id uuid references public.restaurants(id);
alter table public.orders add column if not exists notes text;
alter table public.promos add column if not exists restaurant_id uuid references public.restaurants(id);
alter table public.customers add column if not exists restaurant_id uuid references public.restaurants(id);
alter table public.whatsapp_conversations add column if not exists restaurant_id uuid references public.restaurants(id);

update public.branches set restaurant_id = 'be3fbdeb-80e7-4e7b-9b44-22b476c08298' where restaurant_id is null;
update public.categories set restaurant_id = 'be3fbdeb-80e7-4e7b-9b44-22b476c08298' where restaurant_id is null;
update public.products set restaurant_id = 'be3fbdeb-80e7-4e7b-9b44-22b476c08298' where restaurant_id is null;
update public.orders set restaurant_id = 'be3fbdeb-80e7-4e7b-9b44-22b476c08298' where restaurant_id is null;
update public.promos set restaurant_id = 'be3fbdeb-80e7-4e7b-9b44-22b476c08298' where restaurant_id is null;
update public.customers set restaurant_id = 'be3fbdeb-80e7-4e7b-9b44-22b476c08298' where restaurant_id is null;
update public.whatsapp_conversations set restaurant_id = 'be3fbdeb-80e7-4e7b-9b44-22b476c08298' where restaurant_id is null;

alter table public.branches alter column restaurant_id set not null;
alter table public.categories alter column restaurant_id set not null;
alter table public.products alter column restaurant_id set not null;
alter table public.orders alter column restaurant_id set not null;
alter table public.promos alter column restaurant_id set not null;
alter table public.customers alter column restaurant_id set not null;
alter table public.whatsapp_conversations alter column restaurant_id set not null;

alter table public.branches alter column restaurant_id drop default;
alter table public.categories alter column restaurant_id drop default;
alter table public.products alter column restaurant_id drop default;
alter table public.orders alter column restaurant_id drop default;
alter table public.promos alter column restaurant_id drop default;
alter table public.customers alter column restaurant_id drop default;
alter table public.whatsapp_conversations alter column restaurant_id drop default;

alter table public.branches drop constraint if exists branches_slug_key;
alter table public.categories drop constraint if exists categories_slug_key;
alter table public.customers drop constraint if exists customers_phone_key;
alter table public.whatsapp_conversations drop constraint if exists whatsapp_conversations_phone_key;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'branches_restaurant_slug_key') then
    alter table public.branches add constraint branches_restaurant_slug_key unique (restaurant_id, slug);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'categories_restaurant_slug_key') then
    alter table public.categories add constraint categories_restaurant_slug_key unique (restaurant_id, slug);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'customers_restaurant_phone_key') then
    alter table public.customers add constraint customers_restaurant_phone_key unique (restaurant_id, phone);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'whatsapp_conversations_restaurant_phone_key') then
    alter table public.whatsapp_conversations add constraint whatsapp_conversations_restaurant_phone_key unique (restaurant_id, phone);
  end if;
end
$$;

create or replace function public.is_superadmin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role::text = 'superadmin')
$$;
create or replace function public.is_restaurant_staff(_user_id uuid, _restaurant_id uuid)
returns boolean language sql stable security definer set search_path = public
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

drop function if exists public.whatsapp_append_turn(text, jsonb, text, uuid, uuid);
create or replace function public.whatsapp_append_turn(
  p_restaurant_id uuid,
  p_phone text,
  p_new_messages jsonb,
  p_status text default null,
  p_order_id uuid default null,
  p_branch_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_messages jsonb;
begin
  if p_phone is null or btrim(p_phone) = '' or jsonb_typeof(p_new_messages) <> 'array' then
    raise exception 'invalid whatsapp turn';
  end if;

  insert into public.whatsapp_conversations (
    restaurant_id, phone, messages, status, order_id, branch_id
  ) values (
    p_restaurant_id, p_phone, p_new_messages, coalesce(p_status, 'active'),
    p_order_id, p_branch_id
  )
  on conflict (restaurant_id, phone) do update
  set messages = whatsapp_conversations.messages || excluded.messages,
      status = coalesce(p_status, whatsapp_conversations.status),
      order_id = coalesce(p_order_id, whatsapp_conversations.order_id),
      branch_id = coalesce(p_branch_id, whatsapp_conversations.branch_id),
      updated_at = now()
  returning messages into v_messages;
  return v_messages;
end
$$;
revoke all on function public.whatsapp_append_turn(uuid, text, jsonb, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.whatsapp_append_turn(uuid, text, jsonb, text, uuid, uuid)
  to service_role;
