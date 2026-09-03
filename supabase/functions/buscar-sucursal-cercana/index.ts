// Server Tool para el agente de voz y el agente de WhatsApp: "buscar_sucursal_cercana".
//
// Bug alto confirmado en la auditoría adversarial del 3-sep-2026: antes, la
// sucursal "más cercana" la decidía el LLM "con naturalidad" a partir del
// nombre de la colonia, sin ningún dato geográfico real — para 4 colonias
// reales de Mérida probadas (Cholul, Caucel, Temozón Norte, Mulsay), acertó
// solo 1 de 4 (hasta ~2x más lejos en los casos que falló). `branches` ya
// tenía columnas lat/lng reales sin usar. Este tool llama a la función SQL
// sucursal_mas_cercana(), que hace match contra una tabla de colonias
// conocidas de Mérida y calcula distancia real (Haversine) contra las 7
// sucursales — reemplaza la adivinanza del modelo con matemática real.
//
// Si la colonia no se reconoce, la función devuelve cero filas — el agente
// debe pedir más detalle (otra referencia, colonia cercana) en vez de
// adivinar, igual que ya hacía antes cuando la colonia no era clara.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { colonia } = (await req.json()) as { colonia?: string };
    if (!colonia || !colonia.trim()) {
      return new Response(JSON.stringify({ error: "colonia es requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.rpc("sucursal_mas_cercana", {
      p_restaurant_id: RESTAURANT_ID,
      p_colonia: colonia.trim(),
    });
    if (error) throw error;

    const match = data?.[0];
    if (!match) {
      return new Response(JSON.stringify({
        encontrada: false,
        mensaje: "No reconozco esa colonia — pide al cliente otra referencia cercana (colonia vecina, cruce de calles, plaza conocida) e intenta de nuevo.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      encontrada: true,
      branch_slug: match.branch_slug,
      branch_name: match.branch_name,
      distancia_km: match.distancia_km,
      colonia_reconocida: match.colonia_encontrada,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("buscar-sucursal-cercana error:", err);
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
