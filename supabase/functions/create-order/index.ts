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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import {
  createOrderCore,
  CreateOrderPayload,
  isTrustedVoicePreview,
  OrderValidationError,
  quoteOrderCore,
} from "../_shared/create-order-core.ts";
import {
  consumeRateLimit,
  HttpInputError,
  jsonResponse,
  originAllowed,
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
  if (!originAllowed(req.headers.get("Origin"))) {
    return jsonResponse(req, { error: "Origen no permitido" }, 403);
  }

  try {
    const incoming = await readJson<CreateOrderPayload>(req, 32 * 1024);
    const toolAuthorized = secretMatches(
      req,
      "x-atiende-tool-secret",
      "VOICE_TOOL_SECRET",
    );
    if (incoming.source === "voice" && !toolAuthorized) {
      return jsonResponse(req, { error: "No autorizado" }, 401);
    }
    if (!toolAuthorized && incoming.source && incoming.source !== "web") {
      return jsonResponse(req, { error: "source inválido" }, 400);
    }
    // The authenticated channel, not a client-controlled field, decides provenance.
    const payload: CreateOrderPayload = {
      ...incoming,
      source: toolAuthorized ? "voice" : "web",
    };
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const limited = await consumeRateLimit(
      supabase,
      "create-order",
      requestActor(req, toolAuthorized ? payload.customer_phone : ""),
      toolAuthorized ? 120 : 10,
      60,
    );
    if (!limited.allowed) {
      return jsonResponse(req, { error: "Demasiadas solicitudes" }, 429, {
        "Retry-After": "60",
      });
    }
    if (isTrustedVoicePreview(toolAuthorized, incoming.modo_prueba)) {
      if (!payload.branch_slug) {
        throw new OrderValidationError(
          "branch_slug es requerido para una simulación",
        );
      }
      const quote = await quoteOrderCore(supabase, {
        branch_slug: payload.branch_slug,
        adult_confirmed: payload.adult_confirmed,
        items: payload.items.map((item) => ({
          product_id: item.product_id,
          requested_quantity: item.requested_quantity as number,
          tortilla: item.tortilla,
        })),
      });
      return jsonResponse(req, {
        order: {
          id: `preview-${crypto.randomUUID()}`,
          status: "simulated",
          simulated: true,
          branch_id: quote.branch_id,
          branch: quote.branch_name,
          total: quote.total,
          source: "voice",
          payment_method: payload.payment_method ?? null,
          items: quote.lines.map((line) => ({
            id: line.product_id,
            name: line.name,
            price: line.price,
            quantity: line.quantity,
            ...(line.tortilla ? { tortilla: line.tortilla } : {}),
          })),
        },
      });
    }
    const order = await createOrderCore(supabase, payload);

    return jsonResponse(req, { order });
  } catch (err) {
    console.error("create-order error:", err);
    const status = err instanceof HttpInputError
      ? err.status
      : err instanceof OrderValidationError
      ? 400
      : 500;
    const message =
      err instanceof HttpInputError || err instanceof OrderValidationError
        ? err.message
        : "Error interno";
    return jsonResponse(req, { error: message }, status);
  }
});
