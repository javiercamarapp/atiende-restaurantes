-- Executable privacy controls. Retention remains disabled until a tenant
-- chooses explicit periods, so deployment does not invent a legal policy.
create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid,
  request_type text not null check (request_type in ('export', 'erase')),
  requested_by uuid not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  affected_rows integer not null default 0
);

create table public.privacy_retention_policies (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  order_pii_days integer check (order_pii_days between 30 and 3650),
  conversation_days integer check (conversation_days between 1 and 3650),
  resolved_callback_days integer check (resolved_callback_days between 1 and 3650),
  updated_at timestamptz not null default now(),
  updated_by uuid not null
);

alter table public.privacy_requests enable row level security;
alter table public.privacy_retention_policies enable row level security;
create policy "Tenant managers can view privacy requests"
  on public.privacy_requests for select to authenticated
  using (public.can_manage_restaurant(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant managers can manage retention policy"
  on public.privacy_retention_policies for all to authenticated
  using (public.can_manage_restaurant(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()))
  with check (
    (public.can_manage_restaurant(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()))
    and updated_by = auth.uid()
  );
revoke all on public.privacy_requests, public.privacy_retention_policies from public, anon;
grant select on public.privacy_requests to authenticated;
grant select, insert, update, delete on public.privacy_retention_policies to authenticated;
grant all on public.privacy_requests, public.privacy_retention_policies to service_role;

create or replace function public.export_customer_data(p_restaurant_id uuid, p_customer_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_customer public.customers%rowtype; v_result jsonb;
begin
  if not (public.can_manage_restaurant(auth.uid(), p_restaurant_id) or public.is_superadmin(auth.uid()))
    then raise insufficient_privilege using message = 'not authorized'; end if;
  select * into v_customer from public.customers
    where id = p_customer_id and restaurant_id = p_restaurant_id;
  if not found then raise no_data_found using message = 'customer not found'; end if;
  select jsonb_build_object(
    'customer', to_jsonb(v_customer),
    'addresses', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.customer_addresses a where a.customer_id = p_customer_id), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(to_jsonb(o) order by o.created_at) from public.orders o where o.restaurant_id = p_restaurant_id and o.customer_id = p_customer_id), '[]'::jsonb),
    'callbacks', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.callback_requests c where c.restaurant_id = p_restaurant_id and c.customer_phone = v_customer.phone), '[]'::jsonb)
  ) into v_result;
  insert into public.privacy_requests(restaurant_id, customer_id, request_type, requested_by)
    values (p_restaurant_id, p_customer_id, 'export', auth.uid());
  return v_result;
end $$;

create or replace function public.erase_customer_data(p_restaurant_id uuid, p_customer_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_phone text; v_request_id uuid; v_count integer := 0; v_step integer;
begin
  if not (public.can_manage_restaurant(auth.uid(), p_restaurant_id) or public.is_superadmin(auth.uid()))
    then raise insufficient_privilege using message = 'not authorized'; end if;
  select phone into v_phone from public.customers
    where id = p_customer_id and restaurant_id = p_restaurant_id for update;
  if not found then raise no_data_found using message = 'customer not found'; end if;
  insert into public.privacy_requests(restaurant_id, customer_id, request_type, requested_by)
    values (p_restaurant_id, p_customer_id, 'erase', auth.uid()) returning id into v_request_id;
  update public.orders set customer_id = null, customer_name = 'Cliente eliminado',
    customer_phone = 'erased-' || p_customer_id::text, customer_address = null
    where restaurant_id = p_restaurant_id and customer_id = p_customer_id;
  get diagnostics v_step = row_count; v_count := v_count + v_step;
  delete from public.callback_requests where restaurant_id = p_restaurant_id and customer_phone = v_phone;
  get diagnostics v_step = row_count; v_count := v_count + v_step;
  delete from public.whatsapp_conversations where restaurant_id = p_restaurant_id and phone = v_phone;
  get diagnostics v_step = row_count; v_count := v_count + v_step;
  delete from public.customers where id = p_customer_id and restaurant_id = p_restaurant_id;
  get diagnostics v_step = row_count; v_count := v_count + v_step;
  update public.privacy_requests set affected_rows = v_count where id = v_request_id;
  return v_count;
end $$;

create or replace function public.run_privacy_retention(p_restaurant_id uuid, p_limit integer default 500)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_policy public.privacy_retention_policies%rowtype;
  v_orders integer := 0; v_conversations integer := 0; v_callbacks integer := 0;
begin
  if current_user not in ('postgres', 'service_role') then
    raise insufficient_privilege using message = 'service role required'; end if;
  if p_limit not between 1 and 5000 then raise exception 'invalid limit'; end if;
  select * into v_policy from public.privacy_retention_policies where restaurant_id = p_restaurant_id;
  if not found then return jsonb_build_object('disabled', true); end if;
  if v_policy.order_pii_days is not null then
    with targets as (select id from public.orders where restaurant_id = p_restaurant_id
      and created_at < now() - make_interval(days => v_policy.order_pii_days)
      and status in ('completado', 'entregado', 'cancelado') order by created_at limit p_limit for update skip locked)
    update public.orders o set customer_id = null, customer_name = 'Cliente eliminado',
      customer_phone = 'retained-order-' || o.id::text, customer_address = null
      from targets t where o.id = t.id;
    get diagnostics v_orders = row_count;
  end if;
  if v_policy.conversation_days is not null then
    with targets as (select id from public.whatsapp_conversations where restaurant_id = p_restaurant_id
      and updated_at < now() - make_interval(days => v_policy.conversation_days)
      and status in ('completed', 'abandoned') order by updated_at limit p_limit for update skip locked)
    delete from public.whatsapp_conversations c using targets t where c.id = t.id;
    get diagnostics v_conversations = row_count;
  end if;
  if v_policy.resolved_callback_days is not null then
    with targets as (select id from public.callback_requests where restaurant_id = p_restaurant_id and resolved
      and created_at < now() - make_interval(days => v_policy.resolved_callback_days)
      order by created_at limit p_limit for update skip locked)
    delete from public.callback_requests c using targets t where c.id = t.id;
    get diagnostics v_callbacks = row_count;
  end if;
  return jsonb_build_object('disabled', false, 'orders_anonymized', v_orders,
    'conversations_deleted', v_conversations, 'callbacks_deleted', v_callbacks);
end $$;

revoke all on function public.export_customer_data(uuid,uuid) from public, anon;
revoke all on function public.erase_customer_data(uuid,uuid) from public, anon;
revoke all on function public.run_privacy_retention(uuid,integer) from public, anon, authenticated;
grant execute on function public.export_customer_data(uuid,uuid) to authenticated;
grant execute on function public.erase_customer_data(uuid,uuid) to authenticated;
grant execute on function public.run_privacy_retention(uuid,integer) to service_role;
create index privacy_requests_restaurant_created_idx on public.privacy_requests(restaurant_id, created_at desc);
