begin;

insert into public.restaurants(id, name, slug) values
  ('52000000-0000-0000-0000-000000000001', 'Order Test', 'order-test');
insert into public.branches(id, restaurant_id, name, slug, address, is_active) values
  ('52000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000001', 'Branch', 'order-test-branch', 'Test', true);
insert into public.customers(id, restaurant_id, phone, name, order_count) values
  ('52000000-0000-0000-0000-000000000003', '52000000-0000-0000-0000-000000000001', '9990000000', 'Test', 0);

do $$
declare
  v_payload jsonb := jsonb_build_object(
    'customer_name', 'Test', 'customer_phone', '9990000000',
    'customer_id', '52000000-0000-0000-0000-000000000003',
    'restaurant_id', '52000000-0000-0000-0000-000000000001',
    'branch', 'Branch', 'branch_id', '52000000-0000-0000-0000-000000000002',
    'total', 100, 'items', '[{"id":"p1","name":"Product","price":100,"quantity":1}]'::jsonb,
    'source', 'web'
  );
  v_first jsonb;
  v_second jsonb;
begin
  v_first := public.create_order_idempotent(v_payload, repeat('a', 64), null);
  v_second := public.create_order_idempotent(v_payload, repeat('a', 64), null);
  if v_first->>'id' <> v_second->>'id' then raise exception 'fingerprint retry created a duplicate'; end if;
  if (select count(*) from public.orders where restaurant_id = '52000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'unexpected order count';
  end if;
  if (select order_count from public.customers where id = '52000000-0000-0000-0000-000000000003') <> 1 then
    raise exception 'duplicate retry incremented customer order_count';
  end if;

  v_first := public.create_order_idempotent(v_payload, repeat('b', 64), repeat('c', 64));
  v_second := public.create_order_idempotent(v_payload, repeat('d', 64), repeat('c', 64));
  if v_first->>'id' <> v_second->>'id' then raise exception 'explicit idempotency retry created a duplicate'; end if;
end;
$$;

rollback;
