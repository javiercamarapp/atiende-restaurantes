-- Auditoría de 13 rubros (4-sep-2026, estilo Likida) — fixes de los hallazgos
-- CRÍTICOS/ALTOS de seguridad encontrados por el rubro de seguridad/RLS.
-- Todo pedido/cliente/producto real se crea/edita vía edge functions con
-- SERVICE_ROLE_KEY (ignora RLS por completo) — las políticas públicas que
-- se corrigen aquí nunca fueron necesarias para el funcionamiento real de
-- la app, solo dejaban una puerta abierta de más.

-- 1. CRÍTICO — escalación de privilegios: "Users can insert their own role"
-- solo validaba que user_id fuera el propio, nunca qué `role` se pedía.
-- Cualquier usuario autenticado podía auto-asignarse 'admin'/'superadmin'.
drop policy if exists "Users can insert their own role" on public.user_roles;
create policy "Users can insert their own base role"
  on public.user_roles for insert
  with check (user_id = auth.uid() and role = 'user'::app_role);

-- 2. ALTO — "Restaurant staff can view their callback requests" tenía
-- qual: true (literal) pese al nombre — exponía nombre/teléfono/motivo de
-- TODOS los callback_requests (voz + WhatsApp) a cualquiera con la anon key.
drop policy if exists "Restaurant staff can view their callback requests" on public.callback_requests;
create policy "Restaurant staff can view their callback requests"
  on public.callback_requests for select
  using (public.is_restaurant_staff(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid()));

-- 3. CRÍTICO — "Service role can manage branch products" tenía roles:{public}
-- pese al nombre — cualquiera con la anon key podía escribir precio/
-- disponibilidad real de cualquier producto en cualquier sucursal.
drop policy if exists "Service role can manage branch products" on public.branch_products;
create policy "Restaurant staff can manage branch products"
  on public.branch_products for all
  using (
    exists (
      select 1 from public.branches b
      where b.id = branch_products.branch_id
        and (public.is_restaurant_staff(auth.uid(), b.restaurant_id) or public.is_superadmin(auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.branches b
      where b.id = branch_products.branch_id
        and (public.is_restaurant_staff(auth.uid(), b.restaurant_id) or public.is_superadmin(auth.uid()))
    )
  );

-- 4. ALTO — "Anyone can create orders" (with_check: true, roles:{public})
-- permitía un INSERT directo por REST que se salta por completo la
-- validación real de createOrderCore (precio recalculado, duplicados,
-- disponibilidad) — riesgo directo sobre la meta de 30,000 pedidos/mes
-- reales (fabricar pedidos falsos sin fricción).
drop policy if exists "Anyone can create orders" on public.orders;
create policy "Admins and repartidores can create orders"
  on public.orders for insert
  with check (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'repartidor'::app_role));

-- 5. ALTO — whatsapp_append_turn (SECURITY DEFINER) otorgada a anon/
-- authenticated/PUBLIC dejaba leer/corromper el historial completo de
-- WhatsApp de cualquier teléfono sin autenticación. Solo la usan
-- whatsapp-webhook/whatsapp-widget-chat, ambos con SERVICE_ROLE_KEY.
revoke execute on function public.whatsapp_append_turn(text, jsonb, text, uuid, uuid) from public, anon, authenticated;

-- 6. BAJO — get_order_status (SECURITY DEFINER) es un bypass de RLS sobre
-- orders sin ningún uso real en el código (confirmado por grep). Se revoca
-- el acceso público.
revoke execute on function public.get_order_status(uuid) from public, anon, authenticated;

-- Nota: el fix de "merida_colonias sin RLS" (hallazgo bajo, sin RLS activado
-- en absoluto) quedó pendiente de aplicar — Auto Mode lo bloqueó como acción
-- de mayor riesgo (ENABLE ROW LEVEL SECURITY en una tabla que nunca la tuvo);
-- Javier debe aprobarlo directo.
