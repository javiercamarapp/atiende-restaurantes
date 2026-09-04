// Server Tool for the ElevenLabs voice agent: "registrar_contacto". Cierra un
// hueco real: el prompt siempre prometió "anotar el contacto" cuando la
// llamada no es para un pedido (quejas, facturación, empleo), pero no existía
// ninguna herramienta que de verdad lo guardara — se quedaba en una promesa
// vacía. También la usa el webhook de WhatsApp para el mismo caso.

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Método no permitido" }, 405);
  }
  if (!secretMatches(req, "x-atiende-tool-secret", "VOICE_TOOL_SECRET")) {
    return jsonResponse(req, { error: "No autorizado" }, 401);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const input = await readJson<Record<string, unknown>>(req, 16 * 1024);
    const customerName = typeof input.customer_name === "string"
      ? input.customer_name.trim()
      : "";
    const customerPhone = typeof input.customer_phone === "string"
      ? input.customer_phone.trim()
      : "";
    const branchSlug = typeof input.branch_slug === "string"
      ? input.branch_slug.trim()
      : "";
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    const message = typeof input.message === "string"
      ? input.message.trim()
      : "";
    if (!customerName || !customerPhone || !branchSlug) {
      return jsonResponse(req, {
        error: "customer_name, customer_phone y branch_slug son requeridos",
      }, 400);
    }
    if (
      customerName.length > 160 || customerPhone.length > 64 ||
      branchSlug.length > 100 || reason.length > 500 || message.length > 4000
    ) {
      return jsonResponse(req, {
        error: "Uno o más campos exceden el tamaño permitido",
      }, 400);
    }
    const limited = await consumeRateLimit(
      supabase,
      "registrar-contacto",
      requestActor(req, customerPhone),
      30,
      60,
    );
    if (!limited.allowed) {
      return jsonResponse(req, { error: "Demasiadas solicitudes" }, 429, {
        "Retry-After": "60",
      });
    }

    const { data: branch } = await supabase
      .from("branches")
      .select("id, restaurant_id")
      .eq("slug", branchSlug)
      .maybeSingle();
    if (!branch) {
      return jsonResponse(req, { error: "Sucursal no encontrada" }, 400);
    }

    const { error } = await supabase.from("callback_requests").insert({
      restaurant_id: branch?.restaurant_id,
      branch_id: branch?.id ?? null,
      customer_name: customerName,
      customer_phone: customerPhone,
      reason: reason || null,
      message: message || null,
      source: "voice",
    });
    if (error) throw error;

    return jsonResponse(req, { ok: true });
  } catch (err) {
    console.error("registrar-contacto error:", err);
    const status = err instanceof HttpInputError ? err.status : 500;
    return jsonResponse(req, {
      error: err instanceof HttpInputError ? err.message : "Error interno",
    }, status);
  }
});
