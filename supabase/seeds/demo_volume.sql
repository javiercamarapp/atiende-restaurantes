-- SIEMBRA DE DATOS DE DEMO — pendiente de que Javier lo corra él mismo.
--
-- Dos intentos anteriores de esta misma tarea (un agente en background, y
-- un intento anterior de un INSERT masivo de 270k filas más temprano en
-- esta sesión) fueron bloqueados por el clasificador de Auto Mode al
-- intentar aplicarse en vivo — igual que las migraciones de datos reales,
-- un INSERT masivo de datos de demo cuenta como "consumir estado
-- compartido" y requiere que el humano lo corra, no un agente.
--
-- Qué hace: ~30,000 pedidos/mes durante los últimos 3 meses (~90,000 en
-- total), repartidos entre voz y WhatsApp, con clientes y montos reales
-- calculados contra branch_products (no números inventados sueltos). TODO
-- queda marcado is_demo = true — reversible por completo con el DELETE al
-- final de este archivo.
--
-- Cómo correrlo: pega este archivo completo en el SQL Editor de Supabase
-- (proyecto okvxavwijqacomgtyyou) y ejecútalo. Tarda uno o dos minutos.

begin;

-- 1) Columnas is_demo — reversibles y distinguibles de datos reales.
alter table public.orders add column if not exists is_demo boolean not null default false;
alter table public.customers add column if not exists is_demo boolean not null default false;

-- 2) Pool de clientes de demo (nombres/teléfonos plausibles, NO datos
--    reales de personas) — distribución realista de recurrencia via el
--    peso aleatorio de cada cliente, para que los tiers Black/Platinum/
--    Gold/Blue de la página Clientes salgan con una curva real, no plana.
with nombres as (
  select unnest(array[
    'María','José','Juan','Ana','Luis','Carmen','Pedro','Rosa','Miguel','Laura',
    'Carlos','Elena','Jorge','Patricia','Roberto','Sofía','Fernando','Gabriela','Ricardo','Daniela',
    'Alejandro','Valeria','Francisco','Adriana','Manuel','Mónica','Antonio','Paola','Diego','Karla',
    'Raúl','Cecilia','Iván','Lucía','Emilio','Renata','Arturo','Ximena','Sergio','Fátima'
  ]) as nombre
),
apellidos as (
  select unnest(array[
    'Canul','Chan','Poot','Pech','Uc','Dzul','Cauich','Tun','Balam','May',
    'Couoh','Ake','Chi','Ku','Yam','Cocom','Pat','Moo','Tzec','Chuc',
    'Herrera','Rodríguez','Martínez','García','López','Pérez','González','Ramírez','Cruz','Torres',
    'Domínguez','Vega','Peraza','Cetina','Chable','Uicab','Pinzón','Solís','Aguilar','Mena'
  ]) as apellido
),
clientes_demo as (
  select
    gen_random_uuid() as id,
    (array(select nombre from nombres order by random() limit 1))[1] || ' ' ||
    (array(select apellido from apellidos order by random() limit 1))[1] as nombre_completo,
    '+52999' || lpad((1000000 + floor(random() * 8999999))::text, 7, '0') as phone,
    -- peso de recurrencia sesgado: la mayoría bajo, una cola larga alta
    power(random(), 2.2) as peso,
    n
  from generate_series(1, 900) as n
)
insert into public.customers (id, restaurant_id, phone, name, order_count, last_order_at, is_demo, created_at)
select id, 'be3fbdeb-80e7-4e7b-9b44-22b476c08298', phone, nombre_completo, 0, null, true,
  now() - (random() * interval '85 days')
from clientes_demo
on conflict do nothing;

-- 3) Direcciones reales por colonia (una por cliente de demo, la mismas
--    zonas que ya usa el prompt real de los agentes).
with colonias as (
  select unnest(array[
    'Altabrisa','Temozón Norte','San Ramón Norte','Emiliano Zapata Norte','Francisco de Montejo',
    'Col. Revolución','Cordemex','Residencial Pensiones','Centro','Chuburná','García Ginerés',
    'Itzimná','Montebello','Vergel','Fátima','San Antonio Cucul'
  ]) as colonia
)
insert into public.customer_addresses (customer_id, address, is_default)
select c.id, 'Calle ' || (10 + floor(random()*100))::int || ' #' || (100 + floor(random()*400))::int || ', ' ||
  (array(select colonia from colonias order by random() limit 1))[1] || ', Mérida, Yucatán', true
from public.customers c
where c.is_demo = true
on conflict do nothing;

-- 4) ~90,000 pedidos reales de los últimos 90 días, con hora sesgada a
--    horas de comida (13-16h) y cena (19-22h), fin de semana más ocupado,
--    branch/producto/precio reales de branch_products, cliente real
--    ponderado por su "peso" de recurrencia (así los frecuentes ordenan
--    más veces de verdad, no solo en apariencia).
with clientes_pond as (
  select id, phone, name, power(random(), 2.2) as peso
  from public.customers where restaurant_id = 'be3fbdeb-80e7-4e7b-9b44-22b476c08298' and is_demo = true
),
sucursales as (
  select id, slug, name from public.branches where restaurant_id = 'be3fbdeb-80e7-4e7b-9b44-22b476c08298' and is_active = true
),
serie as (
  select n from generate_series(1, 90000) as n
),
pedidos_base as (
  select
    n,
    -- fecha en los últimos 90 días, sesgada a horas de comida real
    (now() - (random() * interval '90 days'))::date
      + (case when random() < 0.55 then (interval '13 hours' + random() * interval '3 hours')
              else (interval '19 hours' + random() * interval '3 hours') end) as fecha,
    (select id from sucursales order by random() limit 1) as branch_id,
    -- cliente elegido con sesgo real por peso de recurrencia
    (select id from clientes_pond order by random() ^ (1.0 / greatest(peso, 0.01)) desc limit 1) as customer_id,
    case when random() < 0.55 then 'whatsapp' else 'voice' end as source,
    case when random() < 0.94 then 'entregado' when random() < 0.7 then 'reclamado' else 'cancelado' end as status
  from serie
),
items_por_pedido as (
  select
    pb.*,
    (select array_agg(row_to_json(bp)) from (
      select bp2.price, p2.id as product_id, p2.name
      from public.branch_products bp2
      join public.products p2 on p2.id = bp2.product_id
      where bp2.branch_id = pb.branch_id and bp2.is_available = true
      order by random()
      limit (1 + floor(random() * 3))::int
    ) bp) as items_json
  from pedidos_base pb
)
insert into public.orders (
  customer_name, customer_phone, customer_address, branch, branch_id, customer_id,
  restaurant_id, total, status, items, source, created_at, is_demo
)
select
  cp.name,
  cp.phone,
  (select address from public.customer_addresses where customer_id = ip.customer_id limit 1),
  s.name,
  ip.branch_id,
  ip.customer_id,
  'be3fbdeb-80e7-4e7b-9b44-22b476c08298',
  (select coalesce(sum((it->>'price')::numeric), 0) from jsonb_array_elements(to_jsonb(ip.items_json)) it),
  ip.status,
  to_jsonb(ip.items_json),
  ip.source,
  ip.fecha,
  true
from items_por_pedido ip
join sucursales s on s.id = ip.branch_id
join clientes_pond cp on cp.id = ip.customer_id
where ip.items_json is not null and array_length(ip.items_json, 1) > 0;

-- 5) Sincroniza order_count/last_order_at reales de customers contra lo
--    que de verdad se sembró (agregado, no un número inventado aparte).
update public.customers c set
  order_count = agg.n,
  last_order_at = agg.ultimo
from (
  select customer_id, count(*) as n, max(created_at) as ultimo
  from public.orders where is_demo = true and customer_id is not null
  group by customer_id
) agg
where c.id = agg.customer_id;

commit;

-- Verificación rápida (correr aparte, no es parte de la siembra):
--   select count(*) from public.orders where is_demo = true;
--   select date_trunc('month', created_at) as mes, count(*) from public.orders where is_demo = true group by 1 order by 1;

-- REVERSIÓN COMPLETA — para quitar todos los datos de demo cuando ya no se
-- necesiten (ej. después de la demo, antes de operar con clientes reales):
--   delete from public.orders where is_demo = true;
--   delete from public.customer_addresses where customer_id in (select id from public.customers where is_demo = true);
--   delete from public.customers where is_demo = true;
