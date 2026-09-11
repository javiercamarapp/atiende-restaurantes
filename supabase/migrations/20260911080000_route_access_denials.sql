-- Patrón 6 (rescatado de Likida/atiende.ai): RLS a nivel de fila está fuerte
-- y probado (privilege_escalation.sql, superadmin_platform_rpc.sql,
-- enterprise_tenant_isolation.sql) — qué DATOS puede tocar cada rol. Pero
-- qué PANTALLA puede ver cada rol no dejaba ningún rastro: un intento
-- denegado en el router solo generaba un redirect silencioso, sin auditoría
-- (a diferencia de privacy_requests, que sí audita las solicitudes ARCO).
-- Esta tabla y su RPC cierran esa brecha: RequireRole.tsx (src/) llama al
-- RPC de abajo cada vez que routePermissions.ts deniega una ruta.

create table public.route_access_denials (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_path text not null check (length(attempted_path) between 1 and 200),
  actual_roles text[] not null default '{}',
  has_tenant_membership boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.route_access_denials enable row level security;

-- Solo superadmins auditan; el usuario denegado no necesita (ni debe) leer
-- su propio historial de intentos fallidos desde el cliente.
create policy "Superadmins can view route access denials"
  on public.route_access_denials for select to authenticated
  using (public.is_superadmin(auth.uid()));

revoke all on public.route_access_denials from public, anon, authenticated;
grant select on public.route_access_denials to authenticated;
grant select, insert on public.route_access_denials to service_role;

create index route_access_denials_user_time_idx
  on public.route_access_denials (user_id, created_at desc);
create index route_access_denials_path_time_idx
  on public.route_access_denials (attempted_path, created_at desc);

-- security definer para poder insertar pese a que la tabla no concede
-- insert a `authenticated` (nunca se confía en el cliente para escribir
-- filas de auditoría directamente) — pero el propio usuario denegado SÍ
-- debe poder llamar a este RPC desde el navegador (RequireRole.tsx corre
-- ahí, no en una Edge Function con service_role). Por eso los roles
-- reales se recalculan aquí mismo desde auth.uid(), nunca se aceptan como
-- parámetro: un cliente comprometido no puede mentir sobre su propio rol
-- en el registro de auditoría.
create or replace function public.record_route_access_denial(
  p_attempted_path text,
  p_has_tenant_membership boolean default false
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_roles text[];
begin
  if auth.uid() is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;
  if p_attempted_path is null or length(p_attempted_path) < 1 or length(p_attempted_path) > 200 then
    raise exception 'invalid attempted_path';
  end if;

  select coalesce(array_agg(role::text), '{}')
    into v_roles
    from public.user_roles
    where user_id = auth.uid();

  insert into public.route_access_denials(
    user_id, attempted_path, actual_roles, has_tenant_membership
  ) values (
    auth.uid(), left(p_attempted_path, 200), v_roles, coalesce(p_has_tenant_membership, false)
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_route_access_denial(text, boolean) from public, anon;
grant execute on function public.record_route_access_denial(text, boolean) to authenticated;
