-- Close cross-tenant access left by the original single-restaurant policies.
-- Public menu reads remain public; every authenticated write and every PII
-- read is scoped to a restaurant membership (or an authenticated superadmin).

create or replace function public.shares_restaurant(_viewer uuid, _target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.restaurant_staff viewer
    join public.restaurant_staff target
      on target.restaurant_id = viewer.restaurant_id
    where viewer.user_id = _viewer and target.user_id = _target
  )
$$;

revoke all on function public.shares_restaurant(uuid, uuid) from public;
grant execute on function public.shares_restaurant(uuid, uuid) to authenticated, service_role;

drop policy if exists "Staff can view own membership" on public.restaurant_staff;
create policy "Staff can view restaurant memberships"
  on public.restaurant_staff for select to authenticated
  using (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()));

drop policy if exists "Admins can delete categories" on public.categories;
drop policy if exists "Admins can insert categories" on public.categories;
drop policy if exists "Admins can update categories" on public.categories;
create policy "Tenant staff can insert categories"
  on public.categories for insert to authenticated
  with check (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant staff can update categories"
  on public.categories for update to authenticated
  using (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()))
  with check (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant staff can delete categories"
  on public.categories for delete to authenticated
  using (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()));

drop policy if exists "Admins can delete products" on public.products;
drop policy if exists "Admins can insert products" on public.products;
drop policy if exists "Admins can update products" on public.products;
create policy "Tenant staff can insert products"
  on public.products for insert to authenticated
  with check (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant staff can update products"
  on public.products for update to authenticated
  using (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()))
  with check (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant staff can delete products"
  on public.products for delete to authenticated
  using (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()));

drop policy if exists "Admins can delete promos" on public.promos;
drop policy if exists "Admins can insert promos" on public.promos;
drop policy if exists "Admins can update promos" on public.promos;
create policy "Tenant staff can insert promos"
  on public.promos for insert to authenticated
  with check (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant staff can update promos"
  on public.promos for update to authenticated
  using (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()))
  with check (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant staff can delete promos"
  on public.promos for delete to authenticated
  using (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()));

drop policy if exists "Admins can view all orders" on public.orders;
drop policy if exists "Admins can update orders" on public.orders;
drop policy if exists "Repartidores can view all orders" on public.orders;
drop policy if exists "Repartidores can update orders" on public.orders;
drop policy if exists "Admins and repartidores can create orders" on public.orders;
create policy "Tenant staff can view orders"
  on public.orders for select to authenticated
  using (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Assigned courier can view orders"
  on public.orders for select to authenticated
  using (assigned_repartidor_id = auth.uid());
create policy "Tenant staff can insert orders"
  on public.orders for insert to authenticated
  with check (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant staff can update orders"
  on public.orders for update to authenticated
  using (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()))
  with check (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Assigned courier can update orders"
  on public.orders for update to authenticated
  using (assigned_repartidor_id = auth.uid())
  with check (assigned_repartidor_id = auth.uid());

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Tenant members can view related profiles"
  on public.profiles for select to authenticated
  using (
    user_id = auth.uid()
    or public.shares_restaurant(auth.uid(), user_id)
    or public.is_superadmin(auth.uid())
  );

drop policy if exists "Admins can view roles" on public.user_roles;
create policy "Tenant members can view related roles"
  on public.user_roles for select to authenticated
  using (
    user_id = auth.uid()
    or public.shares_restaurant(auth.uid(), user_id)
    or public.is_superadmin(auth.uid())
  );

drop policy if exists "Admins can view repartidor profiles" on public.repartidor_perfil;
drop policy if exists "Admins can insert repartidor profiles" on public.repartidor_perfil;
drop policy if exists "Admins can update repartidor profiles" on public.repartidor_perfil;
create policy "Tenant members can view courier profiles"
  on public.repartidor_perfil for select to authenticated
  using (public.shares_restaurant(auth.uid(), user_id) or public.is_superadmin(auth.uid()));
create policy "Tenant members can update courier profiles"
  on public.repartidor_perfil for update to authenticated
  using (public.shares_restaurant(auth.uid(), user_id) or public.is_superadmin(auth.uid()))
  with check (public.shares_restaurant(auth.uid(), user_id) or public.is_superadmin(auth.uid()));

drop policy if exists "Admins can view whatsapp agent config" on public.whatsapp_agent_config;
drop policy if exists "Admins can insert whatsapp agent config" on public.whatsapp_agent_config;
drop policy if exists "Admins can update whatsapp agent config" on public.whatsapp_agent_config;
create policy "Tenant staff can view whatsapp agent config"
  on public.whatsapp_agent_config for select to authenticated
  using (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant staff can insert whatsapp agent config"
  on public.whatsapp_agent_config for insert to authenticated
  with check (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant staff can update whatsapp agent config"
  on public.whatsapp_agent_config for update to authenticated
  using (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()))
  with check (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()));

alter table public.merida_colonias enable row level security;
drop policy if exists "Merida colonias are publicly readable" on public.merida_colonias;
create policy "Merida colonias are publicly readable"
  on public.merida_colonias for select to anon, authenticated
  using (true);

create index if not exists orders_tenant_created_idx
  on public.orders (restaurant_id, created_at desc);
create index if not exists orders_tenant_status_created_idx
  on public.orders (restaurant_id, status, created_at desc);
create index if not exists orders_tenant_phone_branch_created_idx
  on public.orders (restaurant_id, customer_phone, branch_id, created_at desc);
create index if not exists orders_tenant_customer_created_idx
  on public.orders (restaurant_id, customer_id, created_at desc)
  where customer_id is not null;
create index if not exists customers_tenant_last_order_idx
  on public.customers (restaurant_id, last_order_at desc);
create index if not exists callbacks_tenant_created_idx
  on public.callback_requests (restaurant_id, created_at desc);
