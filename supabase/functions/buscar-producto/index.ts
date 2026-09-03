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
      .select("id, restaurant_id")
      .eq("slug", branch_slug ?? "fco-montejo")
      .single();

    // Antes esto era un solo ILIKE de la query completa como substring
    // literal — un cliente real dice "pastor individual" o "taco de bistec"
    // (el orden/las palabras de en medio no coinciden con el nombre real
    // "Taco Al Pastor (individual)" o "Tacos de Bistec de Res (orden de
    // 3)") y el match fallaba en silencio, devolviendo 0 resultados para un
    // producto que sí existe. Se tokeniza la query y se exige cada palabra
    // significativa como substring (AND, no necesariamente contigua) —
    // encontrado y corregido el 3-sep-2026 verificando en vivo con curl
    // directo antes de asumir que el catálogo estaba completo.
    const STOPWORDS = new Set(["de", "del", "la", "el", "los", "las", "un", "una", "unos", "unas", "y", "con", "para", "al"]);
    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t));
    const tokensAUsar = tokens.length > 0 ? tokens : [query];

    let builder = supabase
      .from("branch_products")
      .select("price, is_available, products!inner(id, name, restaurant_id)")
      .eq("branch_id", branch?.id)
      .eq("is_available", true)
      .eq("products.restaurant_id", branch?.restaurant_id);
    for (const token of tokensAUsar) {
      builder = builder.ilike("products.name", `%${token}%`);
    }
    const { data: rows, error } = await builder.limit(8);
    if (error) throw error;

    // deno-lint-ignore no-explicit-any
    const productos = (rows ?? []).map((r: any) => ({ id: r.products.id, name: r.products.name, price: r.price }));

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
