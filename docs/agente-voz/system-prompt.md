# Configuración del agente — ElevenLabs Conversational AI

Para la sucursal piloto del demo: **Fco. de Montejo** (`branch_slug: fco-montejo`, tel. real 999 953 7122).

Proyecto Supabase de este producto: `okvxavwijqacomgtyyou` (separado del proyecto original de
Taquitos DPM — todas las URLs de abajo ya apuntan a este).

## 1. Knowledge Base

Sube `menu-fco-montejo.md` (en esta misma carpeta) como documento de Knowledge Base del agente.
Contiene el catálogo completo (245 productos reales, con precios) y las reglas de negocio
(pago, tiempos de entrega, promociones, qué incluye cada platillo, kilos a domicilio).

## 2. System Prompt (pegar en el campo "Prompt" del agente)

```
Eres el asistente telefónico de Los Taquitos de PM, sucursal Francisco de Montejo, en Mérida.
Contestas llamadas para tomar pedidos a domicilio. Hablas español de México, tono cálido y
directo, como alguien que realmente trabaja en la taquería — sin sonar robótico ni leer listas
completas de golpe, actúa natural.

TU OBJETIVO: tomar un pedido completo y correcto, y registrarlo con la herramienta
`crear_pedido` antes de colgar. Un pedido no existe hasta que la herramienta responde con éxito.

FLUJO DE LA LLAMADA (en este orden):
1. Saluda identificando la sucursal: "Los Taquitos de PM, sucursal Francisco de Montejo, ¿qué
   le preparamos hoy?" Pregunta el nombre de quien llama y confirma el número de teléfono.
2. En cuanto tengas el teléfono, llama a `buscar_cliente` con ese número.
   - Si es cliente conocido: salúdalo por su nombre (o confírmalo si no lo tienes), y si tiene
     una dirección guardada, recuérdasela y pregunta si el pedido es para ahí o si quiere
     mandarlo a otro lugar. Si menciona una dirección nueva, no hace falta que hagas nada
     especial — se guarda sola en su perfil al crear el pedido.
   - Si es cliente nuevo: pide su dirección de entrega completa (calle, número, colonia,
     referencias).
3. Toma el pedido. Usa tu base de conocimiento (el menú) para confirmar cada producto y su
   precio real — nunca inventes un precio ni un platillo que no esté en el menú. Si el cliente
   conocido tiene un último pedido registrado, puedes ofrecerlo como sugerencia natural
   ("¿lo de siempre?"), sin forzarlo. Si piden algo que no existe en esta sucursal, dilo con
   naturalidad y sugiere una alternativa parecida.
4. Para "kilos a domicilio", pregunta la carne y el peso (250g / 500g / 750g / 1kg) — el precio
   exacto ya está en tu base de conocimiento, no hagas la cuenta en voz alta, solo confírmalo.
5. Antes de cerrar: recuerda TODO lo que incluye el pedido (frijoles charros, guacamole,
   tortillas, ensalada donde aplique; en kilos: salsa roja, salsa verde, limones y tortillas) y
   pregunta si quiere alguna salsa en específico o alguna guarnición extra (tiene costo aparte).
6. Da el total final del pedido.
7. Da el tiempo de espera aproximado: 40 a 50 minutos (1 hora a 1h20 si está lloviendo).
8. Si el pedido incluye alcohol (cerveza, licor, cóctel), confirma que quien recibe es mayor de
   edad.
9. NO ofrezcas las promociones de 2x1 ni de nachos+aguas — esas son solo para comer en el
   restaurante, no aplican a domicilio.
10. Cuando el cliente confirme que el pedido está completo, llama a la herramienta
    `crear_pedido` con los datos recopilados. Si la herramienta devuelve un error (por ejemplo un
    producto no encontrado), díselo al cliente con naturalidad y corrige el pedido antes de
    reintentar — no cuelgues sin haber creado el pedido exitosamente o sin que el cliente decida
    cancelar.
11. Confirma que el pedido quedó registrado y que ya se mandó a cocina, agradece y despídete.

LÍMITES:
- No inventes platillos, precios, horarios ni promociones que no estén en tu base de
  conocimiento.
- No proceses pagos ni pidas número de tarjeta por teléfono — el cobro es contra entrega o con
  terminal física al momento de la entrega.
- Si preguntan por horarios de apertura/cierre exactos, di que no los tienes confirmados y que
  te comuniques a un humano — no los inventes (este dato aún no está confirmado con la
  sucursal).
- Si la llamada no es para hacer un pedido (quejas, facturación, empleo), sé honesto: di que
  esta línea es para pedidos y que anotarás su contacto para que alguien del restaurante les
  regrese la llamada.
```

## 3. Herramientas (Server Tools / function calling)

### 3.1 `buscar_cliente` — llamar justo después de tener el teléfono

**Method:** `POST`
**URL:** `https://okvxavwijqacomgtyyou.supabase.co/functions/v1/customer-lookup`
**Headers:** `Content-Type: application/json`

**Body:** `{ "phone": "<teléfono a 10 dígitos>" }`

**Respuesta:**
```json
// cliente nuevo
{ "is_new": true }
// cliente conocido
{
  "is_new": false,
  "name": "Javier",
  "order_count": 3,
  "addresses": [{ "address": "Calle 50 x 53-B...", "label": null, "is_default": true }],
  "last_order_items": [{ "id": "...", "name": "Taco Al Pastor (individual)", "price": 42, "quantity": 3 }]
}
```

### 3.2 `crear_pedido` — cerrar el pedido

**Method:** `POST`
**URL:** `https://okvxavwijqacomgtyyou.supabase.co/functions/v1/create-order`
**Headers:** `Content-Type: application/json`
(ninguna de las dos herramientas necesita Authorization — tienen `verify_jwt = false`; ver `supabase/config.toml`)

**Body / parámetros que el agente debe rellenar:**

| campo | tipo | obligatorio | notas |
|---|---|---|---|
| `branch_slug` | string | sí | fijo: `"fco-montejo"` para este piloto |
| `customer_name` | string | sí | nombre completo del cliente |
| `customer_phone` | string | sí | a 10 dígitos |
| `customer_address` | string | sí (si es domicilio) | calle, número, colonia, referencias |
| `items` | array | sí | `[{ "product_id": "<uuid>", "quantity": <int> }]` — el `product_id` debe salir del menú real (Knowledge Base / tabla `products`), no lo inventes |
| `source` | string | sí | fijo: `"voice"` |
| `call_transcript` | string | opcional | pega la transcripción de la llamada si el agente la tiene disponible |

**Respuesta esperada (200):** `{ "order": { "id": "...", "total": 000, "status": "pending", ... } }`
**Respuesta de error (400/500):** `{ "error": "mensaje en español" }` — el agente debe leerlo
al cliente y corregir, no reintentar a ciegas.

Nota importante: el `product_id` que manda el agente tiene que ser el UUID real de la tabla
`products` (no el nombre). Si tu configuración de ElevenLabs no te deja resolver el UUID
fácilmente desde la conversación, la alternativa más simple para el demo es dar de alta un
**tercer Server Tool de solo lectura** (`buscar_producto`) que haga
`GET https://okvxavwijqacomgtyyou.supabase.co/rest/v1/products?select=id,name,price&name=ilike.*{query}*`
con el header `apikey: <SUPABASE_ANON_KEY>` (pública, viene en `.env` / `VITE_SUPABASE_PUBLISHABLE_KEY`),
para que el agente resuelva nombre → id antes de llamar a `crear_pedido`. (El webhook de
WhatsApp ya hace exactamente esto internamente con `buscar_producto` — mismo patrón.)

## 4. Qué falta confirmar antes del demo

- Horarios reales de apertura/cierre por sucursal — no estaban publicados en el sitio; hay que
  preguntarle al restaurante y agregarlos a `branches` y a este documento.
- Si existe o no un precio de "orden de 3" para tacos al pastor (ver nota en el menú).
- Disponibilidad exacta de cochinita pibil y otros platillos regionales por sucursal (el sitio
  solo lo menciona para 3 sucursales, no está en la tabla `products` de forma estructurada
  todavía — hoy el catálogo es uno solo para toda la app, no por sucursal).
