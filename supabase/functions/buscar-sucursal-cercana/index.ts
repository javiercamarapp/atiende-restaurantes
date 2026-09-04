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
//
// IMPORTANTE, bug real encontrado en llamada real (3-sep-2026, el mismo día
// que se creó este archivo): este function SIEMPRE debe desplegarse con
// verify_jwt=false. ElevenLabs (Server Tool) no manda ningún header
// Authorization — con verify_jwt=true (el default real de este proyecto al
// crear el function) el gateway de Supabase rechazó con 401 ANTES de que
// este código llegara a correr, así que el fix de la colonia/acentos nunca
// se había probado de verdad por voz hasta corregir esto. El default de
// deploy_edge_function es true, hay que pasar verify_jwt: false explícito
// en cada redeploy — igual que buscar-producto/create-order/customer-lookup.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import {
  consumeRateLimit,
  HttpInputError,
  jsonResponse,
  preflightResponse,
  readJson,
  requestActor,
  secretMatches,
} from "../_shared/http-security.ts";

const RESTAURANT_ID = "be3fbdeb-80e7-4e7b-9b44-22b476c08298";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Método no permitido" }, 405);
  }
  if (!secretMatches(req, "x-atiende-tool-secret", "VOICE_TOOL_SECRET")) {
    return jsonResponse(req, { error: "No autorizado" }, 401);
  }

  try {
    const { colonia } = await readJson<{ colonia?: unknown }>(req, 4 * 1024);
    if (
      typeof colonia !== "string" || !colonia.trim() || colonia.length > 160
    ) {
      return jsonResponse(req, { error: "colonia es requerido" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const limited = await consumeRateLimit(
      supabase,
      "buscar-sucursal-cercana",
      requestActor(req, colonia),
      60,
      60,
    );
    if (!limited.allowed) {
      return jsonResponse(req, { error: "Demasiadas solicitudes" }, 429, {
        "Retry-After": "60",
      });
    }

    const { data, error } = await supabase.rpc("sucursal_mas_cercana", {
      p_restaurant_id: RESTAURANT_ID,
      p_colonia: colonia.trim(),
    });
    if (error) throw error;

    const match = data?.[0];
    if (!match) {
      return jsonResponse(req, {
        encontrada: false,
        mensaje:
          "No reconozco esa colonia — pide al cliente otra referencia cercana (colonia vecina, cruce de calles, plaza conocida) e intenta de nuevo.",
      });
    }

    return jsonResponse(req, {
      encontrada: true,
      branch_slug: match.branch_slug,
      branch_name: match.branch_name,
      distancia_km: match.distancia_km,
      colonia_reconocida: match.colonia_encontrada,
    });
  } catch (err) {
    console.error("buscar-sucursal-cercana error:", err);
    const status = err instanceof HttpInputError ? err.status : 500;
    return jsonResponse(req, {
      error: err instanceof HttpInputError ? err.message : "Error interno",
    }, status);
  }
});
