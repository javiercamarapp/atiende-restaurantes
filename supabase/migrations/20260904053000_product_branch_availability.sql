-- A product created in the admin catalog must become orderable immediately.
-- Populate one branch_products row per branch in the same transaction; each
-- branch can still override price/availability afterwards.

create or replace function public.attach_new_product_to_tenant_branches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.branch_products (branch_id, product_id, price, is_available)
  select b.id, new.id, new.price, coalesce(new.is_available, true)
  from public.branches b
  where b.restaurant_id = new.restaurant_id
  on conflict (branch_id, product_id) do nothing;
  return new;
end
$$;

revoke all on function public.attach_new_product_to_tenant_branches() from public;

drop trigger if exists attach_new_product_to_tenant_branches on public.products;
create trigger attach_new_product_to_tenant_branches
after insert on public.products
for each row execute function public.attach_new_product_to_tenant_branches();
