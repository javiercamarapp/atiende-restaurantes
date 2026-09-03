// Server Tool for the ElevenLabs voice agent: "registrar_contacto". Cierra un
// hueco real: el prompt siempre prometió "anotar el contacto" cuando la
// llamada no es para un pedido (quejas, facturación, empleo), pero no existía
// ninguna herramienta que de verdad lo guardara — se quedaba en una promesa
// vacía. También la usa el webhook de WhatsApp para el mismo caso.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { customer_name, customer_phone, reason, message, branch_slug, source } = (await req.json()) as {
      customer_name: string; customer_phone: string; reason?: string; message?: string; branch_slug?: string; source?: string;
    };
    if (!customer_name || !customer_phone) {
      return new Response(JSON.stringify({ error: "customer_name y customer_phone son requeridos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: branch } = await supabase
      .from("branches")
      .select("id, restaurant_id")
      .eq("slug", branch_slug ?? "fco-montejo")
      .single();

    const { error } = await supabase.from("callback_requests").insert({
      restaurant_id: branch?.restaurant_id,
      branch_id: branch?.id ?? null,
      customer_name,
      customer_phone,
      reason: reason ?? null,
      message: message ?? null,
      source: source ?? "voice",
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("registrar-contacto error:", err);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
