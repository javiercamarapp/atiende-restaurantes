-- Precios y disponibilidad REALES por sucursal — hasta ahora el catálogo de
-- `products` era una sola lista compartida por las 7 sucursales, pero el
-- menú fotografiado real de cada una (transcrito directamente de fotos en
-- alta resolución del menú impreso, nunca inventado) demuestra que sí varían
-- de verdad: Pensiones tiene precios más bajos en casi todo, Galerías no
-- vende alcohol ni postres, Chicxulub tiene un precio distinto en el agua
-- mineral, etc.
--
-- Base real verificada: Fco. de Montejo, Chicxulub y Plaza Galerías
-- comparten EXACTAMENTE la misma lista de precios en cada categoría que se
-- pudo comparar (se verificó producto por producto contra la tabla
-- `products` actual) — así que esa lista sirve de línea base real para las
-- 5 sucursales que comparten el mismo menú estándar (Fco. de Montejo,
-- Chicxulub, Galerías, Altabrisa, Prol. Montejo, García Lavín), y encima se
-- aplican solo las diferencias CONFIRMADAS por foto real. Pensiones tiene su
-- propia lista completa, también real.

create table if not exists public.branch_products (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  price numeric not null,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, product_id)
);
alter table public.branch_products enable row level security;
create policy "Anyone can view branch products"
  on public.branch_products for select
  using (true);
create policy "Service role can manage branch products"
  on public.branch_products for all
  using (true)
  with check (true);

-- 1) Línea base: todas las sucursales heredan el precio/disponibilidad
--    actual de `products` (que es, verificado, el menú real compartido).
insert into public.branch_products (branch_id, product_id, price, is_available)
select b.id, p.id, p.price, p.is_available
from public.branches b
cross join public.products p
where p.restaurant_id = b.restaurant_id
on conflict (branch_id, product_id) do nothing;

-- 2) Nuevos productos reales que NO estaban en el catálogo maestro,
--    confirmados por foto real del menú de cada sucursal.
insert into public.products (restaurant_id, category_id, name, price, is_available, display_order)
select restaurant_id, category_id, 'Ensalada de PM', 206, true, 999
from public.products
where restaurant_id = 'be3fbdeb-80e7-4e7b-9b44-22b476c08298'
  and category_id = (select category_id from public.products where name = 'Guacamole' limit 1)
limit 1;

insert into public.categories (restaurant_id, name, slug, display_order)
select 'be3fbdeb-80e7-4e7b-9b44-22b476c08298', 'Comida Regional', 'comida-regional', 999
where not exists (select 1 from public.categories where restaurant_id = 'be3fbdeb-80e7-4e7b-9b44-22b476c08298' and slug = 'comida-regional');

insert into public.products (restaurant_id, category_id, name, price, is_available, display_order)
select 'be3fbdeb-80e7-4e7b-9b44-22b476c08298', c.id, v.name, v.price, true, v.ord
from public.categories c
cross join (values
  ('Sopa de Lima', 170, 1),
  ('Papadzules (orden de 5)', 194, 2),
  ('Platillo de Cochinita', 283, 3),
  ('Tacos de Cochinita (orden de 4)', 179, 4),
  ('Francés de Cochinita', 224, 5)
) as v(name, price, ord)
where c.restaurant_id = 'be3fbdeb-80e7-4e7b-9b44-22b476c08298' and c.slug = 'comida-regional';

-- Le da a las 7 sucursales una fila de line-base para los productos nuevos
-- (Ensalada de PM, Comida Regional) recién creados en el paso anterior.
insert into public.branch_products (branch_id, product_id, price, is_available)
select b.id, p.id, p.price, p.is_available
from public.branches b
cross join public.products p
where p.restaurant_id = b.restaurant_id
on conflict (branch_id, product_id) do nothing;

-- 3) Diferencias CONFIRMADAS por foto real, sucursal por sucursal.

-- Chicxulub: agua mineral cristal a $50 (no $53), confirmado en la foto.
update public.branch_products bp
set price = 50, updated_at = now()
from public.branches b, public.products p
where bp.branch_id = b.id and bp.product_id = p.id
  and b.slug = 'chicxulub' and p.name = 'Agua Mineral Cristal';

-- Chicxulub y Galerías: la foto solo muestra el precio del kilo completo, no
-- el desglose en fracciones (250g/500g/750g) — no confirmado, se marca no
-- disponible en vez de asumir que existe igual que en Fco. de Montejo.
update public.branch_products bp
set is_available = false, updated_at = now()
from public.branches b, public.products p
where bp.branch_id = b.id and bp.product_id = p.id
  and b.slug in ('chicxulub', 'galerias')
  and (p.name like '%— 250 g' or p.name like '%— 500 g' or p.name like '%— 750 g');

-- Ensalada de PM: confirmada por foto solo en Chicxulub y en el grupo
-- Altabrisa/Prol. Montejo/García Lavín — no confirmada en Fco. de Montejo,
-- Galerías ni Pensiones.
update public.branch_products bp
set is_available = false, updated_at = now()
from public.branches b, public.products p
where bp.branch_id = b.id and bp.product_id = p.id
  and b.slug in ('fco-montejo', 'galerias', 'pensiones')
  and p.name = 'Ensalada de PM';

-- Comida Regional (cochinita pibil): confirmada por foto SOLO en Galerías.
-- Fco. de Montejo confirma explícitamente que NO la tiene; las demás no
-- están confirmadas todavía.
update public.branch_products bp
set is_available = false, updated_at = now()
from public.branches b, public.products p, public.categories c
where bp.branch_id = b.id and bp.product_id = p.id and p.category_id = c.id
  and c.slug = 'comida-regional'
  and b.slug != 'galerias';

-- Galerías: sin Cervezas, sin Licores y Cocktails, sin Postres, y sin varios
-- refrescos (Limonada/Naranjada/Suero/Toronja Cristal) — ninguna de las 9
-- fotos del menú de esta sucursal los muestra (posible food court sin
-- alcohol). Alitas de Pollo aparece en foto pero SIN precio impreso.
update public.branch_products bp
set is_available = false, updated_at = now()
from public.branches b, public.products p, public.categories c
where bp.branch_id = b.id and bp.product_id = p.id and p.category_id = c.id
  and b.slug = 'galerias'
  and (
    c.name in ('Cervezas', 'Licores y Cocktails', 'Postres')
    or p.name in ('Limonada', 'Limonada con Soda', 'Limonada con Topo Chico', 'Naranjada', 'Naranjada con Soda', 'Naranjada con Topo Chico', 'Suero con Soda', 'Suero con Topo Chico', 'Toronja Cristal', 'Alitas de Pollo')
  );

-- Pensiones: lista de precios propia, confirmada completa por foto real
-- (8/8 páginas) — sistemáticamente más baja que el resto de sucursales.
update public.branch_products bp
set price = v.price, updated_at = now()
from public.branches b, public.products p, (values
  ('Frijol con Tostada', 83), ('Guacamole', 127), ('Carbolla', 90), ('Cebollas Cambray', 114),
  ('Chicharrón de Queso', 146), ('Alitas de Pollo', 177), ('Papas a la Francesa', 101),
  ('Frijoles Charros Normal', 114), ('Frijoles Charros Normal (1/2 orden)', 76),
  ('Frijoles Charros con Queso', 127), ('Frijoles Charros con Queso (1/2 orden)', 95),
  ('Frijoles Charros Especiales', 159), ('Frijoles Charros Especiales (1/2 orden)', 121),
  ('Quesadilla de Natural', 95), ('Quesadilla de Rajas', 108), ('Quesadilla de Champiñones', 108), ('Quesadilla de Chorizo', 114),
  ('Queso Fundido Natural', 139), ('Queso Fundido Rajas', 152), ('Queso Fundido Champiñones', 152), ('Queso Fundido Tocino', 152), ('Queso Fundido Chorizo', 152),
  ('Nachos de Pastor', 278), ('Nachos de Pastor (1/2 orden)', 202), ('Nachos de Champiñón', 278), ('Nachos de Champiñón (1/2 orden)', 202),
  ('Nachos de Bistec', 316), ('Nachos de Bistec (1/2 orden)', 222), ('Nachos de Pechuga', 316), ('Nachos de Pechuga (1/2 orden)', 222),
  ('Nachos de Chuleta', 311), ('Nachos de Chuleta (1/2 orden)', 222), ('Nachos de Costilla', 311), ('Nachos de Costilla (1/2 orden)', 222),
  ('Nachos de Arrachera', 367), ('Nachos de Arrachera (1/2 orden)', 253),
  ('Taco Al Pastor (individual)', 36), ('Taco de Rajas (individual)', 32), ('Taco de Champiñones (individual)', 32),
  ('Tacos de Chorizo (orden de 3)', 127), ('Tacos de Bistec de Res (orden de 3)', 164), ('Tacos de Pechuga de Pollo (orden de 3)', 164),
  ('Tacos de Chuleta de Cerdo (orden de 3)', 164), ('Tacos de Costilla de Res (orden de 3)', 164), ('Tacos de Arrachera (orden de 3)', 215),
  ('Tacos de Poc-Chuc (orden de 3)', 164), ('Tacos de Bistec Encebollado (orden de 3)', 171),
  ('Gringa de Pastor', 164), ('Gringa de Bistec', 190), ('Gringa de Pechuga de Pollo', 184), ('Gringa de Chuleta', 184),
  ('Gringa de Costilla', 184), ('Gringa de Arrachera', 253), ('Gringa de Poc-Chuc', 184),
  ('Mestiza de Pastor', 146), ('Mestiza de Poc-Chuc', 152), ('Mestiza de Bistec', 164), ('Mestiza de Pechuga', 164),
  ('Mestiza de Chuleta', 164), ('Mestiza de Costilla', 164), ('Mestiza de Arrachera', 228),
  ('Alambre de Pastor', 240), ('Alambre de Bistec', 240), ('Alambre de Pechuga', 240), ('Alambre de Chuleta', 240),
  ('Alambre de Costilla', 240), ('Alambre de Arrachera', 298),
  ('Suizo de Pastor', 209), ('Suizo de Bistec', 247), ('Suizo de Chuleta', 247), ('Suizo de Pechuga', 247),
  ('Suizo de Costilla', 247), ('Suizo de Arrachera', 316), ('Suizo de Poc-Chuc', 247), ('Suizo de Chorizo', 177), ('Suizo de Chile Poblano', 177),
  ('Alambre Suizo de Pastor', 266), ('Alambre Suizo de Bistec', 266), ('Alambre Suizo de Pechuga', 266), ('Alambre Suizo de Chuleta', 266),
  ('Alambre Suizo de Costilla', 266), ('Alambre Suizo de Arrachera', 323),
  ('Tacos Suizos de Chile Poblano y Bistec', 278), ('Tacos Suizos de Chile Poblano y Arrachera', 329),
  ('Boyo-Hamburguesa Sencilla', 164), ('Boyo-Hamburguesa con Queso', 190), ('Boyo-Hamburguesa con Queso y Tocino', 202),
  ('Chetaco de Pastor', 253), ('Chetaco de Champiñón', 266), ('Chetaco de Bistec de Res', 266), ('Chetaco de Chuleta de Cerdo', 266),
  ('Chetaco de Pechuga', 266), ('Chetaco de Costilla de Res', 266), ('Chetaco de Poc-Chuc', 266), ('Chetaco de Arrachera', 316),
  ('Papa Tradicional', 177), ('Papa Pastor', 228), ('Papa Bistec', 240), ('Papa Chuleta', 240), ('Papa Pechuga', 240), ('Papa Costilla', 240), ('Papa Arrachera', 298),
  ('Francés Suizo de Pastor', 228), ('Francés Suizo de Champiñón', 228), ('Francés Suizo de Bistec de Res', 240),
  ('Francés Suizo de Chuleta de Cerdo', 240), ('Francés Suizo de Pechuga', 240), ('Francés Suizo de Costilla de Res', 240),
  ('Francés Suizo de Poc-Chuc', 240), ('Francés Suizo de Arrachera', 298),
  ('Crujientes de Pechuga de Pollo', 304), ('Platillo de Pastor', 291), ('Platillo de Bistec', 342), ('Platillo de Pechuga de Pollo', 329),
  ('Platillo de Chuleta de Cerdo', 329), ('Platillo de Costilla de Res', 329), ('Platillo de Arrachera', 417), ('Platillo de Poc-Chuc', 329),
  ('Fajitas de Bistec', 342), ('Fajitas de Pechuga', 342), ('Fajitas de Arrachera', 417), ('Parrillada para 2', 519), ('Parrillada para 4', 886),
  ('Crema Española', 70), ('Crema de Coco', 70), ('Flan', 70), ('Queso Napolitano', 95),
  ('Coca-Cola', 45), ('Coca-Cola Light', 45), ('Coca-Cola sin Azúcar', 45), ('Toronja Cristal', 45), ('Fanta', 45), ('Sidral Mundet', 45),
  ('Sprite', 45), ('Sprite Cero', 45), ('Agua Mineral Cristal', 45), ('Agua Purificada', 45), ('Topo Chico', 63),
  ('Limonada', 51), ('Limonada con Soda', 62), ('Limonada con Topo Chico', 83), ('Naranjada', 51), ('Naranjada con Soda', 62),
  ('Naranjada con Topo Chico', 83), ('Suero con Soda', 62), ('Suero con Topo Chico', 83),
  ('Agua de Jamaica', 51), ('Horchata', 51), ('Té', 51),
  ('Sol', 66), ('Superior', 66), ('Tecate Light', 66), ('Heineken', 76), ('Indio', 66), ('XX Lager', 67), ('XX Ámbar', 67),
  ('Amstel Ultra', 76), ('Bohemia Clara', 76), ('Bohemia Oscura', 76), ('Ceiba Dorada Premium', 101), ('Ceiba Light Lager', 101),
  ('Ceiba Mestiza', 101), ('Ceiba Stout', 101), ('Patito Oscura', 101), ('Patito Lager', 101), ('Ojo Rojo', 38), ('Vaso de Chelada', 20), ('Vaso de Michelada', 25),
  ('Vino Tinto Selección (copa)', 89),
  ('Ron Appleton Especial', 108), ('Ron Bacardí Añejo', 101), ('Ron Bacardí Blanco', 95), ('Ron Bacardí Solera', 114),
  ('Tequila Don Julio Reposado', 146), ('Tequila Herradura Reposado', 121), ('Tequila Jimador', 95), ('Tequila Tradicional', 101),
  ('Vodka Absolut', 114), ('Vodka Smirnoff', 101), ('Whisky Buchanan''s', 159), ('Whisky Chivas Regal', 139), ('Whisky J.W. Etiqueta Negra', 139),
  ('Caribe Cooler', 97), ('Conga', 97), ('Conga sin Alcohol', 89), ('Daiquiri', 97), ('Daiquiri sin Alcohol', 89),
  ('Limonada Eléctrica', 97), ('Margarita', 97), ('Margarita sin Alcohol', 89), ('Piñada', 89), ('Piña Colada', 97),
  ('Sangría', 97), ('Sangría sin Alcohol', 89),
  ('Pastor — 1 kg', 750), ('Bistec de Res — 1 kg', 950), ('Bistec de Res Encebollado — 1 kg', 950), ('Chuleta de Cerdo — 1 kg', 800),
  ('Pechuga de Pollo — 1 kg', 800), ('Poc-Chuc — 1 kg', 800), ('Arrachera — 1 kg', 1200), ('Costilla de Res — 1 kg', 800),
  ('Extra Champiñón', 32), ('Extra Chile Poblano', 32), ('Extra Chorizo', 32), ('Extra Guacamole', 45),
  ('Extra Rajas', 32), ('Extra Tocino', 32), ('Orden Tortilla de Harina', 20), ('Orden Tortilla de Maíz', 20), ('Extra Queso', 45)
) as v(name, price)
where bp.branch_id = b.id and bp.product_id = p.id and b.slug = 'pensiones' and p.name = v.name;

-- Pensiones: sin Pizza Quesobich (no aparece en las 8 fotos) y sin
-- desglose de kilos por fracción (solo se confirmó el kilo completo).
update public.branch_products bp
set is_available = false, updated_at = now()
from public.branches b, public.products p, public.categories c
where bp.branch_id = b.id and bp.product_id = p.id and p.category_id = c.id
  and b.slug = 'pensiones'
  and (c.name = 'Pizza Quesobich' or p.name like '%— 250 g' or p.name like '%— 500 g' or p.name like '%— 750 g');
