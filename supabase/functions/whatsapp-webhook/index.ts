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
// Setup needed (Supabase project secrets):
//   OPENROUTER_API_KEY                - de openrouter.ai (una sola key para cualquier modelo/proveedor)
//   TWILIO_ACCOUNT_SID                - from the Twilio console
//   TWILIO_AUTH_TOKEN                 - from the Twilio console
//   TWILIO_WHATSAPP_FROM              - e.g. "whatsapp:+14155238886" for the sandbox number
//   OPENROUTER_MODEL (opcional)          - default: google/gemini-2.5-flash-lite
//   OPENROUTER_MODEL_ESCALADO (opcional) - default: anthropic/claude-sonnet-5
//
// Twilio webhook URL to configure (Sandbox settings -> "When a message comes in"):
//   https://<project-ref>.supabase.co/functions/v1/whatsapp-webhook

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createOrderCore, lookupCustomer, OrderValidationError } from "../_shared/create-order-core.ts";

// Cascada de dos escalones, mismo patrón que usan de verdad Likida y
// atiende.ai: modelo barato para el 95% del tráfico, uno caro solo cuando
// el barato ya falló una vez en esta conversación.
//
// Escalón 1 (default): Gemini 2.5 Flash-Lite — $0.10/$0.40 por millón de
// tokens, el más barato de los que de verdad sirven. Es el modelo que
// Likida usa de verdad en su propio chat de alto volumen (citado en su
// código como "mejor español barato + baja latencia"), con evidencia real
// de calidad de español (top del índice multilingüe de Artificial
// Analysis) — a diferencia de DeepSeek, que no tiene ese dato verificado.
// Se compararon también Gemini 3.1/3.5/3.6/3.7/3.8 Flash y Flash-Lite,
// GPT-5/5.4 nano/mini, GLM-4.5-air/4.6 y DeepSeek V3.2/V4 Flash (precios
// de OpenRouter, sept-2026): las variantes "Flash" sin "lite" de Gemini
// 3.x salen 3-7x más caras sin mejorar tool-calling para este caso de uso,
// y DeepSeek V4 Flash mostró en benchmarks públicos un patrón real de
// "finalización forzada" en dos tercios de sus corridas agénticas
// multi-paso — justo lo que este bot hace todo el rato (buscar_producto
// varias veces seguidas). No vale la pena apostarle eso a la demo.
//
// Escalón 2 (solo tras un fallo de herramienta en esta conversación):
// Claude Sonnet 5 — el mismo escalón caro que usan Likida y atiende.ai
// para lo que de verdad no se puede permitir fallar dos veces, en su
// versión más nueva disponible en OpenRouter hoy ($2/$10 por millón).
const MODEL_DEFAULT = Deno.env.get("OPENROUTER_MODEL") ?? "google/gemini-2.5-flash-lite";
const MODEL_ESCALADO = Deno.env.get("OPENROUTER_MODEL_ESCALADO") ?? "anthropic/claude-sonnet-5";
const PILOT_BRANCH_SLUG = "fco-montejo";

const BASE_SYSTEM_PROMPT = `Eres el asistente de WhatsApp de Los Taquitos de PM, sucursal Francisco de Montejo, en Mérida.
Tomas pedidos a domicilio por chat. Tono cálido, directo, mensajes cortos (esto es WhatsApp, no una carta), actúa natural — no leas listas completas de golpe, ve conversando.

REGLAS DE NEGOCIO:
- Formas de pago: tarjeta (pide la terminal al momento del pedido) o contra entrega. No proceses pagos ni pidas número de tarjeta por chat.
- Tiempo de entrega: 40 a 50 minutos (1h a 1h20 si llueve). SIEMPRE da este dato al final, junto con el total.
- Las promos de 2x1 y nachos+aguas son SOLO para comer en el restaurante — nunca las ofrezcas para domicilio.
- Los "kilos a domicilio" incluyen salsa roja, salsa verde, limones y tortillas sin costo extra.
- No inventes productos ni precios: usa siempre la herramienta buscar_producto para confirmar nombre/precio real antes de agregar algo al pedido. Puedes recomendar productos populares o combinaciones típicas si el cliente no sabe qué pedir.
- Si piden algo que no existe en el menú de esta sucursal, dilo con naturalidad y sugiere algo parecido.
- Si el pedido incluye alcohol, confirma que quien recibe es mayor de edad.
- No inventes horarios de apertura/cierre — ese dato no está confirmado todavía.

FLUJO DE LA CONVERSACIÓN (en este orden):
1. Saluda identificando la sucursal. Pregunta el nombre de quien pide (el número de WhatsApp ya lo tienes, no lo vuelvas a pedir).
2. Dirección: si el CONTEXTO DEL CLIENTE de abajo trae una dirección guardada, recuérdasela y pregunta si el pedido es para ahí o si quiere mandarlo a otro lugar (si da una nueva, se guarda sola en su perfil al cerrar el pedido — no hace falta que hagas nada extra). Si es cliente nuevo o no tiene dirección guardada, pídesela.
3. Toma el pedido: ve agregando productos, confirmando cada uno con buscar_producto. Si el CONTEXTO trae su último pedido, puedes ofrecer "¿lo de siempre?" como sugerencia natural, no como obligación.
4. Antes de cerrar: recuerda TODO lo que incluye el pedido (frijoles charros, guacamole, tortillas, ensalada donde aplique; en kilos: salsa roja, salsa verde, limones y tortillas) y pregunta si quiere alguna salsa en específico o alguna guarnición extra (tienen costo aparte).
5. Da el total final del pedido.
6. Da el tiempo de espera aproximado (40-50 min, o 1h-1h20 si llueve).
7. Cuando el cliente confirme todo, llama a crear_pedido con los product_id reales (no nombres). No llames a crear_pedido si todavía falta nombre, dirección o confirmación del cliente.
8. Si crear_pedido devuelve un error, explícaselo al cliente en una frase simple y corrige.
9. Cuando el pedido quede creado, confirma que ya se mandó a cocina.`;

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
      description: "Registra el pedido final en el sistema. Solo llamar cuando el cliente ya confirmó todo.",
      parameters: {
        type: "object",
        properties: {
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
        required: ["customer_name", "customer_address", "items"],
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

    const { data: branch } = await supabase
      .from("branches")
      .select("id, restaurant_id")
      .eq("slug", PILOT_BRANCH_SLUG)
      .single();

    // deno-lint-ignore no-explicit-any
    const messages = (convo?.messages ?? []) as any[];
    messages.push({ role: "user", content: body });

    const customer = await lookupCustomer(supabase, branch!.restaurant_id, phone);
    const { reply, updatedMessages, orderId } = await runAgentTurn(supabase, messages, phone, customer, branch!.restaurant_id);

    if (convo) {
      await supabase.from("whatsapp_conversations").update({
        messages: updatedMessages,
        status: orderId ? "completed" : "active",
        order_id: orderId ?? convo.order_id,
      }).eq("phone", phone);
    } else {
      await supabase.from("whatsapp_conversations").insert({
        phone,
        branch_id: branch!.id,
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
): Promise<{ reply: string; updatedMessages: typeof messages; orderId: string | null }> {
  let orderId: string | null = null;
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
      return { reply: "Ahorita tenemos un problema técnico, por favor intenta de nuevo en un momento.", updatedMessages: messages, orderId };
    }

    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    if (!msg) {
      console.error("OpenRouter respuesta sin choices:", JSON.stringify(data));
      return { reply: "Ahorita tenemos un problema técnico, por favor intenta de nuevo en un momento.", updatedMessages: messages, orderId };
    }
    messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });

    const toolCalls = msg.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }> | undefined;
    if (!toolCalls || toolCalls.length === 0) {
      return { reply: msg.content || "¿Me puedes repetir tu pedido?", updatedMessages: messages, orderId };
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
              branch_slug: PILOT_BRANCH_SLUG,
              customer_name: input.customer_name as string,
              customer_phone: phone,
              customer_address: input.customer_address as string,
              items: input.items as { product_id: string; quantity: number }[],
              source: "whatsapp",
            });
            orderId = order.id;
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

  return { reply: "Se me complicó procesar tu pedido, un momento por favor.", updatedMessages: messages, orderId };
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
