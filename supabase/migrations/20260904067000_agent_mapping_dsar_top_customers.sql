-- Capture the hosted agent mapping in reproducible schema history.
alter table public.branches add column if not exists elevenlabs_agent_id text;
create unique index if not exists branches_elevenlabs_agent_id_key
  on public.branches(elevenlabs_agent_id) where elevenlabs_agent_id is not null;

-- Global ranking is an aggregate query, not a sort of the first recent page.
create or replace function public.superadmin_top_customers(p_limit integer default 10)
returns table(restaurant_id uuid, name text, phone text, order_count integer, last_order_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_superadmin(auth.uid()) then
    raise exception 'superadmin authorization required' using errcode = '42501';
  end if;
  if p_limit < 1 or p_limit > 100 then raise exception 'invalid limit'; end if;
  return query select c.restaurant_id, c.name, c.phone, c.order_count, c.last_order_at
    from public.customers c
    order by c.order_count desc, c.last_order_at desc nulls last, c.restaurant_id, c.phone
    limit p_limit;
end; $$;
revoke all on function public.superadmin_top_customers(integer) from public, anon;
grant execute on function public.superadmin_top_customers(integer) to authenticated;

-- Extend erasure to voice-derived PII. Canonical phone matching is used only
-- for a full 10-digit identity; malformed/short legacy values fall back to
-- exact matching to avoid broad suffix collisions.
create or replace function public.export_customer_data(p_restaurant_id uuid, p_customer_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_customer public.customers%rowtype; v_result jsonb; v_digits text;
  v_phone_key text; v_canonical boolean;
begin
  if not (public.can_manage_restaurant(auth.uid(), p_restaurant_id) or public.is_superadmin(auth.uid()))
    then raise insufficient_privilege using message = 'not authorized'; end if;
  select * into v_customer from public.customers
    where id = p_customer_id and restaurant_id = p_restaurant_id;
  if not found then raise no_data_found using message = 'customer not found'; end if;
  v_digits := regexp_replace(coalesce(v_customer.phone, ''), '[^0-9]', '', 'g');
  v_phone_key := right(v_digits, 10);
  v_canonical := length(v_digits) >= 10;
  select jsonb_build_object(
    'customer', to_jsonb(v_customer),
    'addresses', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.customer_addresses a where a.customer_id = p_customer_id), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(to_jsonb(o) order by o.created_at) from public.orders o where o.restaurant_id = p_restaurant_id and o.customer_id = p_customer_id), '[]'::jsonb),
    'callbacks', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.callback_requests c where c.restaurant_id = p_restaurant_id and ((v_canonical and right(regexp_replace(coalesce(c.customer_phone, ''), '[^0-9]', '', 'g'), 10) = v_phone_key) or (not v_canonical and c.customer_phone = v_customer.phone))), '[]'::jsonb),
    'whatsapp_conversations', coalesce((select jsonb_agg(to_jsonb(w) order by w.created_at) from public.whatsapp_conversations w where w.restaurant_id = p_restaurant_id and ((v_canonical and right(regexp_replace(coalesce(w.phone, ''), '[^0-9]', '', 'g'), 10) = v_phone_key) or (not v_canonical and w.phone = v_customer.phone))), '[]'::jsonb),
    'pending_messages', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.messaging_outbox m where m.restaurant_id = p_restaurant_id and m.channel = 'whatsapp' and ((v_canonical and right(regexp_replace(coalesce(m.payload->>'to', ''), '[^0-9]', '', 'g'), 10) = v_phone_key) or (not v_canonical and m.payload->>'to' = v_customer.phone))), '[]'::jsonb)
  ) into v_result;
  insert into public.privacy_requests(restaurant_id, customer_id, request_type, requested_by)
    values (p_restaurant_id, p_customer_id, 'export', auth.uid());
  return v_result;
end $$;

create or replace function public.erase_customer_data(p_restaurant_id uuid, p_customer_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_phone text; v_digits text; v_phone_key text; v_canonical boolean;
  v_request_id uuid; v_count integer := 0; v_step integer;
begin
  if not (public.can_manage_restaurant(auth.uid(), p_restaurant_id) or public.is_superadmin(auth.uid()))
    then raise insufficient_privilege using message = 'not authorized'; end if;
  select phone into v_phone from public.customers
    where id = p_customer_id and restaurant_id = p_restaurant_id for update;
  if not found then raise no_data_found using message = 'customer not found'; end if;
  v_digits := regexp_replace(coalesce(v_phone, ''), '[^0-9]', '', 'g');
  v_phone_key := right(v_digits, 10);
  v_canonical := length(v_digits) >= 10;
  insert into public.privacy_requests(restaurant_id, customer_id, request_type, requested_by)
    values (p_restaurant_id, p_customer_id, 'erase', auth.uid()) returning id into v_request_id;
  update public.orders set customer_id = null, customer_name = 'Cliente eliminado',
    customer_phone = 'erased-' || p_customer_id::text, customer_address = null,
    call_transcript = null, call_recording_url = null, notes = null, incident_note = null
    where restaurant_id = p_restaurant_id and customer_id = p_customer_id;
  get diagnostics v_step = row_count; v_count := v_count + v_step;
  delete from public.callback_requests where restaurant_id = p_restaurant_id and
    ((v_canonical and right(regexp_replace(coalesce(customer_phone, ''), '[^0-9]', '', 'g'), 10) = v_phone_key)
      or (not v_canonical and customer_phone = v_phone));
  get diagnostics v_step = row_count; v_count := v_count + v_step;
  delete from public.whatsapp_conversations where restaurant_id = p_restaurant_id and
    ((v_canonical and right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 10) = v_phone_key)
      or (not v_canonical and phone = v_phone));
  get diagnostics v_step = row_count; v_count := v_count + v_step;
  update public.messaging_outbox set payload = jsonb_build_object('erased', true), updated_at = now()
    where restaurant_id = p_restaurant_id and channel = 'whatsapp' and
      ((v_canonical and right(regexp_replace(coalesce(payload->>'to', ''), '[^0-9]', '', 'g'), 10) = v_phone_key)
        or (not v_canonical and payload->>'to' = v_phone));
  get diagnostics v_step = row_count; v_count := v_count + v_step;
  delete from public.customers where id = p_customer_id and restaurant_id = p_restaurant_id;
  get diagnostics v_step = row_count; v_count := v_count + v_step;
  update public.privacy_requests set affected_rows = v_count where id = v_request_id;
  return v_count;
end $$;
revoke all on function public.erase_customer_data(uuid,uuid) from public, anon;
revoke all on function public.export_customer_data(uuid,uuid) from public, anon;
grant execute on function public.erase_customer_data(uuid,uuid) to authenticated;
grant execute on function public.export_customer_data(uuid,uuid) to authenticated;
