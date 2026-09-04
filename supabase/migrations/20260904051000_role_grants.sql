-- pg_dump did not preserve the hosted PostgREST grants.  RLS is only reached
-- after the SQL privilege check, so grant each API role the minimum verbs its
-- policies are designed to authorize.

grant usage on schema public to anon, authenticated;

grant select on public.branches, public.categories, public.products,
  public.promos, public.branch_products, public.merida_colonias
to anon, authenticated;

grant insert, update, delete on public.branches, public.categories,
  public.products, public.promos, public.branch_products
to authenticated;

grant select, insert, update on public.orders to authenticated;
grant select, insert, update on public.customers, public.customer_addresses
  to authenticated;
grant select on public.callback_requests, public.whatsapp_conversations
  to authenticated;
grant select, insert, update on public.whatsapp_agent_config to authenticated;
grant select on public.restaurants to authenticated;
grant select, update on public.restaurant_staff to authenticated;
grant select, insert on public.user_roles to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, update on public.repartidor_perfil to authenticated;
grant select, insert, update, delete on public.payment_methods to authenticated;

grant usage, select on sequence public.orders_order_number_seq to authenticated;
