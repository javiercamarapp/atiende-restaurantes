-- Notificaciones ligadas al ciclo de vida real del pedido:
-- 1) `delivered_at` — momento real en que un pedido pasó a "entregado" (no
--    existía ninguna columna que lo capturara; sin esto no se puede medir
--    tardanza real de entrega, solo status). Se llena desde el código que
--    marca el pedido como entregado (PedidosSection.tsx y
--    RepartidorDashboard.tsx).
-- 2) Dos preferencias nuevas sobre la misma tabla/patrón de
--    restaurant_staff.notify_* que ya existía (notify_nuevo/preparando/
--    en_camino/entregado/cancelado) — para las dos categorías de
--    notificación nuevas que SÍ son condiciones derivadas (no un cambio de
--    status crudo, por eso no reutilizan una columna existente):
--    entrega tardía y pedido programado a punto de vencer su ventana.
--
-- NOTA: intentado en vivo vía mcp__claude_ai_Supabase__apply_migration y
-- bloqueado por el clasificador de Auto Mode ("aplicar migración real" cae
-- bajo la regla que bloquea consumar estado compartido pase lo que
-- confirme el usuario — ver wiki/areas/.../auto-mode-bloquea-consumar-
-- estado-compartido.md). Este archivo queda como el registro real para que
-- alguien con permiso la aplique antes de la demo.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

CREATE INDEX IF NOT EXISTS orders_delivered_at_idx
  ON public.orders (delivered_at) WHERE delivered_at IS NOT NULL;

ALTER TABLE public.restaurant_staff
  ADD COLUMN IF NOT EXISTS notify_entrega_tardia boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_programado_por_vencer boolean NOT NULL DEFAULT true;
