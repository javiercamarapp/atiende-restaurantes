# Auditoría de preparación para demo — 2026-09-04

## Veredicto ejecutivo

El alcance crítico de la demo queda en **GO condicionado**: el código, las funciones de
Supabase, las migraciones y la configuración activa de ElevenLabs pasaron las pruebas
automatizadas y una conversación completa en modo de vista previa. El flujo ya distingue
tacos individuales de órdenes de tres, pide la tortilla por cada estilo de taco, conserva
los complementos y rechaza teléfonos con longitud inválida antes de crear el pedido.

La calificación del alcance demostrado es **9.0/10**. No se declara todavía un 10/10
enterprise: falta una llamada con audio/ASR real, carga sostenida, alertas y on-call
observados, ensayo de backup/restore alojado y cerrar el enlace externo del dominio
`app.useatiende.ai` en la cuenta de Vercel que actualmente posee `useatiende.ai`.

## Alcance y método

- Revisión independiente con tres agentes Astra: frontend, backend/datos y agentes.
- Inspección de los flujos de voz, WhatsApp, creación/cotización de pedidos, notificaciones,
  detalle de pedido, recuperación del frontend, RLS e idempotencia.
- Pruebas unitarias/contrato Deno, TypeScript, lint, chequeo de funciones, build y budgets.
- Despliegue de migraciones y Edge Functions en el proyecto Supabase enlazado.
- Sincronización de tools y prompt del agente activo de ElevenLabs.
- Conversación completa por SDK en modo texto con marcador de vista previa autenticado.

## Hallazgos corregidos en esta ronda

| ID | Severidad | Corrección verificada |
|---|---|---|
| AG-01 | crítico | Se eliminó la variable dinámica obligatoria `modo_prueba`; una sesión pública inicia sin variables del cliente. |
| AG-02 | alto | Pastor acepta cualquier cantidad a precio individual; bistec se ofrece únicamente en múltiplos/órdenes de tres. |
| AG-03 | alto | Se exige tortilla de maíz o harina para cada línea de tacos, incluyendo payloads legacy. |
| AG-04 | alto | Salsa verde, roja, limones y cebolla son incluidos por defecto; habanero y crema de ajo sólo cuando se solicitan. |
| AG-05 | alto | El teléfono se normaliza a diez dígitos; formatos de 11 dígitos inválidos son rechazados. |
| AG-06 | alto | El nombre se confirma y la corrección más reciente sustituye a la anterior. |
| ORD-01 | crítico | Vista previa y pedido real ejecutan la misma validación y cálculo server-side. |
| ORD-02 | alto | La idempotencia rechaza reutilizar la misma clave con contenido distinto mediante conflicto 409. |
| ORD-03 | alto | El `conversation_id` proviene de la variable de sistema de ElevenLabs, se valida y no puede simular fuera de un marcador vigente del mismo agente. |
| ORD-04 | alto | Si el proveedor falla después de crear un pedido, WhatsApp confirma el pedido ya creado en vez de reportarlo como fallido. |
| UI-01 | alto | Detalle y listas muestran error/reintento en vez de spinner infinito o pantalla silenciosa. |
| UI-02 | alto | Notificaciones, contadores de pestaña y campana comparten estado leído en tiempo real; se conservan las últimas 200 por rubro. |
| UI-03 | medio | La recuperación global limpia caches/sesión y reporta el error real; ya no atribuye todos los fallos a una versión antigua. |

## Evidencia reproducible

- `npm run quality`: lint sin errores (36 advertencias heredadas), TypeScript verde,
  **58/58 pruebas Deno**, chequeo de Edge Functions y build Vite verde.
- Budgets: AdminDashboard 346,837/400,000 bytes; SuperAdmin 25,471/30,000;
  chunk de voz 569,086/600,000.
- `git diff --check`: verde.
- Migraciones remotas aplicadas: endurecimiento de sesiones de vista previa y conflicto
  idempotente de pedidos.
- Funciones remotas desplegadas: `agent-config`, `create-order`, `cotizar-pedido`,
  `customer-lookup`, `whatsapp-webhook` y `whatsapp-widget-chat`.
- Sesión pública de ElevenLabs sin `modo_prueba`: inició y respondió correctamente.
- E2E seguro de vista previa: conversación `conv_9301m1q0p597egm9sbtd1ct3avza`.
  Rechazó 11 dígitos, aceptó `9992700899`, cotizó ocho pastor de maíz + dos órdenes
  de bistec de harina + habanero + crema de ajo sin cebolla en **$724**, aceptó tarjeta,
  devolvió `simulated: true` y dejó **0 pedidos reales** para el teléfono QA.

## Cobertura de los 20 rubros

Los rubros 1, 2, 5, 6, 7, 8, 10, 11, 12, 16, 18, 19 y 20 recibieron evidencia directa
en esta ronda. Resiliencia, escalabilidad, privacidad, CI/CD y operatividad (3, 4, 13,
15 y 17) conservan la evidencia de la auditoría enterprise anterior y mejoras puntuales,
pero requieren observación de producción. Cache/CDN e infraestructura (9 y 14) dependen
parcialmente de Vercel y de configuración externa no demostrable sólo desde el repositorio.

## Riesgos y pendientes explícitos

1. Ejecutar una llamada con audio real para medir ASR, interrupciones, latencia y cierre.
2. Vincular `app.useatiende.ai` desde la cuenta/equipo de Vercel propietario del dominio;
   el proyecto enlazado en esta máquina no tiene acceso al dominio. El apex
   `useatiende.ai` se mantiene sin asociar al software para la futura landing.
3. Probar carga sostenida, proveedores reales de WhatsApp y recuperación de backup en
   staging antes de declarar disponibilidad enterprise completa.
4. Conectar alertas, on-call y protección de `main`; reducir las 36 advertencias de lint.

## Decisión de demo

**GO para demo funcional cuando el despliegue frontend termine y pase el smoke de
producción.** El dominio personalizado no debe forzarse desde una cuenta sin propiedad:
esa acción podría desprenderlo de otro proyecto. Mientras se completa la verificación
externa, la URL de Vercel permanece como ruta de contingencia.
