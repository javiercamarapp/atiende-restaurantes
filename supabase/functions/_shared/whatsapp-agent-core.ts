// Cerebro compartido del agente conversacional de WhatsApp — mismo prompt,
// mismas tools (buscar_producto/crear_pedido/registrar_contacto) y mismo
// loop de tool-use contra OpenRouter que usaba antes whatsapp-webhook en
// solitario. Se extrajo aquí para que whatsapp-webhook (canal real de
// Twilio) y whatsapp-widget-chat (widget de la página pública/demo) compartan
// EXACTAMENTE la misma lógica — igual que create-order-core.ts ya es
// compartido entre create-order, whatsapp-webhook y el agente de voz.
//
// La personalización real (system prompt, tono, modelo, temperatura) ya NO
// vive fija en este archivo: se lee en vivo de la tabla
// `whatsapp_agent_config` (una fila por restaurante, editable desde el admin
// en WhatsAppAgenteConfigSection.tsx) en cada turno vía getAgentConfig(). Si
// la tabla no tiene fila para el restaurante (o falla la lectura), se cae en
// FALLBACK_CONFIG — el mismo BASE_SYSTEM_PROMPT/modelo/temperatura que corría
// hardcodeado antes, para que nunca se rompa una conversación por eso.
//
// Setup needed (Supabase project secrets):
//   OPENROUTER_API_KEY                   - de openrouter.ai
//   OPENROUTER_MODEL (opcional)          - default: google/gemini-2.5-flash-lite
//   OPENROUTER_MODEL_ESCALADO (opcional) - default: openai/gpt-5.4-mini

// deno-lint-ignore-file no-explicit-any
import { createOrderCore, OrderValidationError, tokenizeForProductSearch, vipNote } from "./create-order-core.ts";

// OPENROUTER_API_KEY vive en Supabase Vault (mismo mecanismo real que
// ELEVENLABS_API_KEY y las credenciales de WhatsApp Cloud API) — no como
// Edge Function secret real, porque no hay ninguna herramienta MCP
// disponible para configurar esos. Se lee vía la función SQL get_secret()
// que el proyecto ya tenía. Ver supabase-vault-vs-edge-function-secrets.
async function getOpenRouterKey(supabase: any): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_secret", { secret_name: "OPENROUTER_API_KEY" });
  if (error) {
    console.error("get_secret(OPENROUTER_API_KEY) falló:", error);
    return null;
  }
  return (data as string | null) ?? null;
}

export const MODEL_DEFAULT = Deno.env.get("OPENROUTER_MODEL") ?? "google/gemini-2.5-flash-lite";
export const MODEL_ESCALADO = Deno.env.get("OPENROUTER_MODEL_ESCALADO") ?? "openai/gpt-5.4-mini";
export const RESTAURANT_ID = "be3fbdeb-80e7-4e7b-9b44-22b476c08298";

// Los 4 estilos de tono reales que ofrece el selector del admin — deben
// coincidir 1:1 con el CHECK de la columna tone_style en la migración
// 20260903130000_whatsapp_agent_config.sql y con TONE_STYLE_OPTIONS en
// WhatsAppAgenteConfigSection.tsx. Se inyectan siempre como una línea de
// instrucción aparte, para poder ajustar el tono desde un selector sin tener
// que editar (y arriesgar romper) el prompt libre completo.
export const TONE_INSTRUCTIONS: Record<string, string> = {
  calido_cercano: "Cálido y cercano: como el encargado de confianza de la sucursal que ya conoce al cliente — cercano mexicano, sin ser cursi.",
  formal_directo: "Formal y directo: cortés y profesional, sin diminutivos ni emojis, va al grano en cada mensaje.",
  profesional_neutro: "Profesional y neutro: correcto y claro, ni muy formal ni muy relajado — como una línea de atención a clientes seria.",
  divertido_desenfadado: "Divertido y desenfadado: relajado, con humor ligero y algún emoji ocasional, sin dejar de ser claro con los datos del pedido.",
};

export type WhatsAppAgentConfig = {
  system_prompt: string;
  tone_style: string;
  llm_model: string;
  temperature: number;
};

export const BASE_SYSTEM_PROMPT = `Eres el asistente de WhatsApp de Los Taquitos de PM, una taquería con varias sucursales en Mérida.
Tomas pedidos a domicilio por chat. Tono cálido, directo, mensajes cortos (esto es WhatsApp, no una carta), actúa natural — no leas listas completas de golpe, ve conversando.

SUCURSALES REALES (usa esto para decidir cuál está más cerca de la dirección del cliente — nunca inventes otra sucursal ni otro slug):
- Altabrisa (branch_slug: "altabrisa") — norte de Mérida, dentro de Plaza Victory Altabrisa, zona Altabrisa/Temozón.
- García Lavín (branch_slug: "garcia-lavin") — San Ramón Norte.
- Prol. Montejo (branch_slug: "prol-montejo") — Emiliano Zapata Norte / Prolongación Montejo.
- Fco. de Montejo (branch_slug: "fco-montejo") — Fraccionamiento Francisco de Montejo, extremo norponiente.
- Galerías (branch_slug: "galerias") — Col. Revolución/Cordemex, dentro de Plaza Galerías Mérida, cerca del periférico norte.
- Pensiones (branch_slug: "pensiones") — Residencial Pensiones, cerca de Plaza Las Américas, zona centro-sur.
- Chicxulub (branch_slug: "chicxulub") — Chicxulub Puerto, en la costa (sólo si el cliente está en Chicxulub o el puerto, no en Mérida ciudad).

REGLAS DE NEGOCIO:
- Formas de pago: tarjeta (pide la terminal al momento del pedido) o contra entrega. No proceses pagos ni pidas número de tarjeta por chat. Si el cliente comparte un número de tarjeta de todos modos, dile explícitamente que no lo necesitas y que no se guarda — nunca lo repitas, confirmes ni lo uses para nada.
- Tiempo de entrega: 40 a 50 minutos (1h a 1h20 si llueve).
- Las promos de 2x1 y nachos+aguas son SOLO para comer en el restaurante — nunca las ofrezcas para domicilio.
- Los "kilos a domicilio" incluyen salsa roja, salsa verde, limones y tortillas sin costo extra.
- No inventes productos ni precios: usa siempre la herramienta buscar_producto para confirmar nombre/precio real antes de agregar algo al pedido. Puedes recomendar productos populares o combinaciones típicas si el cliente no sabe qué pedir.
- No vendas cantidades sueltas de un producto marcado "(orden de N)" — es un paquete fijo, no piezas individuales (ver paso 4).
- Si dice "(1/2 orden)", es una versión de medio paquete que ya existe como su propio producto — ofrécela si el cliente quiere menos cantidad en vez de inventar una fracción tú mismo.
- Si piden algo que no existe en el menú, dilo con naturalidad y sugiere algo parecido.
- Si el pedido incluye alcohol (cerveza, licor, cóctel): antes de agregarlo, pregunta directo si quien recibe es mayor de edad y espera un sí/no claro. Si la respuesta es evasiva o ambigua ("no sé", "seguro alguien mayor abre"), vuelve a preguntar de forma directa — nunca sigas adelante sin una confirmación clara, y NUNCA digas que el producto no está disponible como pretexto para evitar la pregunta; sé honesto sobre por qué preguntas.
- No inventes horarios de apertura/cierre — ese dato no está confirmado todavía.
- No inventes sucursales ni branch_slugs que no estén en la lista de arriba.
- Si el mensaje NO es para hacer un pedido (queja, facturación, empleo, u otro motivo que no sea ordenar comida): sé honesto, di que este número es para pedidos, pide su nombre si no lo tienes, y llama a registrar_contacto con nombre, motivo y un resumen breve de lo que dijo — así alguien del restaurante le contesta de verdad, no lo prometas sin registrarlo. Usa exactamente el nombre que el cliente te dio en ESTE chat para registrar_contacto — nunca inventes o supongas un nombre que no te haya dado.
- Si el cliente pide que le entregue un repartidor específico (por nombre o "el de siempre"), sé honesto de inmediato: no hay forma de elegir o garantizar qué repartidor hace la entrega — dilo con naturalidad en vez de decir "ya lo anoté" o "se lo hago saber", porque esa preferencia no queda guardada en ningún lado y sería una promesa falsa.
- Si crear_pedido devuelve un error para un producto que ya confirmaste con buscar_producto (ej. "producto no disponible"), no lo repitas como excusa fabricada ("el sistema lo marca no disponible") sin haberlo vuelto a confirmar: llama a buscar_producto de nuevo para ese producto antes de reintentar crear_pedido. Si sigue fallando después de eso, sé honesto con el cliente ("se me está atorando este producto en el sistema, ¿lo dejamos fuera o lo intentamos de nuevo en un momento?") en vez de inventar un motivo o quitarlo del pedido sin decírselo con claridad.
- REGLA DURA: si en esta MISMA conversación ya llamaste a crear_pedido y te respondió con éxito (un pedido real), NUNCA vuelvas a llamarla otra vez — ni si el cliente pregunta "¿ya quedó mi pedido?", ni si manda un mensaje confuso o repite algo, ni por ningún motivo. Solo repítele el resumen del pedido que ya se creó y confírmale que sigue en camino. Llamar crear_pedido dos veces crea un pedido real duplicado en cocina.

FLUJO DE LA CONVERSACIÓN (en este orden):
1. Saluda presentándote como Los Taquitos de PM (sin mencionar sucursal todavía — aún no la sabes) y pregunta si quiere hacer un pedido. En cuanto confirme que sí, pregunta el nombre de quien pide (el número de WhatsApp ya lo tienes, no lo vuelvas a pedir). En cuanto el cliente te dé su nombre en este chat, no se lo vuelvas a pedir más adelante — ya lo tienes.
2. Dirección: si el CONTEXTO DEL CLIENTE de abajo trae una dirección guardada, recuérdasela y pregunta si el pedido es para ahí o si quiere mandarlo a otro lugar (si da una nueva, se guarda sola en su perfil al cerrar el pedido — no hace falta que hagas nada extra). Si es cliente nuevo o no tiene dirección guardada, pídesela.
3. En cuanto tengas la dirección/colonia, llama a buscar_sucursal_cercana con esa colonia/zona para obtener la sucursal real más cercana por distancia calculada — NUNCA decidas tú "a ojo" cuál está más cerca. Si la colonia no es clara, pregunta la colonia o una referencia cercana ANTES de llamar la herramienta. Si responde encontrada:false, pide otra referencia (colonia vecina, cruce de calles, plaza conocida) e inténtalo de nuevo — no adivines. Dile al cliente de qué sucursal va a salir su pedido y confirma que está bien. Si el cliente prefiere que se lo mandes desde otra sucursal (por ejemplo, porque le queda mejor otra zona que conoce), no insistas en que sea forzosamente la más cercana — acepta con gusto cualquiera de las sucursales reales de la lista de arriba que el cliente prefiera, y sigue con esa.
4. Toma el pedido: ve agregando productos, confirmando cada uno con buscar_producto (pásale siempre el branch_slug de la sucursal que ya confirmaste en el paso 3 — el precio real varía por sucursal). Si el CONTEXTO trae su último pedido, puedes ofrecer "¿lo de siempre?" como sugerencia natural, no como obligación.
   - IMPORTANTE: lee bien el nombre exacto que devuelve buscar_producto — si dice "(orden de N)" (ej. "Tacos de Bistec de Res (orden de 3)"), es un paquete fijo indivisible de N piezas, no piezas sueltas, y el precio ya es el del paquete completo. Si el cliente pide una cantidad de ese sabor que no es múltiplo de N, DILO EXACTAMENTE ASÍ, sin dar vueltas: "ese taco solo se vende en órdenes de [N] tacos" (usa el número real N que trajo buscar_producto para ese sabor), da el precio real del paquete completo, y ofrécele ajustar a un múltiplo de N o cambiar a un sabor "(individual)" (ese sí se vende por pieza suelta).
   - Si buscar_producto devuelve más de un producto real parecido a lo que pidió el cliente (ej. "Guacamole" el platillo completo vs. "Extra Guacamole" la porción chica) y no está claro cuál quiere, no elijas tú solo — dile los nombres y precios de las opciones y que el cliente escoja.
   - Si el cliente pide alguna instrucción especial para algún producto o para el pedido (ej. "sin cebolla", "que no pique", "toca el timbre y no el interfón"), guárdala tal cual la dijo en el parámetro notes de crear_pedido — no basta con repetirla en el chat, tiene que quedar en el pedido para que cocina/repartidor la vean. Confírmale al cliente que la anotaste.
5. Antes de cerrar: pregunta si quiere agregar algo extra — frijoles charros, guacamole, tortillas, ensalada o alguna salsa en específico. Ninguno de estos viene incluido gratis con los tacos, son productos aparte con su propio costo (confirma nombre y precio real con buscar_producto si el cliente quiere alguno). La única excepción son los "kilos a domicilio": esos SÍ incluyen salsa roja, salsa verde, limones y tortillas sin costo extra — no lo confundas con los pedidos de tacos normales.
6. Da el total final del pedido, y pregunta cómo va a pagar: efectivo o tarjeta. Si dice tarjeta, confírmale que llevaremos a alguien con terminal física al momento de la entrega.
7. En cuanto tengas la forma de pago, sin decir nada más del pedido todavía (nunca menciones el tiempo de espera antes de esto): llama a crear_pedido con los product_id reales (no nombres), el branch_slug de la sucursal que confirmaste en el paso 3, el parámetro payment_method con exactamente "efectivo" o "tarjeta" según lo que confirmó el cliente en este mismo paso, y el parámetro notes si el cliente dio alguna instrucción especial — este es el paso más importante, un pedido no existe hasta que la herramienta responde con éxito. No llames a crear_pedido si todavía falta nombre, dirección, sucursal o confirmación del cliente.
8. Si crear_pedido devuelve un error, explícaselo al cliente en una frase simple y corrige — no sigas adelante sin que haya quedado creado con éxito.
9. Solo hasta que el pedido ya quedó creado con éxito: confirma que ya se mandó a cocina y da el tiempo de espera aproximado (40-50 min, o 1h-1h20 si llueve).`;

// Mismo valor que corría hardcodeado antes de que existiera la tabla — se
// usa si `whatsapp_agent_config` todavía no tiene fila para el restaurante,
// o si la lectura falla por cualquier motivo (nunca se cae la conversación
// por un problema de configuración).
export const FALLBACK_CONFIG: WhatsAppAgentConfig = {
  system_prompt: BASE_SYSTEM_PROMPT,
  tone_style: "calido_cercano",
  llm_model: MODEL_DEFAULT,
  temperature: 0.7,
};

export async function getAgentConfig(supabase: any, restaurantId: string): Promise<WhatsAppAgentConfig> {
  try {
    const { data, error } = await supabase
      .from("whatsapp_agent_config")
      .select("system_prompt, tone_style, llm_model, temperature")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (error || !data) {
      if (error) console.error("whatsapp_agent_config: no se pudo leer, usando fallback:", error);
      return FALLBACK_CONFIG;
    }
    return {
      system_prompt: data.system_prompt || FALLBACK_CONFIG.system_prompt,
      tone_style: data.tone_style || FALLBACK_CONFIG.tone_style,
      llm_model: data.llm_model || FALLBACK_CONFIG.llm_model,
      temperature: typeof data.temperature === "number" ? data.temperature : FALLBACK_CONFIG.temperature,
    };
  } catch (err) {
    console.error("whatsapp_agent_config: excepción al leer, usando fallback:", err);
    return FALLBACK_CONFIG;
  }
}

// Formato OpenAI/OpenRouter: los tools van bajo function.parameters, no
// input_schema directo como en la API de Anthropic.
export const TOOLS = [
  {
    type: "function",
    function: {
      // Bug alto confirmado en la auditoría adversarial del 3-sep-2026: la
      // sucursal "más cercana" se decidía a ojo por el LLM sin ningún dato
      // geográfico real — falló 3 de 4 colonias reales probadas (hasta ~2x
      // más lejos). Este tool llama a sucursal_mas_cercana() (distancia
      // Haversine real sobre lat/lng reales de branches) en vez de adivinar.
      name: "buscar_sucursal_cercana",
      description: "Dado el nombre de una colonia/zona/referencia que dio el cliente, devuelve la sucursal real MÁS CERCANA calculada por distancia real (no adivines tú cuál está más cerca). Llámala en cuanto tengas la colonia o una referencia clara, antes de decirle al cliente de qué sucursal va a salir su pedido.",
      parameters: {
        type: "object",
        properties: {
          colonia: { type: "string", description: "La colonia, zona o referencia que dio el cliente, tal cual (ej. 'Cholul', 'cerca de Plaza Las Américas'). Puede ser una frase, no hace falta que sea solo el nombre exacto." },
        },
        required: ["colonia"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_producto",
      description: "Busca productos del menú real de la sucursal por nombre o palabra clave. Devuelve id, nombre y precio real de esa sucursal (el precio varía por sucursal).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "texto a buscar, ej. 'pastor' o 'kilo arrachera'" },
          branch_slug: { type: "string", description: "El branch_slug de la sucursal ya confirmada en el paso 3. Si todavía no se confirma la sucursal, no llames esta herramienta." },
        },
        required: ["query", "branch_slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crear_pedido",
      description: "Registra el pedido final en el sistema. Solo llamar cuando el cliente ya confirmó todo, incluyendo la sucursal.",
      parameters: {
        type: "object",
        properties: {
          branch_slug: { type: "string", description: "El branch_slug real de la sucursal más cercana, de la lista de sucursales del prompt." },
          customer_name: { type: "string" },
          customer_address: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_id: { type: "string" },
                quantity: { type: "integer" },
              },
              required: ["product_id", "quantity"],
            },
          },
          notes: { type: "string", description: "Instrucciones especiales del cliente para este pedido, tal cual las dijo (ej. 'sin cebolla en los tacos de bistec', 'tocar el timbre, no el intercomunicador'). Opcional — solo si el cliente pidió algo especial." },
          payment_method: { type: "string", enum: ["efectivo", "tarjeta"], description: "Forma de pago que confirmó el cliente en el paso 6 — efectivo o tarjeta." },
        },
        required: ["branch_slug", "customer_name", "customer_address", "items", "payment_method"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_contacto",
      description: "Registra nombre/motivo de un mensaje que NO es para hacer un pedido, para que alguien del restaurante le regrese la llamada. Nunca usar para pedidos normales.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string" },
          reason: { type: "string", description: "Motivo breve, ej. 'queja', 'facturación', 'empleo'." },
          message: { type: "string", description: "Resumen breve de lo que dijo el cliente." },
        },
        required: ["customer_name", "reason"],
      },
    },
  },
];

export function customerContextBlock(customer: any): string {
  if (customer.is_new) {
    return "Cliente nuevo — nunca ha pedido antes por este número. Pide su nombre y su dirección de entrega; se guardan solos en su perfil al cerrar el pedido, no hace falta hacer nada extra.";
  }
  const lines: string[] = [];
  lines.push(`Cliente conocido${customer.name ? `: ${customer.name}` : " (sin nombre guardado todavía — pídeselo)"}.`);
  lines.push(`Ha pedido ${customer.order_count} ${customer.order_count === 1 ? "vez" : "veces"} antes.`);
  const nota = vipNote(customer.tier ?? null);
  if (nota) lines.push(nota);
  if (customer.addresses?.length) {
    const def = customer.addresses.find((a: { is_default: boolean }) => a.is_default) ?? customer.addresses[0];
    lines.push(`Dirección guardada por defecto: "${def.address}".`);
    if (customer.addresses.length > 1) {
      lines.push(`También tiene otras direcciones guardadas: ${customer.addresses.slice(1).map((a: { address: string }) => `"${a.address}"`).join(", ")}.`);
    }
  } else {
    lines.push("No tiene dirección guardada todavía — pídesela.");
  }
  if (customer.last_order_items?.length) {
    const items = customer.last_order_items.map((i: { name: string; quantity: number }) => `${i.quantity}x ${i.name}`).join(", ");
    lines.push(`Su último pedido fue: ${items}.`);
  }
  if (customer.frequent_items?.length) {
    const items = customer.frequent_items.map((i: { name: string; quantity: number }) => i.name).join(", ");
    lines.push(`Lo que más pide (across todo su historial real, no solo el último pedido): ${items}. Puedes ofrecer "¿lo de siempre?" con confianza usando esto, incluso si su último pedido fue distinto.`);
  } else if (customer.last_order_items?.length) {
    lines.push(`Puedes usar su último pedido para sugerir "¿lo de siempre?" si aplica.`);
  }
  return lines.join("\n");
}

export async function runAgentTurn(
  supabase: any,
  messages: any[],
  phone: string,
  customer: any,
  restaurantId: string,
): Promise<{ reply: string; updatedMessages: typeof messages; orderId: string | null; branchId: string | null }> {
  let orderId: string | null = null;
  let branchId: string | null = null;
  let huboFalloDeHerramienta = false; // dispara el escalón caro en el siguiente turno
  // Config real leída en vivo de whatsapp_agent_config (con fallback si la
  // fila no existe todavía o falla la lectura) — prompt, tono, modelo y
  // temperatura, todos editables desde el admin sin tocar código.
  const agentConfig = await getAgentConfig(supabase, restaurantId);
  const systemPrompt = `${agentConfig.system_prompt}\n\nTONO DE VOZ REQUERIDO: ${TONE_INSTRUCTIONS[agentConfig.tone_style] ?? TONE_INSTRUCTIONS.calido_cercano}\n\nCONTEXTO DEL CLIENTE (no lo repitas literal, úsalo para hablarle natural):\n${customerContextBlock(customer)}`;
  const openRouterKey = await getOpenRouterKey(supabase);
  if (!openRouterKey) {
    return { reply: "Ahorita tenemos un problema técnico, por favor intenta de nuevo en un momento.", updatedMessages: messages, orderId, branchId };
  }

  for (let turn = 0; turn < 4; turn++) {
    // El escalón caro de respaldo (MODEL_ESCALADO, fijo por env var) sigue
    // rescatando un fallo real de herramienta sin importar qué modelo haya
    // elegido el admin como principal — agentConfig.llm_model solo decide
    // el modelo del turno normal.
    const modeloDeEsteTurno = huboFalloDeHerramienta ? MODEL_ESCALADO : agentConfig.llm_model;
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${openRouterKey}`,
        "HTTP-Referer": "https://atiende-restaurantes.vercel.app",
        // "atiende.ai — Los Taquitos de PM" (con em dash) rompía CADA llamada
        // real a OpenRouter: los headers HTTP deben ser ByteString ASCII, y
        // el "—" no lo es — fetch() lanzaba "not a valid ByteString" antes
        // de siquiera salir la petición (bug real, ya estaba en el código
        // anterior de whatsapp-webhook; se descubrió aquí al probar el
        // widget de punta a punta). Guion normal, sin acentos ni rayas.
        "X-Title": "atiende.ai - Los Taquitos de PM",
      },
      body: JSON.stringify({
        model: modeloDeEsteTurno,
        max_tokens: 1024,
        temperature: agentConfig.temperature,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        tools: TOOLS,
      }),
    });

    if (!res.ok) {
      console.error("OpenRouter API error:", await res.text());
      return { reply: "Ahorita tenemos un problema técnico, por favor intenta de nuevo en un momento.", updatedMessages: messages, orderId, branchId };
    }

    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    if (!msg) {
      console.error("OpenRouter respuesta sin choices:", JSON.stringify(data));
      return { reply: "Ahorita tenemos un problema técnico, por favor intenta de nuevo en un momento.", updatedMessages: messages, orderId, branchId };
    }
    messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });

    const toolCalls = msg.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }> | undefined;
    if (!toolCalls || toolCalls.length === 0) {
      return { reply: msg.content || "¿Me puedes repetir tu pedido?", updatedMessages: messages, orderId, branchId };
    }

    for (const call of toolCalls) {
      let result: unknown;
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(call.function.arguments || "{}");
      } catch {
        result = { error: "No entendí bien los datos, ¿puedes repetir el pedido?" };
      }
      if (result === undefined) {
        try {
          if (call.function.name === "buscar_sucursal_cercana") {
            const { data: matches, error: sucursalError } = await supabase.rpc("sucursal_mas_cercana", {
              p_restaurant_id: restaurantId,
              p_colonia: String(input.colonia ?? ""),
            });
            if (sucursalError) throw sucursalError;
            const match = matches?.[0];
            result = match
              ? { encontrada: true, branch_slug: match.branch_slug, branch_name: match.branch_name, distancia_km: match.distancia_km, colonia_reconocida: match.colonia_encontrada }
              : { encontrada: false, mensaje: "No reconozco esa colonia — pide al cliente otra referencia cercana (colonia vecina, cruce de calles, plaza conocida) e intenta de nuevo." };
          } else if (call.function.name === "buscar_producto") {
            // Precio real de la sucursal confirmada — branch_products, no el
            // precio plano de `products` (los precios sí varían de verdad
            // entre sucursales, verificado contra el menú fotografiado real).
            const { data: branch } = await supabase
              .from("branches")
              .select("id")
              .eq("slug", input.branch_slug as string)
              .maybeSingle();
            if (!branch) {
              result = { error: "branch_slug desconocido — confirma la sucursal antes de buscar productos" };
            } else {
              // Tokenizado compartido con el agente de voz (buscar-producto/index.ts)
              // — ver create-order-core.ts para el historial completo.
              const tokensAUsar = tokenizeForProductSearch(String(input.query ?? ""));

              let builder = supabase
                .from("branch_products")
                .select("price, is_available, products!inner(id, name, restaurant_id)")
                .eq("branch_id", branch.id)
                .eq("is_available", true)
                .eq("products.restaurant_id", restaurantId);
              for (const token of tokensAUsar) {
                builder = builder.ilike("products.name", `%${token}%`);
              }
              const { data: rows } = await builder.limit(8); // mismo límite que buscar-producto/index.ts (voz) — antes era 6 aquí, sin razón documentada para la diferencia
              result = (rows ?? []).map((r: any) => ({ id: r.products.id, name: r.products.name, price: r.price }));
            }
          } else if (call.function.name === "crear_pedido") {
            const order = await createOrderCore(supabase, {
              branch_slug: input.branch_slug as string,
              customer_name: input.customer_name as string,
              customer_phone: phone,
              customer_address: input.customer_address as string,
              items: input.items as { product_id: string; quantity: number }[],
              source: "whatsapp",
              notes: (input.notes as string) || undefined,
              payment_method: (input.payment_method as "efectivo" | "tarjeta") || undefined,
            });
            orderId = order.id;
            branchId = order.branch_id ?? null;
            result = { order };
          } else if (call.function.name === "registrar_contacto") {
            const { error } = await supabase.from("callback_requests").insert({
              restaurant_id: restaurantId,
              branch_id: null,
              customer_name: input.customer_name as string,
              customer_phone: phone,
              reason: (input.reason as string) ?? null,
              message: (input.message as string) ?? null,
              source: "whatsapp",
            });
            if (error) throw error;
            result = { ok: true };
          } else {
            result = { error: `Herramienta desconocida: ${call.function.name}` };
          }
        } catch (err) {
          result = { error: err instanceof OrderValidationError ? err.message : "Error interno al ejecutar la herramienta" };
        }
      }
      // crear_pedido fallando es justo el caso que el escalón caro existe
      // para rescatar — un producto no encontrado, una cantidad mal
      // formada, etc. buscar_producto sin resultados NO cuenta como fallo:
      // es una respuesta normal ("no tenemos eso"), no un error del modelo.
      if (call.function.name === "crear_pedido" && result && typeof result === "object" && "error" in result) {
        huboFalloDeHerramienta = true;
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  // Bug real confirmado el 3-sep-2026: si el loop se queda sin turnos DESPUÉS
  // de que crear_pedido ya tuvo éxito (orderId ya viene con un valor real),
  // este fallback genérico le decía al cliente "se me complicó" pese a que su
  // pedido SÍ se había registrado — el cliente insistía, y el siguiente turno
  // disparaba una segunda llamada real a crear_pedido (mitigado aparte con un
  // guard de duplicados en createOrderCore, pero el mensaje engañoso en sí ya
  // era un bug real que había que corregir). Si ya hay un orderId real, se lo
  // decimos con éxito en vez de sonar a error.
  if (orderId) {
    return {
      reply: "¡Listo! Tu pedido ya quedó registrado y se mandó a cocina. Tiempo estimado: 40-50 minutos (1h-1h20 si llueve).",
      updatedMessages: messages,
      orderId,
      branchId,
    };
  }
  return { reply: "Se me complicó procesar tu pedido, un momento por favor.", updatedMessages: messages, orderId, branchId };
}
