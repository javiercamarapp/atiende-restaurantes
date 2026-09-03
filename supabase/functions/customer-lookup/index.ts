// Server Tool for the ElevenLabs voice agent: "buscar_cliente". Called at the
// start of a call with the caller's phone number so the agent can greet a
// returning customer by name and offer their saved address, mirroring the
// deterministic lookup the WhatsApp webhook does in-process.
//
// IMPORTANTE, bug real encontrado en llamada real (3-sep-2026): este function
// SIEMPRE debe desplegarse con verify_jwt=false. ElevenLabs (Server Tool) no
// manda ningún header Authorization — con verify_jwt=true el gateway de
// Supabase rechaza con 401 antes de que este código corra. El default de
// deploy_edge_function es true, hay que pasar verify_jwt: false explícito.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { lookupCustomer, vipNote } from "../_shared/create-order-core.ts";

// Mismo restaurant_id real que usan whatsapp-webhook/index.ts y
// create-order-core.ts (las 7 sucursales del piloto comparten el mismo
// restaurant_id) — se usaba antes una consulta a `branches` por branch_slug
// solo para llegar a este mismo valor, pero buscar_cliente se llama al
// inicio de la llamada (antes de que el agente confirme la sucursal, paso 3
// del flujo real), así que branch_slug casi nunca llega — esa consulta
// podía devolver null y tronar con "branch.restaurant_id" sobre null.
const RESTAURANT_ID = "be3fbdeb-80e7-4e7b-9b44-22b476c08298";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { phone } = (await req.json()) as { phone: string };
    if (!phone) {
      return new Response(JSON.stringify({ error: "phone es requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customer = await lookupCustomer(supabase, RESTAURANT_ID, phone);

    // agent_notes: instrucciones en texto plano listas para que el LLM del
    // agente de voz las use tal cual al leer el resultado de esta tool —
    // el mensaje de sistema real del agente vive editable en vivo en
    // ElevenLabs (panel admin, fuera de este repo), así que estas notas van
    // directo en el resultado de la tool para no dejar tier/frequent_items
    // calculados sin usar en el trato real, sea cual sea el prompt vigente.
    const notas: string[] = [];
    if (!customer.is_new) {
      const nota = vipNote(customer.tier ?? null);
      if (nota) notas.push(nota);
      if (customer.frequent_items?.length) {
        const items = customer.frequent_items.map((i: { name: string; quantity: number }) => i.name).join(", ");
        notas.push(`Lo que más pide across todo su historial real (no solo su último pedido): ${items}. Puedes ofrecer "¿lo de siempre?" con confianza usando esto, incluso si su último pedido fue distinto.`);
      }
    }

    return new Response(JSON.stringify({ ...customer, agent_notes: notas }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("customer-lookup error:", err);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
