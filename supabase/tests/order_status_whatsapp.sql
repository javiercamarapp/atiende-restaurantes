-- WhatsApp al cliente en cambios de estado del pedido (mismo outbox que el
-- correo a staff). Contrato local: no llama Graph API, solo prueba que el
-- trigger encola lo correcto en messaging_outbox.
begin;

insert into public.restaurants(id, name, slug) values
  ('53000000-0000-0000-0000-000000000001', 'WhatsApp Status Test', 'wa-status-test');
insert into public.branches(id, restaurant_id, name, slug, address, is_active) values
  ('53000000-0000-0000-0000-000000000002', '53000000-0000-0000-0000-000000000001', 'Centro', 'wa-status-test-centro', 'Test', true);

do $$
declare
  r uuid := '53000000-0000-0000-0000-000000000001';
  o uuid;
  n integer;
  wa public.messaging_outbox;
begin
  -- El INSERT (evento "nuevo") sigue encolando el correo a staff, pero NO
  -- debe encolar WhatsApp al cliente (ya recibió confirmación en su propio
  -- canal al hacer el pedido).
  insert into public.orders(id, restaurant_id, branch_id, branch, customer_name, customer_phone, total, items, status)
    values (gen_random_uuid(), r, '53000000-0000-0000-0000-000000000002', 'Centro', 'Cliente Uno', '9991234567', 150, '[]', 'pending')
    returning id, order_number into o, n;

  if not exists (select 1 from public.messaging_outbox
      where restaurant_id = r and channel = 'email' and dedupe_key = 'order:' || o::text || ':status:nuevo') then
    raise exception 'initial order did not enqueue nuevo email';
  end if;
  if exists (select 1 from public.messaging_outbox where restaurant_id = r and channel = 'whatsapp') then
    raise exception 'initial order (nuevo) enqueued an unwanted whatsapp message';
  end if;

  -- preparando / en_camino / entregado: los tres que el pedido exige como mínimo.
  update public.orders set status = 'preparando' where id = o;
  select * into wa from public.messaging_outbox
    where restaurant_id = r and channel = 'whatsapp' and dedupe_key = 'order:' || o::text || ':status:preparando';
  if not found then raise exception 'preparando did not enqueue whatsapp'; end if;
  if wa.payload->>'to' <> '529991234567' then raise exception 'preparando whatsapp "to" is wrong: %', wa.payload->>'to'; end if;
  if wa.payload->>'body' not like '%#' || n || '%' or wa.payload->>'body' not like '%Centro%' then
    raise exception 'preparando whatsapp body missing order number or branch: %', wa.payload->>'body';
  end if;

  update public.orders set status = 'en_camino' where id = o;
  if not exists (select 1 from public.messaging_outbox
      where restaurant_id = r and channel = 'whatsapp' and dedupe_key = 'order:' || o::text || ':status:en_camino') then
    raise exception 'en_camino did not enqueue whatsapp';
  end if;

  update public.orders set status = 'entregado' where id = o;
  if not exists (select 1 from public.messaging_outbox
      where restaurant_id = r and channel = 'whatsapp' and dedupe_key = 'order:' || o::text || ':status:entregado') then
    raise exception 'entregado did not enqueue whatsapp';
  end if;

  -- Reafirmar el mismo estado (no-op de status) no debe volver a encolar.
  update public.orders set status = 'entregado' where id = o;
  if (select count(*) from public.messaging_outbox
      where restaurant_id = r and channel = 'whatsapp' and dedupe_key = 'order:' || o::text || ':status:entregado') <> 1 then
    raise exception 'reasserting the same status enqueued whatsapp again';
  end if;

  -- Cada estado tiene su propia dedupe_key: los tres anteriores deben coexistir.
  if (select count(*) from public.messaging_outbox where restaurant_id = r and channel = 'whatsapp') <> 3 then
    raise exception 'unexpected whatsapp outbox row count after preparando/en_camino/entregado';
  end if;
end $$;

-- completado, cancelado y problema en un pedido aparte.
do $$
declare
  r uuid := '53000000-0000-0000-0000-000000000001';
  o1 uuid; o2 uuid; o3 uuid;
begin
  insert into public.orders(id, restaurant_id, branch, customer_name, customer_phone, total, items, status)
    values (gen_random_uuid(), r, 'Centro', 'Completado', '9990000001', 100, '[]', 'pending') returning id into o1;
  update public.orders set status = 'completado' where id = o1;
  if not exists (select 1 from public.messaging_outbox
      where restaurant_id = r and channel = 'whatsapp' and dedupe_key = 'order:' || o1::text || ':status:completado') then
    raise exception 'completado did not enqueue whatsapp';
  end if;

  insert into public.orders(id, restaurant_id, branch, customer_name, customer_phone, total, items, status)
    values (gen_random_uuid(), r, 'Centro', 'Cancelado', '9990000002', 100, '[]', 'pending') returning id into o2;
  update public.orders set status = 'cancelado' where id = o2;
  if not exists (select 1 from public.messaging_outbox
      where restaurant_id = r and channel = 'whatsapp' and dedupe_key = 'order:' || o2::text || ':status:cancelado') then
    raise exception 'cancelado did not enqueue whatsapp';
  end if;

  insert into public.orders(id, restaurant_id, branch, customer_name, customer_phone, total, items, status)
    values (gen_random_uuid(), r, 'Centro', 'Problema', '9990000003', 100, '[]', 'pending') returning id into o3;
  update public.orders set status = 'problema' where id = o3;
  if not exists (select 1 from public.messaging_outbox
      where restaurant_id = r and channel = 'whatsapp' and dedupe_key = 'order:' || o3::text || ':status:problema') then
    raise exception 'problema did not enqueue whatsapp';
  end if;
end $$;

-- Un teléfono mal formado no debe tronar la transición de estado ni encolar
-- WhatsApp (el correo a staff sí se sigue encolando).
do $$
declare
  r uuid := '53000000-0000-0000-0000-000000000001';
  o uuid;
begin
  insert into public.orders(id, restaurant_id, branch, customer_name, customer_phone, total, items, status)
    values (gen_random_uuid(), r, 'Centro', 'Telefono raro', '123', 100, '[]', 'pending') returning id into o;
  update public.orders set status = 'preparando' where id = o;
  if not exists (select 1 from public.messaging_outbox
      where restaurant_id = r and channel = 'email' and dedupe_key = 'order:' || o::text || ':status:preparando') then
    raise exception 'malformed phone blocked the staff email too';
  end if;
  if exists (select 1 from public.messaging_outbox
      where restaurant_id = r and channel = 'whatsapp' and dedupe_key = 'order:' || o::text || ':status:preparando') then
    raise exception 'malformed phone should not have enqueued a whatsapp message';
  end if;
end $$;

rollback;
