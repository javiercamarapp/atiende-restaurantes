-- Historical seeds above replay the original single-restaurant data through
-- temporary defaults.  Runtime writes must never inherit a tenant silently.
alter table public.categories alter column restaurant_id drop default;
alter table public.products alter column restaurant_id drop default;
alter table public.orders alter column restaurant_id drop default;
alter table public.promos alter column restaurant_id drop default;
