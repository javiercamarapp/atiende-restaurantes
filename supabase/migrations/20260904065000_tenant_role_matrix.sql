-- Membership is not administration. Couriers keep their dedicated assigned
-- order/profile access; tenant configuration, catalog and customer PII are
-- restricted to owner/admin/staff through can_manage_restaurant().
drop policy if exists "Admins can insert branches" on public.branches;
drop policy if exists "Admins can update branches" on public.branches;
drop policy if exists "Admins can delete branches" on public.branches;
create policy "Tenant managers can insert branches" on public.branches for insert to authenticated
  with check (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant managers can update branches" on public.branches for update to authenticated
  using (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()))
  with check (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant managers can delete branches" on public.branches for delete to authenticated
  using (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()));

drop policy if exists "Tenant staff can insert categories" on public.categories;
drop policy if exists "Tenant staff can update categories" on public.categories;
drop policy if exists "Tenant staff can delete categories" on public.categories;
create policy "Tenant managers can insert categories" on public.categories for insert to authenticated
  with check (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant managers can update categories" on public.categories for update to authenticated
  using (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()))
  with check (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant managers can delete categories" on public.categories for delete to authenticated
  using (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()));

drop policy if exists "Tenant staff can insert products" on public.products;
drop policy if exists "Tenant staff can update products" on public.products;
drop policy if exists "Tenant staff can delete products" on public.products;
create policy "Tenant managers can insert products" on public.products for insert to authenticated
  with check (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant managers can update products" on public.products for update to authenticated
  using (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()))
  with check (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant managers can delete products" on public.products for delete to authenticated
  using (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()));

drop policy if exists "Tenant staff can insert promos" on public.promos;
drop policy if exists "Tenant staff can update promos" on public.promos;
drop policy if exists "Tenant staff can delete promos" on public.promos;
create policy "Tenant managers can insert promos" on public.promos for insert to authenticated
  with check (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant managers can update promos" on public.promos for update to authenticated
  using (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()))
  with check (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant managers can delete promos" on public.promos for delete to authenticated
  using (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()));

drop policy if exists "Admins can view customers" on public.customers;
drop policy if exists "Admins can insert customers" on public.customers;
drop policy if exists "Admins can update customers" on public.customers;
create policy "Tenant managers can view customers" on public.customers for select to authenticated
  using (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant managers can insert customers" on public.customers for insert to authenticated
  with check (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant managers can update customers" on public.customers for update to authenticated
  using (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()))
  with check (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()));

drop policy if exists "Admins can view customer addresses" on public.customer_addresses;
drop policy if exists "Admins can insert customer addresses" on public.customer_addresses;
drop policy if exists "Admins can update customer addresses" on public.customer_addresses;
create policy "Tenant managers can view customer addresses" on public.customer_addresses for select to authenticated
  using (exists(select 1 from public.customers c where c.id=customer_id and
    (public.can_manage_restaurant(auth.uid(),c.restaurant_id) or public.is_superadmin(auth.uid()))));
create policy "Tenant managers can insert customer addresses" on public.customer_addresses for insert to authenticated
  with check (exists(select 1 from public.customers c where c.id=customer_id and
    (public.can_manage_restaurant(auth.uid(),c.restaurant_id) or public.is_superadmin(auth.uid()))));
create policy "Tenant managers can update customer addresses" on public.customer_addresses for update to authenticated
  using (exists(select 1 from public.customers c where c.id=customer_id and
    (public.can_manage_restaurant(auth.uid(),c.restaurant_id) or public.is_superadmin(auth.uid()))))
  with check (exists(select 1 from public.customers c where c.id=customer_id and
    (public.can_manage_restaurant(auth.uid(),c.restaurant_id) or public.is_superadmin(auth.uid()))));

drop policy if exists "Restaurant staff can view their callback requests" on public.callback_requests;
create policy "Tenant managers can view callback requests" on public.callback_requests for select to authenticated
  using (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()));

drop policy if exists "Tenant staff can view whatsapp agent config" on public.whatsapp_agent_config;
drop policy if exists "Tenant staff can insert whatsapp agent config" on public.whatsapp_agent_config;
drop policy if exists "Tenant staff can update whatsapp agent config" on public.whatsapp_agent_config;
create policy "Tenant managers can view whatsapp agent config" on public.whatsapp_agent_config for select to authenticated
  using (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant managers can insert whatsapp agent config" on public.whatsapp_agent_config for insert to authenticated
  with check (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()));
create policy "Tenant managers can update whatsapp agent config" on public.whatsapp_agent_config for update to authenticated
  using (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()))
  with check (public.can_manage_restaurant(auth.uid(),restaurant_id) or public.is_superadmin(auth.uid()));

drop policy if exists "Tenant members can update courier profiles" on public.repartidor_perfil;
create policy "Tenant managers can update courier profiles" on public.repartidor_perfil for update to authenticated
  using (exists(select 1 from public.restaurant_staff target where target.user_id=repartidor_perfil.user_id
    and (public.can_manage_restaurant(auth.uid(),target.restaurant_id) or public.is_superadmin(auth.uid()))))
  with check (exists(select 1 from public.restaurant_staff target where target.user_id=repartidor_perfil.user_id
    and (public.can_manage_restaurant(auth.uid(),target.restaurant_id) or public.is_superadmin(auth.uid()))));
