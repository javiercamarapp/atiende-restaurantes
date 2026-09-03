-- Sección Pedidos: seguimiento de entrega (recibidas / enviadas / programadas)
-- Aplicada en vivo vía MCP el 2026-09-03 — este archivo es el registro para el repo.

-- 1. Número de venta corto y legible (secuencial), distinto del id/uuid del pedido.
CREATE SEQUENCE IF NOT EXISTS orders_order_number_seq;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number integer;

-- Backfill de pedidos existentes, en orden de creación.
UPDATE public.orders
SET order_number = nextval('orders_order_number_seq')
WHERE order_number IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN order_number SET DEFAULT nextval('orders_order_number_seq'),
  ALTER COLUMN order_number SET NOT NULL;

ALTER SEQUENCE orders_order_number_seq OWNED BY public.orders.order_number;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_order_number_key'
  ) THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);
  END IF;
END $$;

-- 2. Repartidor asignado al pedido (misma fuente que user_roles.role = 'repartidor').
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS assigned_repartidor_id uuid REFERENCES auth.users(id);

-- 3. Entrega estimada, capturada al despachar el pedido a reparto.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS estimated_delivery_at timestamptz;

-- 4. Pedidos programados para un horario futuro específico.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

CREATE INDEX IF NOT EXISTS orders_scheduled_for_idx ON public.orders (scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_assigned_repartidor_id_idx ON public.orders (assigned_repartidor_id) WHERE assigned_repartidor_id IS NOT NULL;
