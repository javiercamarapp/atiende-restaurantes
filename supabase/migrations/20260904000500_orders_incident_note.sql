-- Estado genérico "problema": pedido real de Javier el 3-sep-2026 al ver
-- que el único estado real de "algo salió mal" era `cancelado` — quería un
-- estado que cubra CUALQUIER incidencia en cualquier punto del ciclo
-- (dirección incorrecta en camino, cliente no contesta, o una queja real
-- después de que el pedido ya se entregó), con una nota de texto libre
-- explicando qué pasó. No se toca `status` (ya es texto libre, sin CHECK
-- constraint) — solo se agrega dónde guardar esa nota.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS incident_note text;
