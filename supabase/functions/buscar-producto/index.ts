// Server Tool for the ElevenLabs voice agent: "buscar_producto". Resuelve
// nombre de platillo -> UUID real de la tabla `products` antes de que el
// agente llame a crear_pedido — mismo patrón que ya usa internamente el
// webhook de WhatsApp (buscar_producto), expuesto aquí como su propio
// endpoint porque el agente de voz no comparte ese proceso.
//
// Precio y disponibilidad vienen de `branch_products` (precio/disponibilidad
// real POR sucursal — verificado contra fotos reales del menú de cada una,
// distinto entre sucursales de verdad) en vez del precio plano de
// `products`, que hoy solo sirve de catálogo maestro de nombres/categorías.
//
// IMPORTANTE, bug real encontrado en llamada real (3-sep-2026): este function
// SIEMPRE debe desplegarse con verify_jwt=false. ElevenLabs (Server Tool) no
// manda ningún header Authorization en sus llamadas — con verify_jwt=true el
// gateway de Supabase rechaza la petición con 401 ANTES de que este código
// corra, y la llamada de voz se atora sin ningún log útil de este archivo. El
// default de deploy_edge_function es true, así que hay que pasar
// verify_jwt: false explícito en cada redeploy.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buscarProductosCore } from "../_shared/create-order-core.ts";

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
    if (!branch_slug) {
      return new Response(JSON.stringify({ error: "branch_slug es requerido — confirma la sucursal antes de buscar productos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Antes, si branch_slug faltaba o no existía, caía en silencio a
    // "fco-montejo" — el agente podía terminar buscando (y cotizando) el
    // menú de una sucursal completamente distinta a la que el cliente
    // confirmó, sin ningún error visible. Mismo bug de clase que el
    // hardcode ya corregido en el tool schema de crear_pedido. Ahora
    // valida explícito, igual que ya hacía la versión de WhatsApp.
    const { data: branch } = await supabase
      .from("branches")
      .select("id, restaurant_id")
      .eq("slug", branch_slug)
      .maybeSingle();
    if (!branch) {
      return new Response(JSON.stringify({ error: `Sucursal '${branch_slug}' no encontrada` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Búsqueda compartida con WhatsApp (whatsapp-agent-core.ts) — ver
    // create-order-core.ts (buscarProductosCore) para el historial completo
    // de por qué compara contra name+description+categoría+search_keywords
    // en vez de solo name.
    const productos = await buscarProductosCore(supabase, {
      branchId: branch.id,
      restaurantId: branch.restaurant_id,
      query,
    });

    return new Response(JSON.stringify({ productos }), {
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
