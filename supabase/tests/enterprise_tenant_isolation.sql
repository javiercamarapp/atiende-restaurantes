\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', 'tenant-a@example.invalid', '{}'::jsonb, now(), now()),
  ('20000000-0000-0000-0000-000000000002', 'tenant-b@example.invalid', '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, slug)
values ('20000000-0000-0000-0000-000000000000', 'Tenant B', 'tenant-b');

insert into public.restaurant_staff (restaurant_id, user_id, role)
values
  ('be3fbdeb-80e7-4e7b-9b44-22b476c08298', '10000000-0000-0000-0000-000000000001', 'admin'),
  ('20000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', 'admin');

insert into public.orders (
  id, restaurant_id, customer_name, customer_phone, total, items, source
)
values
  ('10000000-0000-0000-0000-000000000011', 'be3fbdeb-80e7-4e7b-9b44-22b476c08298', 'A', '1111111111', 10, '[]', 'admin'),
  ('20000000-0000-0000-0000-000000000022', '20000000-0000-0000-0000-000000000000', 'B', '2222222222', 20, '[]', 'admin');

insert into public.categories (id, restaurant_id, name, slug)
values ('20000000-0000-0000-0000-000000000033', '20000000-0000-0000-0000-000000000000', 'Private B', 'private-b');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  visible_orders integer;
  changed_rows integer;
begin
  select count(*) into visible_orders from public.orders;
  if visible_orders <> 1 then
    raise exception 'tenant A saw % orders; expected exactly 1', visible_orders;
  end if;

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

rollback;
