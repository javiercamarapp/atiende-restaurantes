-- SuperAdmin: agregados y listados acotados.  Estas funciones son la única
-- superficie de lectura global; nunca se exponen filas completas de orders.
create or replace function public.superadmin_platform_stats()
returns table(
  restaurant_count bigint,
  active_restaurant_count bigint,
  customer_count bigint,
  orders_today bigint,
  revenue_today numeric
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_superadmin(auth.uid()) then
    raise exception 'superadmin authorization required' using errcode = '42501';
  end if;
  return query
    select count(*)::bigint, count(*) filter (where is_active)::bigint,
      (select count(*)::bigint from public.customers),
      (select count(*)::bigint from public.orders where created_at >= current_date),
      (select coalesce(sum(total), 0) from public.orders where created_at >= current_date);
end;
$$;

create or replace function public.superadmin_restaurants_page(
  p_page_size integer default 50, p_page integer default 0
)
returns table(id uuid, name text, slug text, is_active boolean, order_count bigint,
  pending_order_count bigint, customer_count bigint, revenue numeric)
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_superadmin(auth.uid()) then
    raise exception 'superadmin authorization required' using errcode = '42501';
  end if;
  if p_page_size < 1 or p_page_size > 100 or p_page < 0 then
    raise exception 'invalid page';
  end if;
  return query
    select r.id, r.name, r.slug, r.is_active,
      (select count(*) from public.orders o where o.restaurant_id = r.id)::bigint,
      (select count(*) from public.orders o where o.restaurant_id = r.id and o.status in ('pending','preparando'))::bigint,
      (select count(*) from public.customers c where c.restaurant_id = r.id)::bigint,
      (select coalesce(sum(o.total), 0) from public.orders o where o.restaurant_id = r.id)
    from public.restaurants r
    order by r.created_at, r.id
    limit p_page_size offset (p_page * p_page_size);
end;
$$;

create or replace function public.superadmin_customers_page(
  p_search text default null, p_page_size integer default 50, p_page integer default 0
)
returns table(restaurant_id uuid, name text, phone text, order_count integer, last_order_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_superadmin(auth.uid()) then
    raise exception 'superadmin authorization required' using errcode = '42501';
  end if;
  if p_page_size < 1 or p_page_size > 100 or p_page < 0 then
    raise exception 'invalid page';
  end if;
  return query
    select c.restaurant_id, c.name, c.phone, c.order_count, c.last_order_at
    from public.customers c
    where nullif(trim(p_search), '') is null
      or c.name ilike '%' || trim(p_search) || '%'
      or c.phone ilike '%' || trim(p_search) || '%'
    order by c.last_order_at desc nulls last, c.restaurant_id, c.phone
    limit p_page_size offset (p_page * p_page_size);
end;
$$;

create or replace function public.superadmin_orders_page(
  p_status text default null, p_since timestamptz default null,
  p_search text default null, p_page_size integer default 50, p_page integer default 0
)
returns table(restaurant_id uuid, total numeric, status text, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_superadmin(auth.uid()) then
    raise exception 'superadmin authorization required' using errcode = '42501';
  end if;
  if p_page_size < 1 or p_page_size > 100 or p_page < 0 then
    raise exception 'invalid page';
  end if;
  return query
    select o.restaurant_id, o.total, o.status, o.created_at
    from public.orders o
    where (p_status is null or (p_status = 'pending' and o.status in ('pending','preparando')) or o.status = p_status)
      and (p_since is null or o.created_at >= p_since)
      and (nullif(trim(p_search), '') is null or o.customer_name ilike '%' || trim(p_search) || '%'
        or o.customer_phone ilike '%' || trim(p_search) || '%')
    order by o.created_at desc, o.id desc
    limit p_page_size offset (p_page * p_page_size);
end;
$$;

revoke all on function public.superadmin_platform_stats() from public, anon;
revoke all on function public.superadmin_restaurants_page(integer, integer) from public, anon;
revoke all on function public.superadmin_customers_page(text, integer, integer) from public, anon;
revoke all on function public.superadmin_orders_page(text, timestamptz, text, integer, integer) from public, anon;
grant execute on function public.superadmin_platform_stats() to authenticated;
grant execute on function public.superadmin_restaurants_page(integer, integer) to authenticated;
grant execute on function public.superadmin_customers_page(text, integer, integer) to authenticated;
grant execute on function public.superadmin_orders_page(text, timestamptz, text, integer, integer) to authenticated;
