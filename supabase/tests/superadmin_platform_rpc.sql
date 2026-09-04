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
rollback;
