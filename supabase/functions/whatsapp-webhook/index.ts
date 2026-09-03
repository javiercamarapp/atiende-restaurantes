// Webhook real de WhatsApp Cloud API (Meta), NO Twilio — Javier hizo el
// onboarding real directo con Meta (developers.facebook.com, "Número de
// prueba") en vez de pasar por Twilio, así que este archivo se migró de
// Twilio (form-urlencoded, respuesta TwiML) al contrato real de Meta
// (JSON, verificación GET con hub.challenge, envío vía Graph API).
//
// El cerebro real (prompt/tools/loop de tool-use contra OpenRouter) vive en
// ../_shared/whatsapp-agent-core.ts — lo comparte con whatsapp-widget-chat
// (el mismo agente, alcanzable desde el widget de la página pública/demo) para
// que nunca se desalineen las reglas de negocio entre canales.
//
// Setup needed (Supabase project secrets, todos ya guardados en Vault):
//   OPENROUTER_API_KEY          - de openrouter.ai (falta configurar, bloqueante para la demo)
//   WHATSAPP_ACCESS_TOKEN       - token de Meta Cloud API (temporal de prueba, expira ~24h)
//   WHATSAPP_PHONE_NUMBER_ID    - Phone Number ID real de Meta
//   WHATSAPP_VERIFY_TOKEN       - inventado por nosotros, para el handshake GET
//   OPENROUTER_MODEL (opcional)          - default: google/gemini-2.5-flash-lite
//   OPENROUTER_MODEL_ESCALADO (opcional) - default: openai/gpt-5.4-mini
//
// Webhook URL a registrar en el panel de Meta (WhatsApp > Configuration > Webhook):
//   https://okvxavwijqacomgtyyou.supabase.co/functions/v1/whatsapp-webhook
// Verify token: el valor real de WHATSAPP_VERIFY_TOKEN (Vault) — Meta lo manda
// de vuelta en hub.verify_token durante el handshake GET.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { lookupCustomer, redactSensitiveInfo } from "../_shared/create-order-core.ts";
import { RESTAURANT_ID, runAgentTurn } from "../_shared/whatsapp-agent-core.ts";

const GRAPH_API_VERSION = "v25.0"; // misma versión real que trae el panel de Meta de Javier

// Las credenciales reales de WhatsApp Cloud API (token, phone number id,
// verify token) NO viven como Edge Function secrets (Deno.env) — no hay
// ninguna herramienta MCP disponible para configurar esos de verdad, así
// que en vez de eso viven en Supabase Vault (misma tabla real que ya usa
// ELEVENLABS_API_KEY), leídas aquí vía la función SQL get_secret() que ya
// existe en la base — mismo patrón real, ningún mecanismo nuevo inventado.
// deno-lint-ignore no-explicit-any
async function getVaultSecret(supabase: any, name: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_secret", { secret_name: name });
  if (error) {
    console.error(`get_secret(${name}) falló:`, error);
    return null;
  }
  return (data as string | null) ?? null;
}

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // Handshake de verificación real de Meta: GET con hub.mode/hub.verify_token/
  // hub.challenge — hay que responder el challenge tal cual (texto plano) si
  // el verify_token coincide con el que configuramos en Vault, o 403 si no.
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const supabase = createServiceClient();
    const verifyToken = await getVaultSecret(supabase, "WHATSAPP_VERIFY_TOKEN");

    if (mode === "subscribe" && token && verifyToken && token === verifyToken) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = await req.json();

    // Payload real de Meta: entry[].changes[].value.messages[] — otros
    // eventos (statuses de entrega/lectura, etc.) no traen `messages`, los
    // ignoramos con un 200 vacío en vez de tratarlos como error.
    const value = payload?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    if (!message || message.type !== "text") {
      return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
    }

    const phone = `+${message.from}`; // Meta manda el wa_id sin "+", nuestro schema real de phone sí lo lleva
    const body = String(message.text?.body ?? "").trim();
    if (!body) {
      return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
    }

    const supabase = createServiceClient();

    // Bug crítico real encontrado en la auditoría adversarial del
    // 3-sep-2026: mensajes casi-simultáneos del mismo cliente (mandar 2-3
    // mensajes seguidos sin esperar respuesta, comportamiento normal de
    // WhatsApp) corrompían y perdían historial de forma silenciosa — el
    // patrón anterior (SELECT messages -> push() en JS -> UPDATE del
    // arreglo completo) no tenía ningún lock: dos requests traslapados para
    // el mismo phone hacían que el segundo UPDATE sobreescribiera por
    // completo lo que el primero ya había guardado. Fix: whatsapp_append_turn
    // hace el append en una sola sentencia SQL (messages = messages ||
    // nuevos) — el row lock de Postgres serializa escrituras concurrentes
    // al mismo phone sin perder ningún mensaje. Se llama dos veces: primero
    // para el mensaje del usuario (así queda a salvo aunque el LLM tarde),
    // luego para lo que generó el turno.
    const userMessage = { role: "user", content: redactSensitiveInfo(body) };
    const { data: messagesAfterUser, error: appendUserError } = await supabase.rpc("whatsapp_append_turn", {
      p_phone: phone,
      p_new_messages: [userMessage],
    });
    if (appendUserError) throw appendUserError;
    // deno-lint-ignore no-explicit-any
    const messages = (messagesAfterUser ?? [userMessage]) as any[];

    const customer = await lookupCustomer(supabase, RESTAURANT_ID, phone);
    const { reply, updatedMessages, orderId, branchId } = await runAgentTurn(supabase, messages, phone, customer, RESTAURANT_ID);

    const nuevosDelTurno = updatedMessages.slice(messages.length);
    if (nuevosDelTurno.length > 0) {
      const { error: appendTurnError } = await supabase.rpc("whatsapp_append_turn", {
        p_phone: phone,
        p_new_messages: nuevosDelTurno,
        p_status: orderId ? "completed" : "active",
        p_order_id: orderId,
        p_branch_id: branchId,
      });
      if (appendTurnError) throw appendTurnError;
    }

    await sendWhatsAppMessage(supabase, message.from, reply);
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("whatsapp-webhook error:", err);
    // Meta reintenta agresivamente si no devolvemos 200 — devolvemos 200
    // igual (ya logueamos el error) para no generar una tormenta de reintentos
    // sobre un mensaje que probablemente vuelva a fallar igual.
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }
});

// Envía un mensaje real vía WhatsApp Cloud API (Graph API de Meta) — no
// Twilio. `to` debe ir sin "+" (formato wa_id real que usa Meta).
// deno-lint-ignore no-explicit-any
async function sendWhatsAppMessage(supabase: any, to: string, body: string) {
  const token = await getVaultSecret(supabase, "WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = await getVaultSecret(supabase, "WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneNumberId) {
    console.error("Faltan credenciales reales de WhatsApp Cloud API en Vault (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID)");
    return;
  }

  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });
  if (!res.ok) {
    console.error("WhatsApp Cloud API send error:", await res.text());
  }
}
