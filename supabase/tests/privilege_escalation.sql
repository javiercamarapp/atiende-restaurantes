begin;

insert into auth.users(id, email, raw_user_meta_data, created_at, updated_at) values
  ('55000000-0000-0000-0000-000000000001', 'manager@example.invalid', '{}', now(), now()),
  ('55000000-0000-0000-0000-000000000002', 'courier@example.invalid', '{"isRepartidor":true}', now(), now());
insert into public.restaurants(id, name, slug) values
  ('55000000-0000-0000-0000-000000000010', 'Privilege A', 'privilege-a'),
  ('55000000-0000-0000-0000-000000000020', 'Privilege B', 'privilege-b');
insert into public.restaurant_staff(id, restaurant_id, user_id, role) values
  ('55000000-0000-0000-0000-000000000011', '55000000-0000-0000-0000-000000000010', '55000000-0000-0000-0000-000000000001', 'admin'),
  ('55000000-0000-0000-0000-000000000012', '55000000-0000-0000-0000-000000000010', '55000000-0000-0000-0000-000000000002', 'repartidor');
insert into public.orders(id, restaurant_id, customer_name, customer_phone, total, items, source, status, assigned_repartidor_id) values
  ('55000000-0000-0000-0000-000000000013', '55000000-0000-0000-0000-000000000010', 'Assigned', '9990000001', 100, '[]', 'admin', 'preparando', '55000000-0000-0000-0000-000000000002'),
  ('55000000-0000-0000-0000-000000000014', '55000000-0000-0000-0000-000000000010', 'Other', '9990000002', 200, '[]', 'admin', 'preparando', null);
insert into public.categories(id, restaurant_id, name, slug) values
  ('55000000-0000-0000-0000-000000000015', '55000000-0000-0000-0000-000000000010', 'Protected', 'protected');
insert into public.branches(id, restaurant_id, name, slug) values
  ('55000000-0000-0000-0000-000000000017', '55000000-0000-0000-0000-000000000010', 'Protected branch', 'protected-branch');
insert into public.products(id, restaurant_id, category_id, name, price) values
  ('55000000-0000-0000-0000-000000000016', '55000000-0000-0000-0000-000000000010', '55000000-0000-0000-0000-000000000015', 'Protected product', 100);
insert into public.whatsapp_agent_config(restaurant_id, system_prompt) values
  ('55000000-0000-0000-0000-000000000010', 'Protected prompt');

set local role authenticated;
select set_config('request.jwt.claim.sub', '55000000-0000-0000-0000-000000000001', true);

do $$
begin
  begin
    update public.restaurant_staff set restaurant_id = '55000000-0000-0000-0000-000000000020', role = 'owner'
    where id = '55000000-0000-0000-0000-000000000011';
    raise exception 'membership takeover unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  if not public.update_my_notification_preference('55000000-0000-0000-0000-000000000011', 'notify_nuevo', false) then
    raise exception 'safe preference update failed';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '55000000-0000-0000-0000-000000000002', true);
do $$
declare v_count integer;
begin
  if (select count(*) from public.orders) <> 1 then raise exception 'courier can see unassigned tenant orders'; end if;
  begin
    update public.orders set total = 0, customer_phone = 'stolen' where id = '55000000-0000-0000-0000-000000000013';
    raise exception 'courier changed protected order columns';
  exception when insufficient_privilege then null;
  end;
  update public.orders set status = 'entregado' where id = '55000000-0000-0000-0000-000000000013';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'courier bypassed safe status RPC'; end if;
  if not public.update_assigned_order_status('55000000-0000-0000-0000-000000000013', 'en_camino', null) then raise exception 'safe en_camino failed'; end if;
  if not public.update_assigned_order_status('55000000-0000-0000-0000-000000000013', 'entregado', null) then raise exception 'safe entregado failed'; end if;
  if (select total from public.orders where id = '55000000-0000-0000-0000-000000000013') <> 100 then raise exception 'order total changed'; end if;
  update public.categories set name = 'Courier takeover' where id = '55000000-0000-0000-0000-000000000015';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'courier changed catalog'; end if;
  update public.branch_products set price = 0, is_available = false
    where branch_id = '55000000-0000-0000-0000-000000000017'
      and product_id = '55000000-0000-0000-0000-000000000016';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'courier changed branch price or availability'; end if;
  update public.whatsapp_agent_config set system_prompt = 'Courier prompt' where restaurant_id = '55000000-0000-0000-0000-000000000010';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'courier changed agent config'; end if;
end;
$$;

rollback;
