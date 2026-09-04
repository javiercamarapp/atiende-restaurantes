-- Una llave identifica un intento concreto, no permiso para ignorar cambios
-- materiales de dirección, pago, productos o instrucciones de preparación.
create or replace function public.create_order_idempotent(
  p_order jsonb,
  p_dedupe_fingerprint text,
  p_idempotency_key text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_restaurant_id uuid := (p_order->>'restaurant_id')::uuid;
  v_customer_id uuid := (p_order->>'customer_id')::uuid;
begin
  if p_dedupe_fingerprint is null or p_dedupe_fingerprint !~ '^[0-9a-f]{64}$'
     or (p_idempotency_key is not null and p_idempotency_key !~ '^[0-9a-f]{64}$') then
    raise exception 'invalid idempotency input';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    v_restaurant_id::text || ':' || coalesce(p_idempotency_key, p_dedupe_fingerprint),
    0
  ));

  if p_idempotency_key is not null then
    select * into v_order from public.orders
    where restaurant_id = v_restaurant_id and idempotency_key = p_idempotency_key
    limit 1;
    if v_order.id is not null and v_order.dedupe_fingerprint is distinct from p_dedupe_fingerprint then
      raise sqlstate 'PT409' using message = 'idempotency key was already used with a different order payload';
    end if;
  else
    select * into v_order from public.orders
    where restaurant_id = v_restaurant_id
      and dedupe_fingerprint = p_dedupe_fingerprint
      and status = 'pending'
      and created_at >= now() - interval '5 minutes'
    order by created_at desc
    limit 1;
  end if;

  if v_order.id is not null then return to_jsonb(v_order); end if;

  insert into public.orders(
    customer_name, customer_phone, customer_address, customer_id,
    restaurant_id, branch, branch_id, total, status, items, source,
    call_transcript, call_recording_url, notes, payment_method,
    dedupe_fingerprint, idempotency_key
  ) values (
    p_order->>'customer_name', p_order->>'customer_phone', nullif(p_order->>'customer_address', ''), v_customer_id,
    v_restaurant_id, p_order->>'branch', (p_order->>'branch_id')::uuid,
    (p_order->>'total')::numeric, 'pending', p_order->'items', p_order->>'source',
    nullif(p_order->>'call_transcript', ''), nullif(p_order->>'call_recording_url', ''),
    nullif(p_order->>'notes', ''), nullif(p_order->>'payment_method', ''),
    p_dedupe_fingerprint, p_idempotency_key
  ) returning * into v_order;

  update public.customers
  set order_count = order_count + 1, last_order_at = now()
  where id = v_customer_id and restaurant_id = v_restaurant_id;

  return to_jsonb(v_order);
end;
$$;

revoke all on function public.create_order_idempotent(jsonb,text,text) from public, anon, authenticated;
grant execute on function public.create_order_idempotent(jsonb,text,text) to service_role;
