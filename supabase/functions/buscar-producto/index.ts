// Server Tool for the ElevenLabs voice agent: "buscar_producto". Resuelve
// nombre de platillo -> UUID real de la tabla `products` antes de que el
// agente llame a crear_pedido — mismo patrón que ya usa internamente el
// webhook de WhatsApp (buscar_producto), expuesto aquí como su propio
// endpoint porque el agente de voz no comparte ese proceso.

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

    const { query, branch_slug } = (await req.json()) as { query: string; branch_slug?: string };
    if (!query) {
      return new Response(JSON.stringify({ error: "query es requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: branch } = await supabase
      .from("branches")
      .select("restaurant_id")
      .eq("slug", branch_slug ?? "fco-montejo")
      .single();

    const { data: products, error } = await supabase
      .from("products")
      .select("id, name, price")
      .eq("restaurant_id", branch?.restaurant_id)
      .eq("is_available", true)
      .ilike("name", `%${query}%`)
      .limit(8);
    if (error) throw error;

    return new Response(JSON.stringify({ productos: products ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("buscar-producto error:", err);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
