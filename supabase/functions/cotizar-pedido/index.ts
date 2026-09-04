// Server Tool compartido por voz y WhatsApp para validar presentaciones y
// calcular el total antes de cobrar. La aritmética y la conversión
// piezas -> órdenes viven en create-order-core.ts, no en el LLM.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0"
import {
  OrderValidationError,
  quoteOrderCore,
  RequestedOrderItemInput,
} from "../_shared/create-order-core.ts"
import {
  consumeRateLimit,
  HttpInputError,
  jsonResponse,
  preflightResponse,
  readJson,
  requestActor,
  secretMatches,
} from "../_shared/http-security.ts"

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflightResponse(req)
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Método no permitido" }, 405)
  }
  if (!secretMatches(req, "x-atiende-tool-secret", "VOICE_TOOL_SECRET")) {
    return jsonResponse(req, { error: "No autorizado" }, 401)
  }

  try {
    const payload = await readJson<{
      branch_slug: string
      items: RequestedOrderItemInput[]
      adult_confirmed?: boolean
    }>(req, 24 * 1024)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )
    const limited = await consumeRateLimit(
      supabase,
      "cotizar-pedido",
      requestActor(req, String(payload.branch_slug ?? "")),
      120,
      60,
    )
    if (!limited.allowed) {
      return jsonResponse(req, { error: "Demasiadas solicitudes" }, 429, {
        "Retry-After": "60",
      })
    }

    const quote = await quoteOrderCore(supabase, payload)
    return jsonResponse(req, { quote })
  } catch (error) {
    console.error("cotizar-pedido error:", error)
    const status = error instanceof HttpInputError
      ? error.status
      : error instanceof OrderValidationError
      ? 400
      : 500
    const message =
      error instanceof HttpInputError || error instanceof OrderValidationError
        ? error.message
        : "Error interno"
    return jsonResponse(req, { error: message }, status)
  }
})
