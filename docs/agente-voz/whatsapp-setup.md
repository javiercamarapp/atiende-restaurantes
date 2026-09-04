# Agente por WhatsApp — Meta Cloud API

El webhook versionado usa el contrato de Meta Cloud API. Comparte reglas de negocio con el
widget y la creación de pedidos, pero cada entrega se autentica, registra y serializa antes
de ejecutar herramientas.

## Controles obligatorios

- `WHATSAPP_VERIFY_TOKEN`: secreto del handshake GET.
- `WHATSAPP_APP_SECRET`: valida `X-Hub-Signature-256` sobre el cuerpo POST crudo.
- `WHATSAPP_ACCESS_TOKEN`: token de envío; debe tener rotación y alerta de expiración.
- `WHATSAPP_PHONE_NUMBER_ID`: identificador del número emisor.
- `OPENROUTER_API_KEY`: proveedor del modelo.

El código actual lee estos valores mediante `get_secret()` desde Supabase Vault. No se deben
copiar a `.env`, al frontend ni a documentación. La configuración real y su rotación deben
verificarse en cada ambiente antes de habilitar tráfico.

## Semántica de entrega

- Meta puede reenviar el mismo `message.id`; `whatsapp_inbound_events` evita repetir efectos.
- `whatsapp_conversation_leases` impide turnos solapados por cliente.
- Los pedidos usan una transacción idempotente y una clave derivada del mensaje.
- Las llamadas externas tienen deadline; un fallo transitorio responde 5xx para permitir retry.
- PAN, CVV y vencimiento se redactan antes de persistir el mensaje.

El handler procesa actualmente el primer mensaje de cada lote Meta. Antes de tráfico de alto
volumen debe completarse y probarse el procesamiento secuencial de todos los elementos de
`entry[].changes[].value.messages[]`; esta limitación está registrada en la auditoría.

## Verificación sin efectos reales

Ejecuta `npm run test:edge` y `npm run test:db`. Estas pruebas usan datos sintéticos y una
base local. No llaman Meta, OpenRouter ni otros servicios externos. La validación end-to-end
con proveedores es una compuerta separada y requiere un ambiente aislado y autorización.
