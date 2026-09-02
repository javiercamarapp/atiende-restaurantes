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
- **Agente de WhatsApp** (Twilio Sandbox + Claude): `supabase/functions/whatsapp-webhook`,
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
WhatsApp: Twilio + Claude (Anthropic)

## Desarrollo local

```bash
npm install
npm run dev
```

Variables de entorno en `.env` (ya apuntan al proyecto Supabase de este producto, separado
del proyecto original de Taquitos DPM).

## Documentación

- `docs/agente-voz/system-prompt.md` — prompt y contrato de la herramienta del agente de voz
- `docs/agente-voz/menu-fco-montejo.md` — base de conocimiento del menú real
- `docs/agente-voz/whatsapp-setup.md` — cómo levantar el sandbox de WhatsApp
- `supabase/migrations/` — esquema completo (branches, productos, clientes, pedidos, conversaciones de WhatsApp)
