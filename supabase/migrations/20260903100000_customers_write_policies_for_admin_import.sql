-- Los Clientes (admin CRM): la sección "Clientes" del admin necesita poder
-- crear/actualizar clientes y sus domicilios (alta manual + importación
-- masiva por CSV/Excel). La migración de customers (20260902040000) solo
-- dejó política de SELECT para admins — faltaban INSERT/UPDATE, igual que
-- ya existe para "orders" (ver "Admins can update orders" en
-- 20251204074017). Sin esto, ClientesSection.tsx no puede insertar clientes
-- reales desde el navegador (RLS lo bloquea) ni la importación masiva puede
-- hacer upsert por teléfono.

CREATE POLICY "Admins can insert customers" ON public.customers
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update customers" ON public.customers
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert customer addresses" ON public.customer_addresses
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update customer addresses" ON public.customer_addresses
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
