alter table public.products
  add column if not exists search_keywords text[] not null default '{}';

comment on column public.products.search_keywords is
  'Sinónimos/alias reales en español coloquial que un cliente de Mérida podría usar para pedir este producto (ej. "pizza" para Quesobich de Queso, "chela"/"cheve" para cerveza, "pastor" para Taco Al Pastor). buscar_producto (voz y WhatsApp) matchea tokens de búsqueda contra name, description Y search_keywords — antes solo comparaba contra name, lo que causaba falsos "no disponible" para sinónimos reales (bug real confirmado 4-sep-2026: "una pizza" no encontraba "Quesobich de Queso" pese a estar disponible).';
