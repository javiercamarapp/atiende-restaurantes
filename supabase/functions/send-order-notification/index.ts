// Handler interno de correo por evento de pedido. Busca, dentro del staff del
// tenant, destinatarios con la preferencia activa y llama a Resend. Este repo
// todavía no versiona el dispatcher/outbox que deba invocarlo; por eso no se
// debe afirmar que los correos son automáticos hasta cerrar INT-05 de la
// auditoría y verificar el flujo en staging.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import {
  correoPedidoCancelado,
  correoPedidoEnCamino,
  correoPedidoEntregado,
  correoPedidoNuevo,
  correoPedidoPreparando,
  correoPedidoProblema,
  type PedidoCorreo,
} from "../_shared/emails/plantillas.ts";
import {
  consumeRateLimit,
  HttpInputError,
  jsonResponse,
  readJson,
  requestActor,
  secretMatches,
} from "../_shared/http-security.ts";
import { fetchWithTimeout as fetch } from "../_shared/fetch-timeout.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM") ??
  "atiende.ai <notificaciones@useatiende.ai>";

const EVENTO_A_COLUMNA: Record<string, string> = {
  nuevo: "notify_nuevo",
  preparando: "notify_preparando",
  en_camino: "notify_en_camino",
  entregado: "notify_entregado",
  completado: "notify_entregado",
  cancelado: "notify_cancelado",
  // Estado genérico "problema" (pedido real de Javier el 3-sep-2026): reusa
  // la misma preferencia que "cancelado" — ambos son la señal real de "algo
  // salió mal", y separar una preferencia nueva solo para esto no vale la
  // pena mientras no haya pedido explícito de controlarlas por separado.
  problema: "notify_cancelado",
};

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return jsonResponse(req, { error: "Método no permitido" }, 405);
    }
    if (
      !secretMatches(
        req,
        "x-atiende-internal-secret",
        "INTERNAL_WEBHOOK_SECRET",
      )
    ) return jsonResponse(req, { error: "No autorizado" }, 401);
    const { order_id, evento } = await readJson<
      { order_id?: unknown; evento?: unknown }
    >(req, 4 * 1024);
    if (
      typeof order_id !== "string" || order_id.length > 64 ||
      typeof evento !== "string" || evento.length > 40
    ) {
      return jsonResponse(req, { error: "Payload inválido" }, 400);
    }
    const columna = EVENTO_A_COLUMNA[evento as string];
    if (!columna) {
      // Evento sin plantilla (ej. status "pending" en un update) — no es
      // un error, simplemente no hay nada que mandar.
      return jsonResponse(req, { skipped: true });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const limited = await consumeRateLimit(
      supabase,
      "send-order-notification",
      requestActor(req, order_id),
      120,
      60,
    );
    if (!limited.allowed) {
      return jsonResponse(req, { error: "Demasiadas solicitudes" }, 429, {
        "Retry-After": "60",
      });
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, customer_name, customer_phone, customer_address, total, source, items, restaurant_id, branch_id, incident_note, branches(name), restaurants(name)",
      )
      .eq("id", order_id)
      .single();
    if (orderError || !order) {
      throw orderError ?? new Error("Pedido no encontrado");
    }

    const { data: destinatarios, error: staffError } = await supabase
      .from("restaurant_staff")
      .select(`user_id, ${columna}, profiles!inner(email)`)
      .eq("restaurant_id", order.restaurant_id)
      .eq(columna, true);
    if (staffError) throw staffError;

    const correos = (destinatarios ?? [])
      .map((d: any) => d.profiles?.email as string | undefined)
      .filter((email: string | undefined): email is string => !!email);

    if (correos.length === 0 || !RESEND_API_KEY) {
      return jsonResponse(req, {
        sent: 0,
        reason: !RESEND_API_KEY
          ? "RESEND_API_KEY no configurada"
          : "sin destinatarios",
      });
    }

    const itemsTexto = Array.isArray(order.items)
      ? order.items.map((it: any) =>
        `${it.quantity ?? it.cantidad ?? 1}x ${
          it.name ?? it.nombre ?? "Producto"
        }`
      ).join(", ")
      : "";

    const pedido: PedidoCorreo = {
      id: order.id,
      restauranteNombre: (order.restaurants as any)?.name ?? "tu restaurante",
      sucursalNombre: (order.branches as any)?.name ?? "tu sucursal",
      clienteNombre: order.customer_name,
      clienteTelefono: order.customer_phone,
      direccion: order.customer_address,
      total: Number(order.total),
      fuente: order.source ?? "web",
      itemsTexto,
    };

    // "problema" es el único evento cuya plantilla real necesita un segundo
    // argumento (la nota real de incident_note) — el resto ignora un
    // segundo argumento de sobra sin problema.
    const correoBuilder = {
      nuevo: correoPedidoNuevo,
      preparando: correoPedidoPreparando,
      en_camino: correoPedidoEnCamino,
      entregado: correoPedidoEntregado,
      completado: correoPedidoEntregado,
      cancelado: correoPedidoCancelado,
      problema: correoPedidoProblema,
    }[evento as string]!;

    const { asunto, html, texto } = correoBuilder(
      pedido,
      order.incident_note ?? undefined,
    );

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: correos,
        subject: asunto,
        html,
        text: texto,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Resend respondió ${resp.status}: ${body}`);
    }

    return jsonResponse(req, { sent: correos.length });
  } catch (err) {
    console.error("send-order-notification error", err);
    const status = err instanceof HttpInputError ? err.status : 500;
    return jsonResponse(req, {
      error: err instanceof HttpInputError ? err.message : "Error interno",
    }, status);
  }
});
