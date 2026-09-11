begin;
insert into auth.users(id,aud,role,email,encrypted_password) values
 ('68000000-0000-0000-0000-000000000001','authenticated','authenticated','denied-staff@test.invalid',''),
 ('68000000-0000-0000-0000-000000000002','authenticated','authenticated','denied-outsider@test.invalid',''),
 ('68000000-0000-0000-0000-000000000003','authenticated','authenticated','denied-superadmin@test.invalid','');
insert into public.restaurants(id,name,slug)
 values ('68100000-0000-0000-0000-000000000001','Denial tenant','denial-tenant');
insert into public.restaurant_staff(restaurant_id,user_id,role)
 values ('68100000-0000-0000-0000-000000000001','68000000-0000-0000-0000-000000000001','admin');
insert into public.user_roles(user_id,role)
 values ('68000000-0000-0000-0000-000000000003','superadmin');

-- Un usuario sin sesión (auth.uid() nulo) no puede escribir auditoría.
do $$ begin
  begin
    perform public.record_route_access_denial('/admin/superadmin', false);
    raise exception 'anonymous denial write succeeded';
  exception when insufficient_privilege then null; end;
end $$;

-- Tenant staff real, denegado en /admin/superadmin: el RPC recalcula sus
-- roles reales desde auth.uid() (no confía en lo que mande el cliente) y
-- deja constancia con has_tenant_membership = true.
set local role authenticated;
select set_config('request.jwt.claim.sub','68000000-0000-0000-0000-000000000001',true);
select public.record_route_access_denial('/admin/superadmin', true);

-- La tabla solo la lee un superadmin (política RLS de abajo) — para
-- verificar la fila insertada hace falta volver al rol con el que se abrió
-- esta sesión psql (postgres, superusuario, bypassa RLS), no seguir como
-- 'authenticated'/usuario 01.
reset role;
do $$ declare v_roles text[]; v_membership boolean; begin
  select actual_roles, has_tenant_membership into v_roles, v_membership
    from public.route_access_denials
    where user_id = '68000000-0000-0000-0000-000000000001'
    order by created_at desc limit 1;
  if v_roles is null then
    raise exception 'expected the just-inserted denial row to be visible as postgres, found none';
  end if;
  if v_roles <> array['user']::text[] then
    -- Todo signup real recibe la fila 'user' por defecto (trigger de alta),
    -- y este usuario no tiene ningún OTRO rol de plataforma (solo
    -- restaurant_staff) — actual_roles debe reflejar exactamente eso,
    -- calculado en servidor desde auth.uid(), nunca lo que mande el cliente.
    raise exception 'expected only the default user platform role, got %', v_roles;
  end if;
  if not v_membership then raise exception 'has_tenant_membership was not recorded as true'; end if;
end $$;

-- Un intento con un path fuera de rango se rechaza sin escribir nada.
set local role authenticated;
select set_config('request.jwt.claim.sub','68000000-0000-0000-0000-000000000001',true);
do $$ begin
  begin
    perform public.record_route_access_denial('', false);
    raise exception 'empty attempted_path was accepted';
  exception when others then
    if sqlerrm = 'empty attempted_path was accepted' then raise; end if;
  end;
end $$;

-- Un tenant staff normal NO puede leer la tabla de auditoría (solo superadmin).
do $$ begin
  perform 1 from public.route_access_denials limit 1;
  if found then raise exception 'tenant staff could read route_access_denials'; end if;
end $$;

-- El superadmin real sí puede leerla.
select set_config('request.jwt.claim.sub','68000000-0000-0000-0000-000000000003',true);
do $$ declare v_count integer; begin
  select count(*) into v_count from public.route_access_denials
    where user_id = '68000000-0000-0000-0000-000000000001';
  if v_count <> 1 then
    raise exception 'superadmin did not see the logged denial, got % rows', v_count;
  end if;
end $$;

-- Un usuario sin ninguna sesión de superadmin ni membresía no puede leer
-- la auditoría de otro usuario.
select set_config('request.jwt.claim.sub','68000000-0000-0000-0000-000000000002',true);
select public.record_route_access_denial('/repartidor', false);
do $$ declare v_count integer; begin
  select count(*) into v_count from public.route_access_denials;
  if v_count <> 0 then
    raise exception 'a non-superadmin read route_access_denials rows it should not see, got %', v_count;
  end if;
end $$;
rollback;
