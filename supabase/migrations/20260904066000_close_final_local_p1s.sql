-- Final locally-verifiable controls found by the independent re-audit.

-- A courier is a tenant member, but cannot administer branch prices or
-- availability.  The previous FOR ALL policy used is_restaurant_staff().
drop policy if exists "Restaurant staff can manage branch products" on public.branch_products;
create policy "Tenant managers can manage branch products"
  on public.branch_products for all to authenticated
  using (exists (
    select 1 from public.branches b
    where b.id = branch_products.branch_id
      and (public.can_manage_restaurant(auth.uid(), b.restaurant_id)
        or public.is_superadmin(auth.uid()))
  ))
  with check (exists (
    select 1 from public.branches b
    where b.id = branch_products.branch_id
      and (public.can_manage_restaurant(auth.uid(), b.restaurant_id)
        or public.is_superadmin(auth.uid()))
  ));

-- The initial order event is a business "nuevo" notification even though
-- the persisted workflow status starts as pending.
create or replace function public.enqueue_order_email_outbox()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_event text;
begin
  if tg_op = 'INSERT' then
    v_event := 'nuevo';
  elsif new.status is distinct from old.status
    and new.status in ('preparando','en_camino','entregado','completado','cancelado','problema') then
    v_event := new.status;
  end if;
  if v_event is not null then
    perform public.enqueue_messaging_outbox(
      new.restaurant_id, 'email', 'order.' || v_event,
      'order:' || new.id::text || ':status:' || v_event,
      jsonb_build_object('order_id', new.id::text, 'evento', v_event));
  end if;
  return new;
end; $$;
revoke all on function public.enqueue_order_email_outbox() from public, anon, authenticated;

-- Exact global count/amount for the SuperAdmin answer; the separate page RPC
-- remains only a bounded sample of rows for display/export.
create or replace function public.superadmin_orders_summary(
  p_status text default null, p_since timestamptz default null,
  p_search text default null
) returns table(order_count bigint, order_total numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_superadmin(auth.uid()) then
    raise exception 'superadmin authorization required' using errcode = '42501';
  end if;
  return query select count(*)::bigint, coalesce(sum(o.total), 0)
  from public.orders o
  where (p_status is null or (p_status = 'pending' and o.status in ('pending','preparando')) or o.status = p_status)
    and (p_since is null or o.created_at >= p_since)
    and (nullif(trim(p_search), '') is null or o.customer_name ilike '%' || trim(p_search) || '%'
      or o.customer_phone ilike '%' || trim(p_search) || '%');
end; $$;
revoke all on function public.superadmin_orders_summary(text,timestamptz,text) from public, anon;
grant execute on function public.superadmin_orders_summary(text,timestamptz,text) to authenticated;

-- DSAR matching uses the same canonical last-ten-digits identity as customer
-- ingestion, so +52/+521 variants cannot leave conversation/outbox PII behind.
create or replace function public.export_customer_data(p_restaurant_id uuid, p_customer_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_customer public.customers%rowtype; v_result jsonb; v_phone_key text;
begin
  if not (public.can_manage_restaurant(auth.uid(), p_restaurant_id) or public.is_superadmin(auth.uid()))
    then raise insufficient_privilege using message = 'not authorized'; end if;
  select * into v_customer from public.customers
    where id = p_customer_id and restaurant_id = p_restaurant_id;
  if not found then raise no_data_found using message = 'customer not found'; end if;
  v_phone_key := right(regexp_replace(coalesce(v_customer.phone, ''), '[^0-9]', '', 'g'), 10);
  select jsonb_build_object(
    'customer', to_jsonb(v_customer),
    'addresses', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.customer_addresses a where a.customer_id = p_customer_id), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(to_jsonb(o) order by o.created_at) from public.orders o where o.restaurant_id = p_restaurant_id and o.customer_id = p_customer_id), '[]'::jsonb),
    'callbacks', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.callback_requests c where c.restaurant_id = p_restaurant_id and right(regexp_replace(coalesce(c.customer_phone, ''), '[^0-9]', '', 'g'), 10) = v_phone_key), '[]'::jsonb),
    'whatsapp_conversations', coalesce((select jsonb_agg(to_jsonb(w) order by w.created_at) from public.whatsapp_conversations w where w.restaurant_id = p_restaurant_id and right(regexp_replace(coalesce(w.phone, ''), '[^0-9]', '', 'g'), 10) = v_phone_key), '[]'::jsonb),
    'pending_messages', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.messaging_outbox m where m.restaurant_id = p_restaurant_id and m.channel = 'whatsapp' and right(regexp_replace(coalesce(m.payload->>'to', ''), '[^0-9]', '', 'g'), 10) = v_phone_key), '[]'::jsonb)
  ) into v_result;
  insert into public.privacy_requests(restaurant_id, customer_id, request_type, requested_by)
    values (p_restaurant_id, p_customer_id, 'export', auth.uid());
  return v_result;
end $$;

create or replace function public.erase_customer_data(p_restaurant_id uuid, p_customer_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_phone text; v_phone_key text; v_request_id uuid; v_count integer := 0; v_step integer;
begin
  if not (public.can_manage_restaurant(auth.uid(), p_restaurant_id) or public.is_superadmin(auth.uid()))
    then raise insufficient_privilege using message = 'not authorized'; end if;
  select phone into v_phone from public.customers
    where id = p_customer_id and restaurant_id = p_restaurant_id for update;
  if not found then raise no_data_found using message = 'customer not found'; end if;
  v_phone_key := right(regexp_replace(coalesce(v_phone, ''), '[^0-9]', '', 'g'), 10);
  insert into public.privacy_requests(restaurant_id, customer_id, request_type, requested_by)
    values (p_restaurant_id, p_customer_id, 'erase', auth.uid()) returning id into v_request_id;
  update public.orders set customer_id = null, customer_name = 'Cliente eliminado',
    customer_phone = 'erased-' || p_customer_id::text, customer_address = null
    where restaurant_id = p_restaurant_id and customer_id = p_customer_id;
  get diagnostics v_step = row_count; v_count := v_count + v_step;
  delete from public.callback_requests where restaurant_id = p_restaurant_id
    and right(regexp_replace(coalesce(customer_phone, ''), '[^0-9]', '', 'g'), 10) = v_phone_key;
  get diagnostics v_step = row_count; v_count := v_count + v_step;
  delete from public.whatsapp_conversations where restaurant_id = p_restaurant_id
    and right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10) = v_phone_key;
  get diagnostics v_step = row_count; v_count := v_count + v_step;
  update public.messaging_outbox set payload = jsonb_build_object('erased', true), updated_at = now()
    where restaurant_id = p_restaurant_id and channel = 'whatsapp'
      and right(regexp_replace(coalesce(payload->>'to', ''), '[^0-9]', '', 'g'), 10) = v_phone_key;
  get diagnostics v_step = row_count; v_count := v_count + v_step;
  delete from public.customers where id = p_customer_id and restaurant_id = p_restaurant_id;
  get diagnostics v_step = row_count; v_count := v_count + v_step;
  update public.privacy_requests set affected_rows = v_count where id = v_request_id;
  return v_count;
end $$;

revoke all on function public.export_customer_data(uuid,uuid) from public, anon;
revoke all on function public.erase_customer_data(uuid,uuid) from public, anon;
grant execute on function public.export_customer_data(uuid,uuid) to authenticated;
grant execute on function public.erase_customer_data(uuid,uuid) to authenticated;
