// Twilio WhatsApp webhook. Same brain as the voice agent (same menu, same
// business rules, same create-order), but text-based and stateful across
// messages (each WhatsApp message is a separate HTTP request, so conversation
// history is persisted in `whatsapp_conversations` between turns).
//
// El LLM corre por OpenRouter (API compatible con OpenAI), no directo contra
// Anthropic, en una cascada de dos escalones (ver detalle junto a
// MODEL_DEFAULT/MODEL_ESCALADO abajo) — mismo patrón que usan de verdad
// tanto atiende.ai (src/lib/sales/llm-router.ts) como Likida
// (src/lib/llm/models.ts).
//
// Un solo bot para las 7 sucursales (mismo cambio que ya tiene el agente de
// voz real): decide la sucursal más cercana por la dirección del cliente en
// vez de estar fijo a una sola — ya no hay PILOT_BRANCH_SLUG.
//
// Setup needed (Supabase project secrets):
//   OPENROUTER_API_KEY                - de openrouter.ai (una sola key para cualquier modelo/proveedor)
//   TWILIO_ACCOUNT_SID                - from the Twilio console
//   TWILIO_AUTH_TOKEN                 - from the Twilio console
//   TWILIO_WHATSAPP_FROM              - e.g. "whatsapp:+14155238886" for the sandbox number
//   OPENROUTER_MODEL (opcional)          - default: google/gemini-2.5-flash-lite
//   OPENROUTER_MODEL_ESCALADO (opcional) - default: openai/gpt-5.4-mini (mismo escalón barato-de-respaldo que el agente de voz)
//
// Twilio webhook URL to configure (Sandbox settings -> "When a message comes in"):
//   https://<project-ref>.supabase.co/functions/v1/whatsapp-webhook

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createOrderCore, lookupCustomer, OrderValidationError } from "../_shared/create-order-core.ts";

const MODEL_DEFAULT = Deno.env.get("OPENROUTER_MODEL") ?? "google/gemini-2.5-flash-lite";
const MODEL_ESCALADO = Deno.env.get("OPENROUTER_MODEL_ESCALADO") ?? "openai/gpt-5.4-mini";
const RESTAURANT_ID = "be3fbdeb-80e7-4e7b-9b44-22b476c08298";

const BASE_SYSTEM_PROMPT = `Eres el asistente de WhatsApp de Los Taquitos de PM, una taquería con varias sucursales en Mérida.
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

FLUJO DE LA CONVERSACIÓN (en este orden):
1. Saluda (sin mencionar sucursal todavía — aún no la sabes). Pregunta el nombre de quien pide (el número de WhatsApp ya lo tienes, no lo vuelvas a pedir).
2. Dirección: si el CONTEXTO DEL CLIENTE de abajo trae una dirección guardada, recuérdasela y pregunta si el pedido es para ahí o si quiere mandarlo a otro lugar (si da una nueva, se guarda sola en su perfil al cerrar el pedido — no hace falta que hagas nada extra). Si es cliente nuevo o no tiene dirección guardada, pídesela.
3. En cuanto tengas la dirección/colonia, decide con naturalidad cuál de las sucursales de arriba está más cerca — si la colonia no es clara, pregunta la colonia o una referencia cercana antes de decidir. Dile al cliente de qué sucursal va a salir su pedido y confirma que está bien.
4. Toma el pedido: ve agregando productos, confirmando cada uno con buscar_producto. Si el CONTEXTO trae su último pedido, puedes ofrecer "¿lo de siempre?" como sugerencia natural, no como obligación.
5. Antes de cerrar: recuerda TODO lo que incluye el pedido (frijoles charros, guacamole, tortillas, ensalada donde aplique; en kilos: salsa roja, salsa verde, limones y tortillas) y pregunta si quiere alguna salsa en específico o alguna guarnición extra (tienen costo aparte).
6. Da el total final del pedido, y pregunta cómo va a pagar: efectivo o tarjeta. Si dice tarjeta, confírmale que llevaremos a alguien con terminal física al momento de la entrega.
7. Da el tiempo de espera aproximado (40-50 min, o 1h-1h20 si llueve).
8. Cuando el cliente confirme todo, llama a crear_pedido con los product_id reales (no nombres) y el branch_slug de la sucursal que confirmaste en el paso 3. No llames a crear_pedido si todavía falta nombre, dirección, sucursal o confirmación del cliente.
9. Si crear_pedido devuelve un error, explícaselo al cliente en una frase simple y corrige.
10. Cuando el pedido quede creado, confirma que ya se mandó a cocina.`;

// Formato OpenAI/OpenRouter: los tools van bajo function.parameters, no
// input_schema directo como en la API de Anthropic.
const TOOLS = [
  {
    type: "function",
    function: {
      name: "buscar_producto",
      description: "Busca productos del menú real por nombre o palabra clave. Devuelve id, nombre y precio.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "texto a buscar, ej. 'pastor' o 'kilo arrachera'" } },
        required: ["query"],
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
];

Deno.serve(async (req: Request) => {
  try {
    const form = await req.formData();
    const from = String(form.get("From") ?? ""); // "whatsapp:+52..."
    const body = String(form.get("Body") ?? "").trim();
    const phone = from.replace("whatsapp:", "");

    if (!from || !body) {
      return twiml();
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: convo } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    // deno-lint-ignore no-explicit-any
    const messages = (convo?.messages ?? []) as any[];
    messages.push({ role: "user", content: body });

    const customer = await lookupCustomer(supabase, RESTAURANT_ID, phone);
    const { reply, updatedMessages, orderId, branchId } = await runAgentTurn(supabase, messages, phone, customer, RESTAURANT_ID);

    if (convo) {
      await supabase.from("whatsapp_conversations").update({
        messages: updatedMessages,
        status: orderId ? "completed" : "active",
        order_id: orderId ?? convo.order_id,
        branch_id: branchId ?? convo.branch_id,
      }).eq("phone", phone);
    } else {
      await supabase.from("whatsapp_conversations").insert({
        phone,
        branch_id: branchId,
        messages: updatedMessages,
        status: orderId ? "completed" : "active",
        order_id: orderId ?? null,
      });
    }

    await sendWhatsAppMessage(from, reply);
    return twiml();
  } catch (err) {
    console.error("whatsapp-webhook error:", err);
    return twiml();
  }
});

async function runAgentTurn(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  // deno-lint-ignore no-explicit-any
  messages: any[],
  phone: string,
  // deno-lint-ignore no-explicit-any
  customer: any,
  restaurantId: string,
): Promise<{ reply: string; updatedMessages: typeof messages; orderId: string | null; branchId: string | null }> {
  let orderId: string | null = null;
  let branchId: string | null = null;
  let huboFalloDeHerramienta = false; // dispara el escalón caro en el siguiente turno
  const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\nCONTEXTO DEL CLIENTE (no lo repitas literal, úsalo para hablarle natural):\n${customerContextBlock(customer)}`;

  for (let turn = 0; turn < 4; turn++) {
    const modeloDeEsteTurno = huboFalloDeHerramienta ? MODEL_ESCALADO : MODEL_DEFAULT;
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${Deno.env.get("OPENROUTER_API_KEY")!}`,
        "HTTP-Referer": "https://atiende-restaurantes.vercel.app",
        "X-Title": "atiende.ai — Los Taquitos de PM",
      },
      body: JSON.stringify({
        model: modeloDeEsteTurno,
        max_tokens: 1024,
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
            const { data: products } = await supabase
              .from("products")
              .select("id, name, price")
              .eq("restaurant_id", restaurantId)
              .eq("is_available", true)
              .ilike("name", `%${input.query}%`)
              .limit(6);
            result = products ?? [];
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

// deno-lint-ignore no-explicit-any
function customerContextBlock(customer: any): string {
  if (customer.is_new) {
    return "Cliente nuevo — nunca ha pedido antes por este número. Pide su nombre y su dirección de entrega; se guardan solos en su perfil al cerrar el pedido, no hace falta hacer nada extra.";
  }
  const lines: string[] = [];
  lines.push(`Cliente conocido${customer.name ? `: ${customer.name}` : " (sin nombre guardado todavía — pídeselo)"}.`);
  lines.push(`Ha pedido ${customer.order_count} ${customer.order_count === 1 ? "vez" : "veces"} antes.`);
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
    lines.push(`Su último pedido fue: ${items}. Puedes usarlo para sugerir "¿lo de siempre?" si aplica.`);
  }
  return lines.join("\n");
}

async function sendWhatsAppMessage(to: string, body: string) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const token = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const from = Deno.env.get("TWILIO_WHATSAPP_FROM")!;

  const params = new URLSearchParams({ From: from, To: to, Body: body });
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${btoa(`${sid}:${token}`)}`,
    },
    body: params,
  });
}

function twiml() {
  return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
}
