<p align="center">
  <img src="docs/brand/atiende-wordmark.svg" width="240" alt="atiende" />
</p>

<h3 align="center">Agentes de voz y WhatsApp que toman el pedido de un restaurante y lo mandan directo a cocina.</h3>

<p align="center">
  <a href="https://atiende-restaurantes.vercel.app">Demo en vivo</a>
</p>

---

> *Hoy el mesero contesta WhatsApp a mano entre mesas y el pedido se pierde o llega mal
> anotado. El agente confirma la dirección guardada del cliente, arma el pedido contra el
> menú real con precio validado en servidor, y lo manda a cocina antes de colgar.*

---

**Sin menú de opciones fijas, sin plantillas rígidas de WhatsApp: el agente conversa,
recuerda al cliente y nunca inventa un precio.**

## El problema

En México, la mayoría de los restaurantes independientes toma pedidos a domicilio por
teléfono o por WhatsApp operado a mano: un mesero o encargado escribiendo mientras atiende
el salón, sin memoria del cliente entre pedidos, sin verificación de precio contra el menú
real, y sin registro que llegue limpio a cocina. Cuando el volumen sube, esa cadena manual es
la que primero se rompe — pedidos duplicados, direcciones mal copiadas, tiempos de espera que
nadie confirmó.

## Mercado

La industria restaurantera en México representa el 12.2% de todos los negocios del país y
genera poco más de dos millones de empleos; 96 de cada 100 unidades económicas del sector son
microempresas (INEGI–CANIRAC, *Conociendo la industria restaurantera*). Es, casi en su
totalidad, el tipo de negocio operado directamente por su dueño o un equipo pequeño — el
perfil que hoy resuelve sus pedidos a mano por teléfono o WhatsApp, y el que este agente
atiende primero.

## Qué hace hoy

- **Backend real en Supabase**: menú con 245 productos reales (incluye kilos a domicilio con
  precio ya calculado por 250 g / 500 g / 750 g / 1 kg), 7 sucursales, memoria de clientes
  (`customers` + `customer_addresses`) y pedidos con precio siempre recalculado server-side
  (`cotizar-pedido`), nunca confiado al mensaje del cliente ni al agente.
- **Agente de voz** (ElevenLabs Conversational AI): prompt y contrato de herramientas
  versionados en `docs/agente-voz/system-prompt.md`.
- **Agente de WhatsApp** (Meta Cloud API + OpenRouter): `supabase/functions/whatsapp-webhook`,
  con memoria de cliente inyectada en cada turno — saluda, confirma dirección guardada, arma
  el pedido, recuerda qué incluye, da el total y el tiempo de espera.
- **Sitio de pedidos + panel admin/repartidor**: heredado del piloto original de Taquitos DPM
  (Vite + React + shadcn/ui), recoloreado a la paleta de este producto (blanco / azul / azul
  cielo) siguiendo la disciplina de diseño documentada en Likida, no su paleta literal.

## Stack

Frontend: Vite + React + TypeScript + shadcn/ui + Tailwind
Backend: Supabase (Postgres + RLS + Edge Functions en Deno)
Voz: ElevenLabs Conversational AI
WhatsApp: Meta Cloud API + OpenRouter

## Estado

Piloto real en producción con **Los Taquitos de PM** (7 sucursales, Mérida) — no es todavía
un producto vendido a otros restaurantes. El código, las pruebas y la operación (voz +
WhatsApp + panel) corren contra ese único cliente hoy; la siguiente vertical no arranca hasta
que este piloto esté sólido de punta a punta.

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
