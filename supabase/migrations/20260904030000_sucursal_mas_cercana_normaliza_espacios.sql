-- Bug real confirmado 4-sep-2026 (llamada real): "Alta Brisa" (como lo dice
-- cualquier cliente real, dos palabras) nunca encontraba la colonia real
-- "altabrisa" (sembrada sin espacio en merida_colonias) porque el matching
-- anterior era un ILIKE de substring literal — un espacio de más/de menos
-- rompe el substring aunque el texto sea "el mismo" para un humano. El
-- cliente insistió 4 veces con variantes reales (Alta Brisa, Casa Altabrisa,
-- Plaza Alta Brisa) y ninguna hizo match, pese a que altabrisa SÍ es una
-- sucursal/colonia real y activa. Fix: normaliza quitando todo lo que no sea
-- letra/número (espacios, guiones, puntuación) de AMBOS lados antes de
-- comparar — "alta brisa" y "altabrisa" se vuelven el mismo string
-- "altabrisa" normalizado. Protege contra cualquier otra colonia compuesta
-- con el mismo problema, no solo esta.
create or replace function public.sucursal_mas_cercana(p_restaurant_id uuid, p_colonia text)
 returns table(branch_slug text, branch_name text, distancia_km numeric, colonia_encontrada text)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_colonia_lat numeric;
  v_colonia_lng numeric;
  v_colonia_nombre text;
  v_colonia_norm text := regexp_replace(unaccent(lower(p_colonia)), '[^a-z0-9]', '', 'g');
begin
  select nombre, lat, lng into v_colonia_nombre, v_colonia_lat, v_colonia_lng
  from merida_colonias
  where v_colonia_norm ilike '%' || regexp_replace(unaccent(lower(nombre)), '[^a-z0-9]', '', 'g') || '%'
     or regexp_replace(unaccent(lower(nombre)), '[^a-z0-9]', '', 'g') ilike '%' || v_colonia_norm || '%'
  order by length(nombre) desc
  limit 1;

  if v_colonia_lat is null then
    return;
  end if;

  return query
  select
    b.slug,
    b.name,
    round((
      6371 * acos(
        least(1, greatest(-1,
          cos(radians(v_colonia_lat)) * cos(radians(b.lat)) * cos(radians(b.lng) - radians(v_colonia_lng))
          + sin(radians(v_colonia_lat)) * sin(radians(b.lat))
        ))
      )
    )::numeric, 1) as distancia_km,
    v_colonia_nombre
  from branches b
  where b.restaurant_id = p_restaurant_id
    and b.is_active
    and b.lat is not null and b.lng is not null
  order by distancia_km asc
  limit 1;
end;
$function$;
