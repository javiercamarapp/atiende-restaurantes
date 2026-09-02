// Disparada por el trigger notificar_cambio_pedido() (pg_net) cada vez que
// se crea un pedido o cambia su status. Busca, dentro del staff del
// restaurante dueño del pedido, a quien tenga activada la preferencia de ese
// evento concreto, y le manda el correo correspondiente por Resend.
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  correoPedidoCancelado,
  correoPedidoEnCamino,
  correoPedidoEntregado,
  correoPedidoNuevo,
  correoPedidoPreparando,
  type PedidoCorreo,
} from "../_shared/emails/plantillas.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "atiende.ai <notificaciones@useatiende.ai>";

const EVENTO_A_COLUMNA: Record<string, string> = {
  nuevo: "notify_nuevo",
  preparando: "notify_preparando",
  en_camino: "notify_en_camino",
  entregado: "notify_entregado",
  completado: "notify_entregado",
  cancelado: "notify_cancelado",
};

Deno.serve(async (req) => {
  try {
    const { order_id, evento } = await req.json();
    const columna = EVENTO_A_COLUMNA[evento as string];
    if (!order_id || !columna) {
      // Evento sin plantilla (ej. status "pending" en un update) — no es
      // un error, simplemente no hay nada que mandar.
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, customer_name, customer_phone, customer_address, total, source, items, restaurant_id, branch_id, branches(name), restaurants(name)")
      .eq("id", order_id)
      .single();
    if (orderError || !order) throw orderError ?? new Error("Pedido no encontrado");

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
      return new Response(JSON.stringify({ sent: 0, reason: !RESEND_API_KEY ? "RESEND_API_KEY no configurada" : "sin destinatarios" }), { status: 200 });
    }

    const itemsTexto = Array.isArray(order.items)
      ? order.items.map((it: any) => `${it.quantity ?? it.cantidad ?? 1}x ${it.name ?? it.nombre ?? "Producto"}`).join(", ")
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

    const correoBuilder = {
      nuevo: correoPedidoNuevo,
      preparando: correoPedidoPreparando,
      en_camino: correoPedidoEnCamino,
      entregado: correoPedidoEntregado,
      completado: correoPedidoEntregado,
      cancelado: correoPedidoCancelado,
    }[evento as string]!;

    const { asunto, html, texto } = correoBuilder(pedido);

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

    return new Response(JSON.stringify({ sent: correos.length }), { status: 200 });
  } catch (err) {
    console.error("send-order-notification error", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
