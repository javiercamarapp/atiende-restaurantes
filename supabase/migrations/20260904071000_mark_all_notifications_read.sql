-- Mark-all is evaluated in Postgres from the same seven event categories as
-- notification_unread_count. This avoids client pagination/race differences
-- and keeps the dashboard bell and notification center strictly consistent.
create or replace function public.mark_all_notifications_read(p_restaurant_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_affected integer;
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
  insert into public.notification_reads(user_id, restaurant_id, notification_key, read_at)
  select v_user_id, p_restaurant_id, eventos.notification_key, now()
  from eventos
  on conflict (user_id, restaurant_id, notification_key)
  do update set read_at = excluded.read_at;

  get diagnostics v_affected = row_count;
  return coalesce(v_affected, 0);
end;
$$;

revoke all on function public.mark_all_notifications_read(uuid) from public;
grant execute on function public.mark_all_notifications_read(uuid) to authenticated, service_role;
