// Shared order-creation endpoint.
// Called by the website checkout AND by the voice agent's Server Tool webhook,
// so a phone order and a web order both land in the exact same `orders` table
// that the admin and repartidor panels already read from.
//
// Prices are always re-looked-up from `products` server-side — never trust a
// client-submitted total (the old CheckoutModal used to trust the cart total,
// which was fine when it was fake, but not once real money/kitchens are involved).
//
// IMPORTANTE, bug real encontrado en llamada real (3-sep-2026): este function
// SIEMPRE debe desplegarse con verify_jwt=false. ElevenLabs (Server Tool) no
// manda ningún header Authorization — con verify_jwt=true el gateway de
// Supabase rechaza con 401 antes de que este código corra. El default de
// deploy_edge_function es true, hay que pasar verify_jwt: false explícito.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createOrderCore, CreateOrderPayload, OrderValidationError } from "../_shared/create-order-core.ts";

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

    const payload = (await req.json()) as CreateOrderPayload;
    const order = await createOrderCore(supabase, payload);

    return json({ order });
  } catch (err) {
    console.error("create-order error:", err);
    const status = err instanceof OrderValidationError ? 400 : 500;
    return json({ error: err instanceof Error ? err.message : "Error interno" }, status);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
