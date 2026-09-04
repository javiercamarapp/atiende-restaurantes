create or replace function public.orders_channel_stats(
  p_restaurant_id uuid,
  p_branch_id uuid default null
)
returns table(
  total_orders bigint,
  total_revenue numeric,
  voice_orders bigint,
  voice_completed bigint,
  voice_cancelled bigint,
  voice_revenue numeric,
  whatsapp_orders bigint,
  whatsapp_completed bigint,
  whatsapp_cancelled bigint,
  whatsapp_revenue numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*),
    coalesce(sum(total), 0),
    count(*) filter (where source = 'voice'),
    count(*) filter (where source = 'voice' and status in ('completado', 'entregado')),
    count(*) filter (where source = 'voice' and status = 'cancelado'),
    coalesce(sum(total) filter (where source = 'voice'), 0),
    count(*) filter (where source = 'whatsapp'),
    count(*) filter (where source = 'whatsapp' and status in ('completado', 'entregado')),
    count(*) filter (where source = 'whatsapp' and status = 'cancelado'),
    coalesce(sum(total) filter (where source = 'whatsapp'), 0)
  from public.orders
  where restaurant_id = p_restaurant_id
    and (p_branch_id is null or branch_id = p_branch_id)
    and customer_phone not ilike 'widget-%';
$$;

create or replace function public.whatsapp_conversation_stats(
  p_restaurant_id uuid,
  p_branch_id uuid default null
)
returns table(total bigint, with_order bigint, average_messages numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*),
    count(*) filter (where order_id is not null),
    coalesce(avg(jsonb_array_length(messages)), 0)
  from public.whatsapp_conversations
  where restaurant_id = p_restaurant_id
    and (p_branch_id is null or branch_id = p_branch_id);
$$;

revoke all on function public.orders_channel_stats(uuid,uuid) from public, anon;
revoke all on function public.whatsapp_conversation_stats(uuid,uuid) from public, anon;
grant execute on function public.orders_channel_stats(uuid,uuid) to authenticated;
grant execute on function public.whatsapp_conversation_stats(uuid,uuid) to authenticated;
