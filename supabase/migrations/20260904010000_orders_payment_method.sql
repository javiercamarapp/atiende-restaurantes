-- Pedido real de Javier el 4-sep-2026: quería ver "forma de pago" en el
-- detalle de un pedido en Historial de Órdenes — pero esa respuesta
-- (efectivo/tarjeta) nunca se guardaba en ningún lado, aunque el agente
-- (voz y WhatsApp) SIEMPRE la pregunta en el paso 6/7 del flujo real, antes
-- de llamar a crear_pedido. Se agrega la columna para capturarla de verdad
-- de aquí en adelante — los pedidos viejos quedan sin dato (nunca se
-- inventa un valor para ellos).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method text;
