# Runbook de operación

## Alcance y principio de seguridad

Este repositorio no autoriza por sí solo cambios en producción. Las verificaciones locales
usan Supabase local y datos sintéticos. Nunca se deben ejecutar pruebas de pedidos, correos,
voz o WhatsApp contra credenciales reales sin un ambiente aislado y autorización explícita.

## Compuerta previa a release

1. Confirmar árbol limpio y revisión de diff contra la base aprobada.
2. Ejecutar `npm ci --ignore-scripts --no-audit --no-fund`.
3. Ejecutar `npm run quality`.
4. Ejecutar `supabase db reset --local --no-seed` y `npm run test:db`.
5. Ejecutar un escaneo de secretos y una auditoría de dependencias con red disponible.
6. Validar en staging aislado los contratos de Meta, OpenRouter, ElevenLabs y Resend.
7. Aplicar migraciones primero en staging, comprobar métricas y ensayar rollback lógico.

Un warning de bundle, una prueba omitida o una integración no verificable debe quedar en el
registro de release; no se convierte en verde por ausencia de evidencia.

### Upgrade de un proyecto existente

El reset local demuestra que el historial completo construye una base vacía, pero no prueba
el ledger de un proyecto alojado. Antes de aplicar la migración forward fechada
`20260901000000` sobre un proyecto que ya tenga migraciones posteriores:

1. Exportar y revisar `supabase migration list` y un backup recuperable del staging.
2. Ejecutar `supabase db push --include-all --dry-run` contra staging, nunca producción.
3. Comparar el plan con el inventario aprobado y detenerse ante cualquier migración inesperada.
4. Aplicar en staging, repetir contratos SQL sobre una copia segura y validar rollback lógico.
5. Autorizar producción únicamente con evidencia del ensayo. No usar `migration repair` para
   ocultar divergencias sin una reconciliación explícita y revisada.

## Restauración

RPO/RTO de producción no están definidos en este repositorio. Para validar recuperabilidad
del esquema local:

```bash
supabase start
supabase db reset --local --no-seed
npm run test:db
```

La restauración de datos productivos requiere verificar las copias administradas por el
proveedor, ejecutar una restauración a un proyecto aislado y comparar conteos e invariantes
por tenant. No sobrescribir producción durante el simulacro. Evidencia mínima: fecha del
backup, punto restaurado, duración, conteos, hashes de artefactos y responsable.

## Incidente: pedidos duplicados

- Congelar reintentos manuales y conservar los identificadores externos.
- Consultar `orders.idempotency_key`, `orders.dedupe_fingerprint` y
  `whatsapp_inbound_events` sin copiar PII a tickets.
- No borrar filas: marcar y reconciliar mediante un procedimiento aprobado.
- Verificar que la misma intención produjo un solo pedido y un solo incremento de cliente.
- Ejecutar `supabase/tests/order_idempotency_concurrency.sh` en el ambiente aislado.

## Incidente: WhatsApp atrasado o fallando

- Revisar estados y antigüedad en `whatsapp_inbound_events` y leases vencidos.
- Comprobar expiración del access token y existencia de `WHATSAPP_APP_SECRET`.
- Un `processed` no debe reabrirse; un `failed` es reclamable; un lease expira en cinco
  minutos como máximo por contrato de migración.
- No registrar cuerpos, teléfonos, tokens ni respuestas completas del proveedor.
- El handler aún procesa solo el primer mensaje de cada lote Meta; mantener tráfico limitado
  hasta cerrar `INT-04` de la auditoría.

## Incidente: proveedor externo lento

Cada llamada versionada tiene un máximo de 30 segundos; un turno completo del agente tiene
un presupuesto global de 45 segundos. Alertar por proveedor si la tasa de timeout supera 1%
durante 10 minutos o si hay cinco fallos consecutivos. La alerta y el canal on-call todavía
requieren configuración fuera del repositorio.

## Secretos y rotación

- Frontend: únicamente valores públicos `VITE_SUPABASE_*`.
- Server-side: Vault o secretos de Edge Functions.
- Rotar inmediatamente ante exposición; invalidar primero, reemplazar después y verificar
  con una solicitud sintética sin efecto.
- Alertas requeridas: token de Meta con 14/7/1 días de anticipación, fallos de Vault,
  credenciales de Resend/OpenRouter/ElevenLabs y cambios de permisos.

## Señales mínimas pendientes de instrumentar

- Latencia/error por función y proveedor, con correlation ID.
- Mensajes WhatsApp `failed` y `processing` envejecidos.
- Rechazos por rate limit y por firma.
- Pedidos deduplicados, pedidos por canal y fallos de creación.
- Retraso de notificaciones y antigüedad del último backup restaurado.
