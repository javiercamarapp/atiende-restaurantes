begin;
insert into auth.users(id,aud,role,email,encrypted_password) values
 ('67000000-0000-0000-0000-000000000001','authenticated','authenticated','observer@test.invalid',''),
 ('67000000-0000-0000-0000-000000000002','authenticated','authenticated','outsider-observer@test.invalid','');
insert into public.restaurants(id,name,slug)
 values ('67100000-0000-0000-0000-000000000001','Observed tenant','observed-tenant');
insert into public.restaurant_staff(restaurant_id,user_id,role)
 values ('67100000-0000-0000-0000-000000000001','67000000-0000-0000-0000-000000000001','admin');

select public.record_operational_event(
  '67100000-0000-0000-0000-000000000001','trace-00000001','dispatcher',
  'provider.timeout','error',30000,'{"provider":"mock"}'
) from generate_series(1,5);

do $$ begin
  begin
    perform public.record_operational_event(
      '67100000-0000-0000-0000-000000000001','trace-00000002','dispatcher',
      'unsafe','warn',1,'{"token":"secret"}'
    );
    raise exception 'sensitive metadata accepted';
  exception when others then
    if sqlerrm = 'sensitive metadata accepted' then raise; end if;
  end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','67000000-0000-0000-0000-000000000001',true);
do $$ declare snapshot jsonb; begin
  snapshot := public.operational_alert_snapshot('67100000-0000-0000-0000-000000000001',10);
  if (snapshot->>'events')::integer <> 5 or (snapshot->>'timeouts')::integer <> 5 then
    raise exception 'snapshot counters wrong'; end if;
  if not (snapshot #>> '{alerts,1,firing}')::boolean then raise exception 'timeout alert did not fire'; end if;
end $$;

select set_config('request.jwt.claim.sub','67000000-0000-0000-0000-000000000002',true);
do $$ begin
  begin
    perform public.operational_alert_snapshot('67100000-0000-0000-0000-000000000001',10);
    raise exception 'cross-tenant snapshot succeeded';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
