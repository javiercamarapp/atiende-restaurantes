// Backend del widget de chat estilo WhatsApp de la demo — mismo cerebro
// exacto que whatsapp-webhook (prompt/tools/loop de tool-use, compartido vía
// ../_shared/whatsapp-agent-core.ts), pero en vez de recibir el payload real
// de Twilio (form-data con From/Body), acepta un JSON simple
// {session_id, message} desde el navegador y contesta {reply}.
//
// El estado de la conversación se guarda en la MISMA tabla real
// whatsapp_conversations que usa el canal de WhatsApp real — no hay tabla
// aparte. Como esa tabla solo tiene `phone` (unique) como identificador de
// conversación y no un campo de canal/fuente separado, cada sesión del
// widget se guarda con phone = "widget-" + session_id, así nunca choca con
// un número real de WhatsApp (que siempre trae "+" al inicio) y cada pestaña
// del widget lleva su propio hilo real y aislado.
//
// Setup needed (Supabase project secrets) — los mismos que whatsapp-webhook,
// MENOS los de Twilio (este canal no manda el mensaje por WhatsApp real):
//   OPENROUTER_API_KEY
//   OPENROUTER_MODEL (opcional)
//   OPENROUTER_MODEL_ESCALADO (opcional)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { lookupCustomer, redactSensitiveInfo } from "../_shared/create-order-core.ts";
import { RESTAURANT_ID, runAgentTurn } from "../_shared/whatsapp-agent-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id, message } = await req.json().catch(() => ({}));
    if (!session_id || typeof session_id !== "string") {
      return new Response(JSON.stringify({ error: "session_id es requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Un mensaje vacío/solo espacios es un caso real que el widget puede
    // mandar (doble tap, teclado que no registró texto) — antes devolvía
    // {error} con status 400, una forma distinta a {reply, order_id} que
    // el resto del contrato de esta función siempre devuelve, rompiendo al
    // cliente que solo espera esa forma. Ahora responde con la MISMA forma,
    // sin gastar una llamada real al LLM para algo que no dice nada.
    if (!message || typeof message !== "string" || !message.trim()) {
      return new Response(JSON.stringify({ reply: "No recibí ningún mensaje — ¿me puedes escribir de nuevo?", order_id: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = `widget-${session_id}`;

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
    // Redacta número de tarjeta/CVV/vencimiento ANTES de persistir — el
    // agente le dice al cliente que no guarda esos datos si los comparte
    // por chat (LÍMITES del prompt); antes eso era falso, el mensaje crudo
    // quedaba en texto plano en whatsapp_conversations.messages. Confirmado
    // en la auditoría adversarial del 3-sep-2026.
    messages.push({ role: "user", content: redactSensitiveInfo(message.trim()) });

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

    return new Response(JSON.stringify({ reply, order_id: orderId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-widget-chat error:", err);
    return new Response(JSON.stringify({ error: "No se pudo procesar el mensaje" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
