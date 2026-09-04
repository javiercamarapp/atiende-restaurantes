begin;
-- Contract checks: global RPCs must be security-definer and bounded.
do $$
declare r record;
begin
  select p.prosecdef into r from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'superadmin_platform_stats';
  if not coalesce(r.prosecdef, false) then raise exception 'platform stats must be security definer'; end if;
  if has_function_privilege('anon', 'public.superadmin_platform_stats()', 'EXECUTE') then raise exception 'anon can execute'; end if;
  if has_function_privilege('authenticated', 'public.superadmin_customers_page(text,integer,integer)', 'EXECUTE') is not true then raise exception 'authenticated grant missing'; end if;
end $$;
-- Negative runtime check: an anonymous SQL session cannot obtain global data.
do $$ begin
  perform public.superadmin_platform_stats();
  raise exception 'unauthorized call unexpectedly succeeded';
exception when insufficient_privilege then null; end $$;

insert into auth.users(id, aud, role, email, encrypted_password) values
 ('67000000-0000-0000-0000-000000000001','authenticated','authenticated','sa@test.invalid','');
insert into public.user_roles(user_id,role) values
 ('67000000-0000-0000-0000-000000000001','superadmin');
insert into public.restaurants(id,name,slug) values
 ('67100000-0000-0000-0000-000000000001','Scale','scale');
insert into public.orders(restaurant_id,customer_name,customer_phone,total,items,status,created_at)
select '67100000-0000-0000-0000-000000000001','C' || i::text,'999' || lpad(i::text,7,'0'),10,'[]','pending',now()
from generate_series(1,101) i;
insert into public.customers(restaurant_id,phone,name,order_count,last_order_at)
select '67100000-0000-0000-0000-000000000001','998' || lpad(i::text,7,'0'),'Recent ' || i,1,now()
from generate_series(1,60) i;
insert into public.customers(restaurant_id,phone,name,order_count,last_order_at) values
 ('67100000-0000-0000-0000-000000000001','9970000000','Global champion',999,now()-interval '1 year');
set local role authenticated;
select set_config('request.jwt.claim.sub','67000000-0000-0000-0000-000000000001',true);
do $$ declare n bigint; amount numeric; top_name text; restaurant_total bigint; begin
  select restaurant_count into restaurant_total from public.superadmin_platform_stats();
  if restaurant_total < 1 then raise exception 'platform stats did not count restaurants'; end if;
  select order_count,order_total into n,amount from public.superadmin_orders_summary('pending',null,null);
  if n < 101 or amount < 1010 then raise exception 'summary truncated: %, %', n, amount; end if;
  select name into top_name from public.superadmin_top_customers(10) limit 1;
  if top_name <> 'Global champion' then raise exception 'top customers ranks only a recent page'; end if;
end $$;
rollback;
