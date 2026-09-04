# Auditoría SaaS exhaustiva y remediación — 2026-09-04

## Veredicto ejecutivo

Base auditada: `ac9b3804528506cc3814403745ab003df8ebca2c` (`origin/main`). Rama
local de trabajo: `audit/enterprise-remediation-2026-09-04`. No se hizo push, merge,
deploy ni prueba contra producción.

La evaluación inicial fue **3.1/10**: restauración rota, aislamiento multitenant incompleto,
endpoints con service role sin autenticación propia, ausencia de rate limit/CI/tests,
deduplicación vulnerable a carreras y métricas truncadas. Después de la remediación local la
evaluación es **6.7/10**. La mejora es sustancial y reproducible, pero el producto **no es
10/10 ni tiene recomendación de producción**: faltan observabilidad y alertas reales,
restauración de backups productivos, E2E con proveedores en staging, branch protection,
retención/DSAR, procesamiento completo de lotes Meta y un dispatcher versionado para correo.

## Evidencia de cinco compuertas independientes

1. **Aplicación:** `npm run quality` — lint termina con 0 errores (34 warnings registrados),
   TypeScript verde, 21 pruebas Deno verdes y build de producción verde.
2. **Restauración:** `supabase db reset --local --no-seed` — todas las migraciones, desde un
   esquema vacío hasta `20260904056000`, aplican sin error.
3. **Datos/seguridad:** `npm run test:db` — aislamiento de tenants, grants, RLS, rate limit,
   entrega WhatsApp, idempotencia y agregados verdes; todas las pruebas SQL usan rollback.
4. **Concurrencia:** `supabase/tests/order_idempotency_concurrency.sh` — dos sesiones
   simultáneas obtienen el mismo UUID; queda 1 pedido y 1 incremento de cliente.
5. **Cadena de suministro:** `npm audit --omit=dev --audit-level=high --offline` — 0
   vulnerabilidades conocidas en el caché local. Requiere repetición online antes de release.

Evidencia adicional: `npx tsc --noEmit`, `git diff --check`, escaneo de patrones de secretos,
0 tablas públicas sin RLS en la base reconstruida y build que separa el login a 7.15 kB
(2.85 kB gzip). El chunk de AdminDashboard sigue en ~1.97 MB y queda como deuda.

## Calificación por los 20 rubros

| # | Rubro | Nota | Estado | Evidencia y brecha principal |
|---|---|---:|---|---|
| 1 | Diseño y consistencia de negocio | 7 | corregido | Precio y disponibilidad se validan server-side; invariantes de tenant y pedido tienen regresión. Estados siguen siendo texto y falta una máquina de estados formal. |
| 2 | Arquitectura y modularidad | 6 | corregido | Autorización, HTTP, timeout y núcleo de pedido se centralizaron. `AdminDashboard` y `agent-config` continúan sobredimensionados. |
| 3 | Resiliencia y recuperación | 6 | corregido | Inbox, lease, idempotencia y deadlines. Sin outbox de correo, circuit breaker ni RPO/RTO productivo probado. |
| 4 | Escalabilidad/capacidad/rendimiento/costo | 6 | corregido | Índices tenant, agregados SQL y lazy routes. Sin prueba sostenida, presupuesto de costo ni división del gran chunk admin. |
| 5 | Frontend y experiencia | 6 | corregido | Rutas lazy, carga/error mejorados y build verde. Sin E2E, auditoría a11y/dispositivos ni presupuesto automático de bundle. |
| 6 | APIs y backend | 8 | corregido | Métodos, tamaños, origen, auth, rate limit, errores seguros y transacción idempotente. Quedan contratos demasiado amplios en `agent-config`. |
| 7 | Dinero y efectos sensibles | 7 | corregido | Totales se recalculan con precios de sucursal y duplicados se bloquean. No hay cobro/liquidación real; reconciliación financiera no aplica todavía. |
| 8 | Base, migraciones y storage | 9 | corregido | Restore limpio, forward migration, RLS total, grants e índices. Backup de datos productivos no verificable. |
| 9 | Cache y CDN | 4 | pendiente | No hay capa de caché de aplicación documentada ni prueba de headers/invalidation del hosting. |
| 10 | Rate limiting y abuso | 8 | corregido | Contador atómico hash por actor, TTL amortizado y 429 en endpoints costosos. Falta telemetría/fairness multi-región. |
| 11 | Auth/autorización/permisos | 8 | corregido | Auth de agent-config, RBAC, tenant RLS, escalación de superadmin bloqueada y secretos fuera del cliente. MFA y revocación no verificables. |
| 12 | Seguridad y supply chain | 7 | corregido | Entradas limitadas, firma Meta, respuesta genérica, CI y audit local. Falta escáner online/SAST y política de artefactos firmados. |
| 13 | Privacidad/legal/retención | 5 | corregido | Redacción de tarjeta antes de persistir y páginas legales existentes. Sin política ejecutable de retención, exportación/borrado ni consentimiento de audio probado. |
| 14 | Hosting/cloud/infra | 4 | no verificable | Config local versionada; HA, regiones, red, staging, Vault productivo e IaC no son demostrables desde el repo. |
| 15 | CI/CD/versionado | 7 | corregido | Dos jobs versionados para aplicación y DB. `main` estaba sin protección; release/rollback y promoción de ambientes faltan. |
| 16 | Errores/tracking/logs | 5 | corregido | No se filtran cuerpos de proveedores y se clasifican timeouts. Persisten `console.error` no estructurados y sin correlation ID central. |
| 17 | Monitoreo/alertas/operatividad | 4 | pendiente | Runbook y señales objetivo documentados. No hay backend de métricas, alertas probadas ni on-call. |
| 18 | Pruebas y arneses | 8 | corregido | Unitarias, contratos SQL, restore y carrera real de dos sesiones. Faltan E2E browser, property tests y staging de proveedores. |
| 19 | Integraciones/webhooks/tools | 7 | corregido | HMAC, replay ledger, lease, timeout, auth de tools e idempotencia. Solo se procesa el primer mensaje de un lote Meta y correo carece de dispatcher. |
| 20 | Agentes/prompts/supervisión | 5 | pendiente | Grounding de catálogo y fallback existen; prompt activo, evaluaciones, handoff humano y calidad con modelo real no verificables. |

## Ledger deduplicado de hallazgos

| ID | Severidad | Estado | Causa raíz / evidencia | Resolución o siguiente acción |
|---|---|---|---|---|
| DATA-01 | crítico | corregido | La cadena limpia fallaba antes de `branch_products`; faltaban tablas/enum base. | Fundaciones ordenadas, forward upgrade y restore verde. |
| SEC-01 | crítico | corregido | Políticas históricas permitían lectura/escritura cruzada o no tenían RLS. | RLS y grants explícitos; prueba con dos tenants. |
| SEC-02 | crítico | corregido | `agent-config` tocaba Vault/proveedor sin autorización tenant suficiente. | JWT real, RBAC y propiedad de `agent_id`; 7 regresiones. |
| SEC-03 | alto | corregido | Tools con `verify_jwt=false` dependían solo de oscuridad y CORS `*`. | Secretos server-to-server, CORS exacto, límites y rate limit. |
| SEC-04 | alto | corregido | `.env` estaba versionado aunque contenía solo configuración pública. | Retirado del índice, plantilla vacía y reglas ignore. |
| SEC-05 | alto | corregido | POST de Meta no comprobaba autenticidad. | HMAC SHA-256 sobre cuerpo crudo antes de parsear. |
| INT-01 | crítico | corregido | `whatsapp_append_turn` era llamado sin contrato restaurable completo. | RPC versionado/forward y regresión de restore. |
| INT-02 | alto | corregido | Append atómico no evitaba turnos simultáneos y side effects desordenados. | Inbox por message ID y lease por conversación. |
| INT-03 | alto | corregido | Dedupe de pedido era SELECT→INSERT (TOCTOU). | Advisory lock transaccional, fingerprint y clave explícita; prueba concurrente. |
| INT-04 | alto | pendiente | Handler usa `entry[0].changes[0].messages[0]`. | Iterar y probar todos los mensajes del lote en orden; hoy está documentado como límite. |
| INT-05 | alto | pendiente | No existe trigger/dispatcher versionado para `send-order-notification`. | Implementar outbox, worker con retry/backoff y DLQ; no afirmar que el correo es automático. |
| REL-01 | alto | corregido | Fetches a proveedores podían colgar hasta agotar la función. | Deadline de 30 s compartido y pruebas de aborto/clasificación. |
| RATE-01 | alto | corregido | Endpoints costosos/PII sin cuotas. | RPC atómico por scope/actor hash, fail-closed y pruebas. |
| CAT-01 | alto | corregido | Producto nuevo no obtenía disponibilidad en sucursales. | Trigger transaccional crea `branch_products` del mismo tenant. |
| PERF-01 | alto | corregido | Login cargaba todo el panel de 3.23 MB. | Lazy loading por ruta; login aislado a 7.15 kB. |
| PERF-02 | alto | corregido | Ingresos/estadísticas se reducían sobre respuestas truncadas a 1,000 filas. | RPC agregados para tendencias y canales. |
| PERF-03 | medio | pendiente | `AdminDashboard` aún produce un chunk de ~1.97 MB. | Dividir secciones/importaciones pesadas y fijar budget CI. |
| SA-01 | alto | pendiente | SuperAdmin trae órdenes/clientes completos sin paginación ni agregados. | RPC de plataforma, búsqueda server-side y cursores. |
| CI-01 | alto | corregido | Sin workflows ni scripts de typecheck/test. | Pipeline aplicación+DB y scripts reproducibles. |
| QUAL-01 | medio | pendiente | TypeScript sigue permisivo y lint conserva 34 warnings. | Reducir `any`, activar strict por etapas y resolver dependencias de hooks. |
| OBS-01 | alto | pendiente | Sin métricas/SLO/alertas/correlation ID. | Instrumentar señales del runbook y probar alertas. |
| PRIV-01 | alto | pendiente | Sin retención, DSAR y consentimiento operativo verificable. | Política, jobs de borrado/exportación y evidencia legal. |
| INFRA-01 | alto | no verificable | Backup/restore productivo, HA y secretos reales fuera del checkout. | Simulacro en staging aislado y evidencia firmada. |
| SCM-01 | alto | pendiente | Rama `main` remota sin required checks/protección al consultar GitHub. | Proteger rama y exigir los dos jobs antes de merge. |
| TEST-01 | alto | pendiente | No hay E2E de navegador/proveedores ni carga sostenida. | Staging sintético, Playwright, pruebas de contratos y carga sin efectos reales. |
| AGENT-01 | alto | no verificable | Prompt/modelo efectivo viven parcialmente en proveedor/Vault. | Captura versionada, eval set, métricas de alucinación y handoff humano. |

## Historial de remediación local

- `b910970` — autorización tenant de configuración de voz.
- `bff37d4`, `e168912`, `67238ae` — fundaciones, migración forward, aislamiento y catálogo.
- `3de32ee` — higiene de configuración local.
- `ebdb209`, `f06d59d` — lazy routes y agregados administrativos.
- `1b29ad1` — protección de endpoints públicos y rate limit.
- `c2154a5` — firma/replay/lease de WhatsApp e idempotencia de pedidos.
- `edf114e` — compuertas CI de aplicación y datos.
- `ceb1817`, `9dddfa0` — deadlines de proveedores y tool de sucursal protegida.

## Decisión de release

**NO-GO a producción.** Para pasar a GO deben cerrarse al menos `INT-04`, `INT-05`,
`SA-01`, `OBS-01`, `SCM-01`, `INFRA-01` y `TEST-01`, repetir auditoría de dependencias
online y ejecutar staging con secretos rotables. Esta decisión evita convertir evidencia
local en una afirmación falsa sobre operación real.
