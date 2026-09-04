create or replace function public.can_manage_restaurant(_user_id uuid, _restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.restaurant_staff
    where user_id = _user_id
      and restaurant_id = _restaurant_id
      and role in ('owner', 'admin', 'staff')
  );
$$;
revoke all on function public.can_manage_restaurant(uuid,uuid) from public;
grant execute on function public.can_manage_restaurant(uuid,uuid) to authenticated, service_role;

drop policy if exists "Staff can update own notification preferences" on public.restaurant_staff;
revoke update on public.restaurant_staff from authenticated;

create or replace function public.update_my_notification_preference(
  p_membership_id uuid,
  p_preference text,
  p_value boolean
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  if p_preference not in (
    'notify_nuevo', 'notify_preparando', 'notify_en_camino', 'notify_entregado',
    'notify_cancelado', 'notify_queja', 'notify_escalar', 'notify_entrega_tardia',
    'notify_programado_por_vencer'
  ) then return false; end if;

  execute format('update public.restaurant_staff set %I = $1 where id = $2 and (user_id = $3 or public.is_superadmin($3))', p_preference)
  using p_value, p_membership_id, auth.uid();
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;
revoke all on function public.update_my_notification_preference(uuid,text,boolean) from public, anon;
grant execute on function public.update_my_notification_preference(uuid,text,boolean) to authenticated;

drop policy if exists "Tenant staff can view orders" on public.orders;
drop policy if exists "Tenant staff can insert orders" on public.orders;
drop policy if exists "Tenant staff can update orders" on public.orders;
drop policy if exists "Assigned courier can update orders" on public.orders;
create policy "Tenant managers can view orders"
  on public.orders for select to authenticated
  using (public.can_manage_restaurant(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant managers can insert orders"
  on public.orders for insert to authenticated
  with check (public.can_manage_restaurant(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant managers can update orders"
  on public.orders for update to authenticated
  using (public.can_manage_restaurant(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()))
  with check (public.can_manage_restaurant(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()));

revoke update on public.orders from authenticated;
grant update (
  status, delivered_at, assigned_repartidor_id, estimated_delivery_at,
  scheduled_for, incident_note, notes, payment_method
) on public.orders to authenticated;

create or replace function public.update_assigned_order_status(
  p_order_id uuid,
  p_status text,
  p_incident_note text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status text;
  v_count integer;
begin
  if p_status not in ('en_camino', 'entregado', 'problema') then return false; end if;
  if p_status = 'problema' and (p_incident_note is null or length(trim(p_incident_note)) not between 1 and 2000) then return false; end if;
  if p_status <> 'problema' and p_incident_note is not null then return false; end if;

  select status into v_current_status from public.orders
  where id = p_order_id and assigned_repartidor_id = auth.uid()
  for update;
  if not found then return false; end if;
  if (p_status = 'entregado' and v_current_status <> 'en_camino')
     or (p_status = 'en_camino' and v_current_status not in ('pending', 'preparando'))
     or (p_status = 'problema' and v_current_status not in ('pending', 'preparando', 'en_camino')) then
    return false;
  end if;

  update public.orders
  set status = p_status,
      delivered_at = case when p_status = 'entregado' then now() else delivered_at end,
      incident_note = case when p_status = 'problema' then trim(p_incident_note) else incident_note end
  where id = p_order_id and assigned_repartidor_id = auth.uid();
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;
revoke all on function public.update_assigned_order_status(uuid,text,text) from public, anon;
grant execute on function public.update_assigned_order_status(uuid,text,text) to authenticated;
