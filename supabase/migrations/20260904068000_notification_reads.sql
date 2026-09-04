-- Per-user read state for the notification center. Reading a notification is
-- intentionally independent from the operational state of an order/callback:
-- opening an order must clear its badge without changing its workflow status.
create table if not exists public.notification_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  notification_key text not null check (
    char_length(notification_key) between 3 and 160
    and notification_key ~ '^(recibidos|entregados|reclamos|entrega_tardia|programados|quejas|escalar):[0-9a-f-]{36}$'
  ),
  read_at timestamptz not null default now(),
  primary key (user_id, restaurant_id, notification_key)
);

create index if not exists notification_reads_restaurant_user_read_at_idx
  on public.notification_reads (restaurant_id, user_id, read_at desc);

alter table public.notification_reads enable row level security;

drop policy if exists "Users can view their notification reads" on public.notification_reads;
create policy "Users can view their notification reads"
  on public.notification_reads for select to authenticated
  using (
    user_id = auth.uid()
    and (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()))
  );

drop policy if exists "Users can mark their notifications read" on public.notification_reads;
create policy "Users can mark their notifications read"
  on public.notification_reads for insert to authenticated
  with check (
    user_id = auth.uid()
    and (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()))
  );

-- Upsert is used by the UI so repeated clicks and concurrent browser tabs are
-- idempotent. The row cannot be moved to another user or tenant.
drop policy if exists "Users can refresh their notification reads" on public.notification_reads;
create policy "Users can refresh their notification reads"
  on public.notification_reads for update to authenticated
  using (
    user_id = auth.uid()
    and (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()))
  )
  with check (
    user_id = auth.uid()
    and (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()))
  );

revoke all on table public.notification_reads from anon;
grant select, insert, update on table public.notification_reads to authenticated;
grant all on table public.notification_reads to service_role;

-- Single source of truth for the dashboard bell. It mirrors the seven inbox
-- categories, their per-user preferences and the 200-row cap used by the UI.
create or replace function public.notification_unread_count(p_restaurant_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null or not (
    public.is_restaurant_staff(v_user_id, p_restaurant_id)
    or public.is_superadmin(v_user_id)
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  with preferencias as (
    select
      coalesce((select notify_nuevo from public.restaurant_staff where user_id = v_user_id and restaurant_id = p_restaurant_id), true) as recibidos,
      coalesce((select notify_entregado from public.restaurant_staff where user_id = v_user_id and restaurant_id = p_restaurant_id), true) as entregados,
      coalesce((select notify_cancelado from public.restaurant_staff where user_id = v_user_id and restaurant_id = p_restaurant_id), true) as reclamos,
      coalesce((select notify_entrega_tardia from public.restaurant_staff where user_id = v_user_id and restaurant_id = p_restaurant_id), true) as entrega_tardia,
      coalesce((select notify_programado_por_vencer from public.restaurant_staff where user_id = v_user_id and restaurant_id = p_restaurant_id), true) as programados,
      coalesce((select notify_queja from public.restaurant_staff where user_id = v_user_id and restaurant_id = p_restaurant_id), true) as quejas,
      coalesce((select notify_escalar from public.restaurant_staff where user_id = v_user_id and restaurant_id = p_restaurant_id), true) as escalar
  ),
  eventos as (
    select 'recibidos:' || o.id::text as notification_key
      from (select id from public.orders where restaurant_id = p_restaurant_id and status = 'pending' order by created_at desc limit 200) o, preferencias p
      where p.recibidos
    union all
    select 'entregados:' || o.id::text
      from (select id from public.orders where restaurant_id = p_restaurant_id and status = 'entregado' order by created_at desc limit 200) o, preferencias p
      where p.entregados
    union all
    select 'reclamos:' || o.id::text
      from (select id from public.orders where restaurant_id = p_restaurant_id and status in ('cancelado', 'problema') order by created_at desc limit 200) o, preferencias p
      where p.reclamos
    union all
    select 'entrega_tardia:' || o.id::text
      from (
        select id from public.orders
        where restaurant_id = p_restaurant_id
          and status = 'entregado'
          and delivered_at is not null
          and (
            (estimated_delivery_at is not null and delivered_at > estimated_delivery_at)
            or (estimated_delivery_at is null and delivered_at > created_at + interval '60 minutes')
          )
        order by delivered_at desc limit 200
      ) o, preferencias p
      where p.entrega_tardia
    union all
    select 'programados:' || o.id::text
      from (
        select id from public.orders
        where restaurant_id = p_restaurant_id
          and status = 'pending'
          and scheduled_for is not null
          and scheduled_for <= now() + interval '30 minutes'
        order by scheduled_for asc limit 200
      ) o, preferencias p
      where p.programados
    union all
    select 'quejas:' || c.id::text
      from (
        select id from public.callback_requests
        where restaurant_id = p_restaurant_id
          and lower(coalesce(reason, '')) like any (array['%queja%', '%reclamo%', '%inconform%', '%molest%', '%insatisfe%', '%mal servicio%'])
        order by created_at desc limit 200
      ) c, preferencias p
      where p.quejas
    union all
    select 'escalar:' || c.id::text
      from (
        select id from public.callback_requests
        where restaurant_id = p_restaurant_id and resolved = false
        order by created_at desc limit 200
      ) c, preferencias p
      where p.escalar
  )
  select count(*)::integer into v_count
  from eventos e
  where not exists (
    select 1 from public.notification_reads nr
    where nr.user_id = v_user_id
      and nr.restaurant_id = p_restaurant_id
      and nr.notification_key = e.notification_key
  );

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.notification_unread_count(uuid) from public;
grant execute on function public.notification_unread_count(uuid) to authenticated, service_role;
