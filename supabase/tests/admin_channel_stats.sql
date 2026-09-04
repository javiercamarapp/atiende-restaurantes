begin;

insert into public.restaurants(id, name, slug) values
  ('54000000-0000-0000-0000-000000000001', 'Stats Test', 'stats-test');
insert into public.branches(id, restaurant_id, name, slug, address, is_active) values
  ('54000000-0000-0000-0000-000000000002', '54000000-0000-0000-0000-000000000001', 'Branch', 'stats-test-branch', 'Test', true);
insert into public.orders(customer_name, customer_phone, restaurant_id, branch_id, total, items, source, status) values
  ('A', '9990000001', '54000000-0000-0000-0000-000000000001', '54000000-0000-0000-0000-000000000002', 100, '[]', 'voice', 'entregado'),
  ('B', '9990000002', '54000000-0000-0000-0000-000000000001', '54000000-0000-0000-0000-000000000002', 50, '[]', 'whatsapp', 'cancelado'),
  ('Widget', 'widget-test', '54000000-0000-0000-0000-000000000001', '54000000-0000-0000-0000-000000000002', 999, '[]', 'whatsapp', 'entregado');
insert into public.whatsapp_conversations(restaurant_id, phone, branch_id, messages, order_id) values
  ('54000000-0000-0000-0000-000000000001', '+529990000001', '54000000-0000-0000-0000-000000000002', '[{"role":"user"},{"role":"assistant"}]', null),
  ('54000000-0000-0000-0000-000000000001', '+529990000002', '54000000-0000-0000-0000-000000000002', '[{"role":"user"}]', (select id from public.orders where customer_name = 'B'));

do $$
declare
  v_orders record;
  v_chats record;
begin
  select * into v_orders from public.orders_channel_stats('54000000-0000-0000-0000-000000000001', null);
  if v_orders.total_orders <> 2 or v_orders.total_revenue <> 150 or v_orders.voice_orders <> 1 or v_orders.whatsapp_cancelled <> 1 then
    raise exception 'order channel aggregation is incorrect: %', row_to_json(v_orders);
  end if;
  select * into v_chats from public.whatsapp_conversation_stats('54000000-0000-0000-0000-000000000001', null);
  if v_chats.total <> 2 or v_chats.with_order <> 1 or v_chats.average_messages <> 1.5 then
    raise exception 'conversation aggregation is incorrect: %', row_to_json(v_chats);
  end if;
end;
$$;

rollback;
