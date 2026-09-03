-- Tier real de cliente (BLACK/PLATINUM/GOLD/BLUE) por percentil, calculado
-- server-side contra TODA la distribución real de clientes del restaurante
-- vía percent_rank() en SQL (percentiles empatados promediados, mismo
-- método "mid-rank" que calcularPercentiles() en
-- src/components/admin/ClientesSection.tsx) — así lookupCustomer() en
-- supabase/functions/_shared/create-order-core.ts NO tiene que traerse a
-- JS la lista completa de clientes del restaurante solo para calcular el
-- percentil de uno.
--
-- Misma lógica de selección de métrica que ClientesSection.tsx:
--   - gasto real (suma de orders.total por customer_id) si al menos el 30%
--     de los clientes (mínimo 1) tiene gasto > 0;
--   - si no, order_count (que siempre se mantiene, ver upsertCustomer);
--   - si tampoco hay eso, no hay señal real -> tier NULL para todos (no se
--     inventan tiers, mismo criterio que la sección de Clientes).
--
-- Mismos cortes de percentil que CORTE_PERCENTIL_* en ClientesSection.tsx:
-- >=90 BLACK, >=75 PLATINUM, >=35 GOLD, si no BLUE.
create or replace function public.calc_customer_tier(p_restaurant_id uuid, p_customer_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with clientes as (
    select
      c.id,
      c.order_count,
      coalesce(g.gasto, 0) as gasto
    from public.customers c
    left join (
      select customer_id, sum(total) as gasto
      from public.orders
      where restaurant_id = p_restaurant_id and customer_id is not null
      group by customer_id
    ) g on g.customer_id = c.id
    where c.restaurant_id = p_restaurant_id
  ),
  meta as (
    select
      count(*) as n,
      count(*) filter (where gasto > 0) as con_gasto,
      count(*) filter (where order_count > 0) as con_frecuencia
    from clientes
  ),
  metrica as (
    select case
      when (select n from meta) = 0 then 'sin_datos'
      when (select con_gasto from meta) >= greatest(1, ceil((select n from meta)::numeric * 0.3)) then 'gasto'
      when (select con_frecuencia from meta) > 0 then 'frecuencia'
      else 'sin_datos'
    end as elegida
  ),
  valores as (
    select
      id,
      case (select elegida from metrica)
        when 'gasto' then gasto
        when 'frecuencia' then order_count::numeric
        else 0::numeric
      end as valor
    from clientes
  ),
  ranked as (
    select
      id,
      (rank() over (order by valor asc) - 1) as rank_min,
      count(*) over (partition by valor) as tie_count,
      count(*) over () as n
    from valores
  ),
  percentiles as (
    select
      id,
      case
        when n = 1 then 100::numeric
        else (((rank_min::numeric + rank_min + tie_count - 1) / 2.0) / (n - 1)) * 100
      end as percentil
    from ranked
  )
  select case
    when (select elegida from metrica) = 'sin_datos' then jsonb_build_object('tier', null, 'percentile', null)
    else coalesce(
      (
        select jsonb_build_object(
          'tier', case
            when p.percentil >= 90 then 'BLACK'
            when p.percentil >= 75 then 'PLATINUM'
            when p.percentil >= 35 then 'GOLD'
            else 'BLUE'
          end,
          'percentile', round(p.percentil, 2)
        )
        from percentiles p
        where p.id = p_customer_id
      ),
      jsonb_build_object('tier', null, 'percentile', null)
    )
  end;
$$;

comment on function public.calc_customer_tier(uuid, uuid) is
  'Tier (BLACK/PLATINUM/GOLD/BLUE o null) de un cliente por percentil real contra la distribución de todos los clientes del restaurante. Usado por lookupCustomer() en _shared/create-order-core.ts. Misma lógica de cortes y selección de métrica que ClientesSection.tsx.';

grant execute on function public.calc_customer_tier(uuid, uuid) to authenticated, service_role;
