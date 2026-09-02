// Server Tool for the ElevenLabs voice agent: "buscar_cliente". Called at the
// start of a call with the caller's phone number so the agent can greet a
// returning customer by name and offer their saved address, mirroring the
// deterministic lookup the WhatsApp webhook does in-process.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { lookupCustomer } from "../_shared/create-order-core.ts";

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

    const { phone, branch_slug } = (await req.json()) as { phone: string; branch_slug?: string };
    if (!phone) {
      return new Response(JSON.stringify({ error: "phone es requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: branch } = await supabase
      .from("branches")
      .select("restaurant_id")
      .eq("slug", branch_slug ?? "fco-montejo")
      .single();

    const customer = await lookupCustomer(supabase, branch.restaurant_id, phone);

    return new Response(JSON.stringify(customer), {
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
