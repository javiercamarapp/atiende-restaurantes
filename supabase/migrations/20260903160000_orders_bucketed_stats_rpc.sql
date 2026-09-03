-- Estadísticas/Tendencias del panel admin traían TODOS los pedidos de la
-- ventana elegida al navegador (orders?...&limit=50000) para sumarlos ahí.
-- Con volumen real (~90,000 pedidos de demo) eso chocaba con el límite de
-- filas por respuesta de la API de datos de Supabase (el proyecto lo trae
-- en 1000 — confirmado en vivo: un `limit=9999` real devolvió
-- content-range 0-999/1757), así que `.limit(50000)` en el cliente nunca
-- tuvo efecto real: cualquier ventana con más de 1000 pedidos (bastan ~1
-- día de volumen de demo) llegaba truncada a los 1000 más recientes. Para
-- casi cualquier bucket de la gráfica semanal/mensual eso significaba CERO
-- pedidos — no porque no existieran, sino porque nunca cruzaron el límite
-- de la API — y por eso "Tendencias" se veía en $0/0 en casi todos los
-- puntos con datos reales de por medio.
--
-- La corrección real no es subir el límite del cliente (nunca iba a
-- importar) sino dejar de bajar cada fila: se suma/cuenta en Postgres por
-- tramo de fecha y solo se manda de vuelta un renglón agregado por tramo
-- (13 filas para 90 días, 30 para 30 días, etc.) — muy por debajo del
-- límite de 1000 sin importar cuántos pedidos reales haya.
create or replace function public.orders_bucketed_stats(
  p_restaurant_id uuid,
  p_bucket_starts timestamptz[],
  p_bucket_ends timestamptz[]
)
returns table(idx int, revenue numeric, order_count bigint, customer_count bigint)
language sql
stable
security invoker
set search_path to 'public'
as $$
  select
    b.idx,
    coalesce(sum(o.total), 0) as revenue,
    count(o.id) as order_count,
    count(distinct o.customer_name) as customer_count
  from unnest(p_bucket_starts, p_bucket_ends) with ordinality as b(bucket_start, bucket_end, idx)
  left join public.orders o
    on (p_restaurant_id is null or o.restaurant_id = p_restaurant_id)
    and o.customer_phone not ilike 'widget-%'
    and o.created_at >= b.bucket_start
    and o.created_at < b.bucket_end
  group by b.idx
  order by b.idx;
$$;

comment on function public.orders_bucketed_stats is
  'Suma/cuenta orders por tramo de fecha en Postgres (para Estadísticas y '
  'Tendencias del panel admin) — reemplaza traer cada pedido al navegador, '
  'que con volumen real de demo se topaba en silencio con el límite de '
  '1000 filas por respuesta de la API de datos. SECURITY INVOKER a '
  'propósito: corre con los mismos permisos/RLS del usuario que llama '
  '(igual que el SELECT directo a orders que reemplaza), no eleva '
  'privilegios.';

-- Mismo rol que ya podía leer `orders` directamente (RLS de la tabla:
-- "Admins can view all orders" / "Repartidores can view all orders", ambas
-- para `authenticated`) — esta función no abre nada nuevo, solo agrega en
-- el servidor lo que antes se agregaba en el navegador.
grant execute on function public.orders_bucketed_stats(uuid, timestamptz[], timestamptz[]) to authenticated;
