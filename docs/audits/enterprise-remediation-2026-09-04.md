# Auditoría SaaS exhaustiva y remediación — 2026-09-04

## Veredicto ejecutivo

Base auditada: `ac9b3804528506cc3814403745ab003df8ebca2c` (`origin/main`). Rama
local de trabajo: `audit/enterprise-remediation-2026-09-04`. No se hizo push, merge,
deploy ni prueba contra producción.

La evaluación inicial fue **3.1/10**: restauración rota, aislamiento multitenant incompleto,
endpoints con service role sin autenticación propia, ausencia de rate limit/CI/tests,
deduplicación vulnerable a carreras y métricas truncadas. Después de la remediación y una
reauditoría independiente, la evaluación local es **7.8/10**. La mejora es sustancial y
reproducible, pero el producto **no es 10/10 ni tiene recomendación de producción**: falta
activar y observar el dispatcher en un ambiente real, probar backups y upgrades alojados,
ejecutar E2E con proveedores en staging, configurar on-call/alertas y proteger la rama.

## Evidencia de cinco compuertas independientes

1. **Aplicación:** `npm run quality` — lint termina con 0 errores (34 warnings registrados),
   TypeScript verde, 27 pruebas Deno verdes, chequeo real de 12 Edge Functions y build verde.
2. **Restauración:** `supabase db reset --local --no-seed` — todas las migraciones, desde un
   esquema vacío hasta `20260904067000`, aplican sin error.
3. **Datos/seguridad:** `npm run test:db` — aislamiento de tenants, grants, RLS, rate limit,
   entrega WhatsApp, escalación de privilegios, DSAR, outbox y agregados globales verdes. Los archivos
   SQL revierten su transacción; el arnés de concurrencia elimina sus datos sintéticos
   confirmados al terminar.
4. **Concurrencia:** carreras reales de pedido y claim de outbox — dos sesiones obtienen el
   mismo UUID/una sola mutación y sólo un worker reclama el efecto.
5. **Cadena de suministro:** `npm ci --ignore-scripts` reproducible y
   `npm audit --omit=dev --audit-level=high` **online** — 0 altas/críticas; quedan 2 moderadas
   de React Router cuyo arreglo automático exige una migración mayor a v7.

Evidencia adicional: `git diff --check`, escaneo de secretos, 0 tablas públicas sin RLS,
prueba de upgrade fuera de orden y smoke de navegador real contra build/local Supabase para
login, legales, 404 y redirect de `/admin`/`/admin/superadmin`. Login pesa 7.15 kB; los
budgets bloquean AdminDashboard >2.1 MB y SuperAdmin >30 kB (medidos 2.04 MB y 24.6 kB).

## Calificación por los 20 rubros

| # | Rubro | Nota | Estado | Evidencia y brecha principal |
|---|---|---:|---|---|
| 1 | Diseño y consistencia de negocio | 7 | corregido | Precio y disponibilidad se validan server-side; invariantes de tenant y pedido tienen regresión. Estados siguen siendo texto y falta una máquina de estados formal. |
| 2 | Arquitectura y modularidad | 6 | corregido | Autorización, HTTP, timeout y núcleo de pedido se centralizaron. `AdminDashboard` y `agent-config` continúan sobredimensionados. |
| 3 | Resiliencia y recuperación | 7 | corregido local | Inbox, lease, outbox con retry/backoff/DLQ y deadlines. RPO/RTO productivo sigue sin probar. |
| 4 | Escalabilidad/capacidad/rendimiento/costo | 6 | corregido | Índices tenant, agregados SQL y lazy routes. Sin prueba sostenida, presupuesto de costo ni división del gran chunk admin. |
| 5 | Frontend y experiencia | 7 | corregido local | Rutas lazy, smoke de navegador y budgets automáticos. Falta E2E autenticado/a11y/dispositivos. |
| 6 | APIs y backend | 8 | corregido | Métodos, tamaños, origen, auth, rate limit, errores seguros y transacción idempotente. Quedan contratos demasiado amplios en `agent-config`. |
| 7 | Dinero y efectos sensibles | 7 | corregido | Totales se recalculan con precios de sucursal y duplicados se bloquean. No hay cobro/liquidación real; reconciliación financiera no aplica todavía. |
| 8 | Base, migraciones y storage | 7 | corregido local / pendiente remoto | Restore limpio, forward migration, RLS total, grants e índices. El upgrade de un proyecto remoto con el historial previo no fue ejecutado y exige ensayo en staging. |
| 9 | Cache y CDN | 4 | pendiente | No hay capa de caché de aplicación documentada ni prueba de headers/invalidation del hosting. |
| 10 | Rate limiting y abuso | 7 | corregido local | Contador atómico hash por IP observada, TTL amortizado y 429 en endpoints costosos. Falta telemetría, una identidad de proxy criptográficamente confiable y fairness multi-región. |
| 11 | Auth/autorización/permisos | 8 | corregido | Auth de agent-config, RBAC, tenant RLS y regresiones de escalación para membresía, superadmin y repartidor. MFA y revocación no verificables. |
| 12 | Seguridad y supply chain | 8 | corregido local | Firma Meta, CI, audit online sin altas y SheetJS oficial corregido. Quedan 2 moderadas y falta SAST/artefactos firmados. |
| 13 | Privacidad/legal/retención | 8 | corregido local | Retención configurable desactivada por defecto y DSAR export/erase cubre variantes telefónicas, conversaciones y outbox. Consentimiento de audio real no probado. |
| 14 | Hosting/cloud/infra | 4 | no verificable | Config local versionada; HA, regiones, red, staging, Vault productivo e IaC no son demostrables desde el repo. |
| 15 | CI/CD/versionado | 7 | corregido | Dos jobs versionados para aplicación y DB. `main` estaba sin protección; release/rollback y promoción de ambientes faltan. |
| 16 | Errores/tracking/logs | 7 | corregido local | Correlation ID, logs estructurados/sanitizados y eventos operativos. Persisten logs heredados no estructurados. |
| 17 | Monitoreo/alertas/operatividad | 6 | corregido local / pendiente externo | Snapshot/umbrales y runbook versionados. Falta conectar alertas y on-call reales. |
| 18 | Pruebas y arneses | 8 | corregido local | Unitarias, contratos SQL, restore, dos carreras, lote de 25k y navegador local. Faltan proveedores/staging y carga sostenida. |
| 19 | Integraciones/webhooks/tools | 8 | corregido local / pendiente externo | Lote Meta completo, outbox, scheduler versionado, retries y DLQ. Falta activarlo en staging y WhatsApp conserva la ventana proveedor-acepta/ack. |
| 20 | Agentes/prompts/supervisión | 5 | pendiente | Grounding de catálogo y fallback existen; prompt activo, evaluaciones, handoff humano y calidad con modelo real no verificables. |

## Ledger deduplicado de hallazgos

| ID | Severidad | Estado | Causa raíz / evidencia | Resolución o siguiente acción |
|---|---|---|---|---|
| DATA-01 | crítico | corregido | La cadena limpia fallaba antes de `branch_products`; faltaban tablas/enum base. | Fundaciones ordenadas, forward upgrade y restore verde. |
| SEC-01 | crítico | corregido | Políticas históricas permitían lectura/escritura cruzada o no tenían RLS. | RLS y grants explícitos; prueba con dos tenants. |
| SEC-02 | crítico | corregido | `agent-config` tocaba Vault/proveedor sin autorización tenant suficiente. | JWT real, RBAC, tenant derivado del agente y mapping restaurable `branches.elevenlabs_agent_id`; 8 regresiones. |
| SEC-03 | alto | corregido | Tools con `verify_jwt=false` dependían solo de oscuridad y CORS `*`. | Secretos server-to-server, CORS exacto, límites y rate limit. |
| SEC-04 | alto | corregido | `.env` estaba versionado aunque contenía solo configuración pública. | Retirado del índice, plantilla vacía y reglas ignore. |
| SEC-05 | alto | corregido | POST de Meta no comprobaba autenticidad. | HMAC SHA-256 sobre cuerpo crudo antes de parsear. |
| SEC-06 | crítico | corregido | Un miembro podía actualizar su propia fila y cambiar tenant/rol. | Se revocó UPDATE directo y se expuso un RPC limitado a preferencias; regresión intenta tomar otro tenant. |
| SEC-07 | alto | corregido | Un repartidor asignado podía mutar dinero, PII y tenant del pedido. | RLS de escritura solo para managers y RPC de estados/transiciones permitidas; regresión conserva total, PII y tenant. |
| INT-01 | crítico | corregido | `whatsapp_append_turn` era llamado sin contrato restaurable completo. | RPC versionado/forward y regresión de restore. |
| INT-02 | alto | corregido | Append atómico no evitaba turnos simultáneos y side effects desordenados. | Inbox por message ID y lease por conversación. |
| INT-03 | alto | corregido | Dedupe de pedido era SELECT→INSERT (TOCTOU). | Advisory lock transaccional, fingerprint y clave explícita; prueba concurrente. |
| INT-04 | alto | corregido local | Meta puede agrupar entradas/cambios/mensajes. | Parser ordenado, lote completo, retry 500 ante fallo parcial y soak determinista de 25k mensajes. |
| INT-05 | alto | corregido local / pendiente activación | Faltaba un consumidor durable de notificaciones. | Outbox, trigger `nuevo`, dispatcher, retry/backoff/DLQ, workflow cada 5 min y config versionados; faltan deploy/secrets/ejecución observada. |
| INT-06 | alto | corregido | Un retry de Meta podía volver a anexar el mensaje y duplicar callback. | Append-once transaccional y callback único por evento; falta un outbox exact-once para la respuesta saliente. |
| REL-01 | alto | corregido | Fetches a proveedores podían colgar hasta agotar la función. | Máximo 30 s por fetch y presupuesto global de 45 s por turno de agente; pruebas de aborto/clasificación. |
| RATE-01 | alto | corregido local | Endpoints costosos/PII sin cuotas y actor controlable por teléfono/sesión. | RPC atómico por scope/hash y bucket por IP observada; prueba ignora prefijos reenviados manipulables. La confianza real del proxy queda por verificar en hosting. |
| CAT-01 | alto | corregido | Producto nuevo no obtenía disponibilidad en sucursales. | Trigger transaccional crea `branch_products` del mismo tenant. |
| PERF-01 | alto | corregido | Login cargaba todo el panel de 3.23 MB. | Lazy loading por ruta; login aislado a 7.15 kB. |
| PERF-02 | alto | corregido | Ingresos/estadísticas se reducían sobre respuestas truncadas a 1,000 filas. | RPC agregados para tendencias y canales. |
| PERF-03 | medio | parcial | `AdminDashboard` produce ~2.04 MB. | Budget CI de 2.1 MB evita regresión; todavía conviene dividir secciones/importaciones. |
| SA-01 | alto | corregido local | SuperAdmin descargaba filas sin límites y confundía la primera página con el total. | RPC agregados globales, páginas acotadas y regresión con 101 pedidos. |
| CI-01 | alto | corregido | Sin workflows ni scripts de typecheck/test. | Pipeline aplicación+DB y scripts reproducibles. |
| QUAL-01 | medio | pendiente | TypeScript sigue permisivo y lint conserva 34 warnings. | Reducir `any`, activar strict por etapas y resolver dependencias de hooks. |
| OBS-01 | alto | parcial | Faltaban señales y correlación. | Eventos/snapshot/umbrales versionados; conectar alertas/on-call y probarlos fuera del repo. |
| PRIV-01 | alto | corregido local / pendiente legal | Faltaban retención y DSAR ejecutables. | Política configurable, export/erase y regresiones; falta validar consentimiento de audio y política con asesoría. |
| INFRA-01 | alto | no verificable | Backup/restore productivo, HA y secretos reales fuera del checkout. | Simulacro en staging aislado y evidencia firmada. |
| SCM-01 | alto | pendiente | Rama `main` remota sin required checks/protección al consultar GitHub. | Proteger rama y exigir los dos jobs antes de merge. |
| TEST-01 | alto | parcial | Faltaban navegador, batch y carreras. | Smoke CUA local, lote 25k y concurrencia DB; faltan E2E autenticados/proveedores y carga sostenida. |
| AGENT-01 | alto | no verificable | Prompt/modelo efectivo viven parcialmente en proveedor/Vault. | Captura versionada, eval set, métricas de alucinación y handoff humano. |
| MIG-01 | alto | pendiente | La migración forward añadida tiene fecha anterior a migraciones ya presentes en `origin/main`; un reset limpio no simula el ledger remoto. | Inventariar `migration list`, ejecutar `db push --include-all --dry-run` en staging y ensayar backup/rollback antes de cualquier remoto; no usar `repair` a ciegas. |

## Historial de remediación local

- `b910970` — autorización tenant de configuración de voz.
- `bff37d4`, `e168912`, `67238ae` — fundaciones, migración forward, aislamiento y catálogo.
- `3de32ee` — higiene de configuración local.
- `ebdb209`, `f06d59d` — lazy routes y agregados administrativos.
- `1b29ad1` — protección de endpoints públicos y rate limit.
- `c2154a5` — firma/replay/lease de WhatsApp e idempotencia de pedidos.
- `edf114e` — compuertas CI de aplicación y datos.
- `ceb1817`, `9dddfa0` — deadlines de proveedores y tool de sucursal protegida.
- `fc28f5a` — cierre de escalación de membresía/repartidor y reintentos idempotentes.
- `d8337dc` — identidad de rate limit endurecida y deadline global del agente.
- `14ab6f2`–`c27177f` — auth tenant, privacidad, observabilidad, tipos y matriz RBAC.
- `4665b28`, `1cd7226`, `34c2696` — outbox, batch Meta completo y retry de fallos parciales.
- `584d066`, `341f68e` — SuperAdmin agregado/paginado y budgets de rutas.
- `d859e6a` — migración fundacional idempotente y arnés de upgrade fuera de orden.
- `be8895c` — cierre de altos locales detectados por la reauditoría independiente.
- `3bf1d55`, `8715271` — actualización de dependencias/locks sin altas conocidas.
- `c4300d9` — claims justo antes del envío e idempotency key de Resend.
- `cdd5e38` — mapping restaurable de agente, DSAR de voz y ranking global de clientes.

## Decisión de release

**NO-GO a producción.** Los bloqueos locales altos de la última reauditoría quedaron cerrados,
pero para pasar a GO aún se requiere: desplegar/activar el scheduler con secretos rotables y
observar backlog/DLQ; ensayar upgrade, backup y restore en staging; ejecutar E2E con Meta,
OpenRouter, ElevenLabs y Resend; conectar alertas/on-call; proteger `main`; y hacer carga
sostenida. El fence evita que un worker vencido confirme trabajo ajeno, pero no puede deshacer
un WhatsApp que Meta aceptó antes de que el proceso muriera; esa ventana at-least-once debe
aceptarse y monitorizarse o cerrarse con una capacidad idempotente del proveedor. Tampoco se
afirma multitenancy completo del canal WhatsApp mientras su número entrante siga asociado al
tenant piloto por configuración fija.

## Reauditoría independiente final

Un revisor independiente detectó inicialmente siete altos y, tras dos ciclos de corrección,
confirmó **3/3 cerrados** en la última delta: mapping restaurable de agente, borrado DSAR
completo sin colisión de teléfonos legacy y ranking global de clientes. No confirmó ningún
P0/P1/alto local nuevo. Conservó como riesgo explícito la ventana externa de aceptación de
WhatsApp antes del ack local; por eso el veredicto permanece NO-GO hasta staging observado.
