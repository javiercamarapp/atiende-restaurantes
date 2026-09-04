# atiende.ai para restaurantes

Vertical de restaurantes de **atiende.ai** — el mismo tipo de agente de IA que opera un
negocio 24/7 por voz y WhatsApp, aplicado a toma de pedidos, memoria de clientes y
despacho a cocina. Piloto: **Los Taquitos de PM** (7 sucursales, Mérida).

No es un chatbot de menú fijo: el agente identifica al cliente por teléfono, recuerda su
nombre y direcciones guardadas, arma el pedido contra el menú real (con precio validado en
servidor, nunca inventado), recomienda de forma natural, y el pedido cae directo al panel de
cocina — todo antes de colgar o cerrar el chat.

## Qué hay hoy

- **Backend real en Supabase**: menú (245 productos reales, incluye kilos a domicilio con
  precio ya calculado por 250g/500g/750g/1kg), 7 sucursales, memoria de clientes
  (`customers` + `customer_addresses`), pedidos con precio recalculado server-side.
- **Agente de voz** (ElevenLabs Conversational AI): prompt y contrato de herramientas listos
  en `docs/agente-voz/system-prompt.md`.
- **Agente de WhatsApp** (Meta Cloud API + OpenRouter): `supabase/functions/whatsapp-webhook`,
  con memoria de cliente inyectada en cada turno — saluda, confirma dirección guardada, arma
  el pedido, recuerda qué incluye, da el total y el tiempo de espera.
- **Sitio de pedidos + panel admin/repartidor**: heredado del piloto original de Taquitos DPM
  (Vite + React + shadcn/ui), recoloreado a la paleta de este producto (blanco / azul / azul
  cielo) siguiendo la disciplina de diseño documentada en Likida (proyect-x-), no su paleta
  literal.

## Stack

Frontend: Vite + React + TypeScript + shadcn/ui + Tailwind
Backend: Supabase (Postgres + RLS + Edge Functions en Deno)
Voz: ElevenLabs Conversational AI
WhatsApp: Meta Cloud API + OpenRouter

## Desarrollo local

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run dev
```

Copia `.env.example` a `.env` y completa únicamente credenciales del entorno local. `.env`
no se versiona. Los secretos de proveedores viven en Supabase Vault o en secretos de Edge
Functions, nunca en variables `VITE_*` ni en el repositorio.

## Compuertas locales

```bash
npm run quality
supabase start
supabase db reset --local --no-seed
npm run test:db
```

`quality` ejecuta lint, typecheck, pruebas unitarias Deno y build de producción. `test:db`
comprueba aislamiento de tenants, rate limiting, entrega de WhatsApp, idempotencia serial y
concurrente de pedidos, y agregados administrativos. El mismo flujo está versionado en
`.github/workflows/quality.yml`.

## Documentación

- `docs/agente-voz/system-prompt.md` — prompt y contrato de la herramienta del agente de voz
- `docs/agente-voz/menu-fco-montejo.md` — base de conocimiento del menú real
- `docs/agente-voz/whatsapp-setup.md` — contrato y configuración segura de Meta Cloud API
- `docs/runbooks/operacion.md` — restauración, incidentes e integraciones
- `docs/audits/enterprise-remediation-2026-09-04.md` — auditoría y evidencia reproducible
- `supabase/migrations/` — esquema completo (branches, productos, clientes, pedidos, conversaciones de WhatsApp)
