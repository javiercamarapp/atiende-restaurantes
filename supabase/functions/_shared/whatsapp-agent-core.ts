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
import { createOrderCore, OrderValidationError, vipNote } from "./create-order-core.ts";

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
- Formas de pago: tarjeta (pide la terminal al momento del pedido) o contra entrega. No proceses pagos ni pidas número de tarjeta por chat.
- Tiempo de entrega: 40 a 50 minutos (1h a 1h20 si llueve). SIEMPRE da este dato al final, junto con el total.
- Las promos de 2x1 y nachos+aguas son SOLO para comer en el restaurante — nunca las ofrezcas para domicilio.
- Los "kilos a domicilio" incluyen salsa roja, salsa verde, limones y tortillas sin costo extra.
- No inventes productos ni precios: usa siempre la herramienta buscar_producto para confirmar nombre/precio real antes de agregar algo al pedido. Puedes recomendar productos populares o combinaciones típicas si el cliente no sabe qué pedir.
- Si piden algo que no existe en el menú, dilo con naturalidad y sugiere algo parecido.
- Si el pedido incluye alcohol, confirma que quien recibe es mayor de edad.
- No inventes horarios de apertura/cierre — ese dato no está confirmado todavía.
- No inventes sucursales ni branch_slugs que no estén en la lista de arriba.
- Si el mensaje NO es para hacer un pedido (queja, facturación, empleo, u otro motivo que no sea ordenar comida): sé honesto, di que este número es para pedidos, pide su nombre si no lo tienes, y llama a registrar_contacto con nombre, motivo y un resumen breve de lo que dijo — así alguien del restaurante le contesta de verdad, no lo prometas sin registrarlo.

FLUJO DE LA CONVERSACIÓN (en este orden):
1. Saluda (sin mencionar sucursal todavía — aún no la sabes). Pregunta el nombre de quien pide (el número de WhatsApp ya lo tienes, no lo vuelvas a pedir).
2. Dirección: si el CONTEXTO DEL CLIENTE de abajo trae una dirección guardada, recuérdasela y pregunta si el pedido es para ahí o si quiere mandarlo a otro lugar (si da una nueva, se guarda sola en su perfil al cerrar el pedido — no hace falta que hagas nada extra). Si es cliente nuevo o no tiene dirección guardada, pídesela.
3. En cuanto tengas la dirección/colonia, decide con naturalidad cuál de las sucursales de arriba está más cerca — si la colonia no es clara, pregunta la colonia o una referencia cercana antes de decidir. Dile al cliente de qué sucursal va a salir su pedido y confirma que está bien.
4. Toma el pedido: ve agregando productos, confirmando cada uno con buscar_producto (pásale siempre el branch_slug de la sucursal que ya confirmaste en el paso 3 — el precio real varía por sucursal). Si el CONTEXTO trae su último pedido, puedes ofrecer "¿lo de siempre?" como sugerencia natural, no como obligación.
5. Antes de cerrar: recuerda TODO lo que incluye el pedido (frijoles charros, guacamole, tortillas, ensalada donde aplique; en kilos: salsa roja, salsa verde, limones y tortillas) y pregunta si quiere alguna salsa en específico o alguna guarnición extra (tienen costo aparte).
6. Da el total final del pedido, y pregunta cómo va a pagar: efectivo o tarjeta. Si dice tarjeta, confírmale que llevaremos a alguien con terminal física al momento de la entrega.
7. Da el tiempo de espera aproximado (40-50 min, o 1h-1h20 si llueve).
8. Cuando el cliente confirme todo, llama a crear_pedido con los product_id reales (no nombres) y el branch_slug de la sucursal que confirmaste en el paso 3. No llames a crear_pedido si todavía falta nombre, dirección, sucursal o confirmación del cliente.
9. Si crear_pedido devuelve un error, explícaselo al cliente en una frase simple y corrige.
10. Cuando el pedido quede creado, confirma que ya se mandó a cocina.`;

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
        },
        required: ["branch_slug", "customer_name", "customer_address", "items"],
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
        authorization: `Bearer ${Deno.env.get("OPENROUTER_API_KEY")!}`,
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
          if (call.function.name === "buscar_producto") {
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
              const { data: rows } = await supabase
                .from("branch_products")
                .select("price, is_available, products!inner(id, name, restaurant_id)")
                .eq("branch_id", branch.id)
                .eq("is_available", true)
                .eq("products.restaurant_id", restaurantId)
                .ilike("products.name", `%${input.query}%`)
                .limit(6);
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

  return { reply: "Se me complicó procesar tu pedido, un momento por favor.", updatedMessages: messages, orderId, branchId };
}
