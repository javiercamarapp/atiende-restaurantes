\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', 'tenant-a@example.invalid', '{}'::jsonb, now(), now()),
  ('20000000-0000-0000-0000-000000000002', 'tenant-b@example.invalid', '{}'::jsonb, now(), now()),
  ('30000000-0000-0000-0000-000000000003', 'superadmin@example.invalid', '{}'::jsonb, now(), now()),
  ('40000000-0000-0000-0000-000000000004', 'courier@example.invalid', '{"isRepartidor": true}'::jsonb, now(), now());

insert into public.restaurants (id, name, slug)
values ('20000000-0000-0000-0000-000000000000', 'Tenant B', 'tenant-b');

insert into public.restaurant_staff (restaurant_id, user_id, role)
values
  ('be3fbdeb-80e7-4e7b-9b44-22b476c08298', '10000000-0000-0000-0000-000000000001', 'admin'),
  ('20000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', 'admin'),
  ('be3fbdeb-80e7-4e7b-9b44-22b476c08298', '40000000-0000-0000-0000-000000000004', 'repartidor');

insert into public.orders (
  id, restaurant_id, customer_name, customer_phone, total, items, source
)
values
  ('10000000-0000-0000-0000-000000000011', 'be3fbdeb-80e7-4e7b-9b44-22b476c08298', 'A', '1111111111', 10, '[]', 'admin'),
  ('20000000-0000-0000-0000-000000000022', '20000000-0000-0000-0000-000000000000', 'B', '2222222222', 20, '[]', 'admin');

insert into public.categories (id, restaurant_id, name, slug)
values ('20000000-0000-0000-0000-000000000033', '20000000-0000-0000-0000-000000000000', 'Private B', 'private-b');

insert into public.customers (id, restaurant_id, phone, name)
values
  ('10000000-0000-0000-0000-000000000044', 'be3fbdeb-80e7-4e7b-9b44-22b476c08298', '1111111111', 'Customer A'),
  ('20000000-0000-0000-0000-000000000055', '20000000-0000-0000-0000-000000000000', '2222222222', 'Customer B');
insert into public.customer_addresses (customer_id, address)
values
  ('10000000-0000-0000-0000-000000000044', 'Address A'),
  ('20000000-0000-0000-0000-000000000055', 'Address B');
insert into public.callback_requests (restaurant_id, customer_name, customer_phone)
values
  ('be3fbdeb-80e7-4e7b-9b44-22b476c08298', 'Callback A', '1111111111'),
  ('20000000-0000-0000-0000-000000000000', 'Callback B', '2222222222');
insert into public.whatsapp_agent_config (restaurant_id, system_prompt)
values ('20000000-0000-0000-0000-000000000000', 'tenant B prompt');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  visible_orders integer;
  visible_rows integer;
  changed_rows integer;
begin
  select count(*) into visible_orders from public.orders;
  if visible_orders <> 1 then
    raise exception 'tenant A saw % orders; expected exactly 1', visible_orders;
  end if;

  select count(*) into visible_rows from public.customers;
  if visible_rows <> 1 then raise exception 'customer isolation failed: %', visible_rows; end if;
  select count(*) into visible_rows from public.customer_addresses;
  if visible_rows <> 1 then raise exception 'address isolation failed: %', visible_rows; end if;
  select count(*) into visible_rows from public.callback_requests;
  if visible_rows <> 1 then raise exception 'callback isolation failed: %', visible_rows; end if;
  select count(*) into visible_rows from public.whatsapp_agent_config;
  if visible_rows <> 1 then raise exception 'agent config isolation failed: %', visible_rows; end if;
  select count(*) into visible_rows from public.restaurant_staff;
  if visible_rows <> 2 then raise exception 'staff isolation failed: %', visible_rows; end if;
  select count(*) into visible_rows from public.profiles;
  if visible_rows <> 2 then raise exception 'profile isolation failed: %', visible_rows; end if;

  update public.categories
  set name = 'cross-tenant write'
  where id = '20000000-0000-0000-0000-000000000033';
  get diagnostics changed_rows = row_count;
  if changed_rows <> 0 then
    raise exception 'tenant A updated tenant B category';
  end if;

  begin
    insert into public.user_roles (user_id, role)
    values ('10000000-0000-0000-0000-000000000001', 'superadmin');
    raise exception 'self-escalation unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
    when check_violation then null;
  end;
end
$$;

reset role;
insert into public.user_roles (user_id, role)
values ('30000000-0000-0000-0000-000000000003', 'superadmin');
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);

do $$
declare visible_orders integer;
begin
  select count(*) into visible_orders from public.orders;
  if visible_orders <> 2 then
    raise exception 'authenticated superadmin saw % orders; expected 2', visible_orders;
  end if;
end
$$;

rollback;
