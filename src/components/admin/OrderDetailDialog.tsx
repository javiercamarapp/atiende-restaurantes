// Modal de detalle completo de un pedido — pedido real de Javier el
// 4-sep-2026: "que en todos los lados que salgan los pedidos, al apretarlo
// te abra detalles" (Historial, Pedidos en curso, Notificaciones, etc).
// Componente compartido y autosuficiente (fetch propio por id, sin depender
// de qué columnas haya traído la lista del componente que lo abre) para que
// CUALQUIER lista de pedidos en el admin pueda reusarlo con un solo prop:
//
//   const [detalleId, setDetalleId] = useState<string | null>(null);
//   ...
//   <OrderDetailDialog orderId={detalleId} onClose={() => setDetalleId(null)} />
//
// y en cada fila/tarjeta: onClick={() => setDetalleId(order.id)}.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Loader2, User, Phone, MapPin, CreditCard, Banknote, Wallet, StickyNote,
  Mic, MessageCircle, Globe, AlertTriangle,
} from "lucide-react";

interface OrderDetalle {
  id: string;
  order_number: number | null;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  total: number;
  status: string | null;
  created_at: string | null;
  source: string | null;
  branch: string | null;
  incident_note: string | null;
  items: { id?: string; name: string; quantity: number; price: number }[] | null;
  notes: string | null;
  payment_method: string | null;
  delivered_at: string | null;
}

// Mismo vocabulario real que ya usan HistorialOrdenesSection/PedidosSection/
// NotificacionesSection — se repite aquí (autosuficiente a propósito) en vez
// de importar de otro componente de sección.
const ESTADO_BADGE: Record<string, { etiqueta: string; clase: string }> = {
  pending: { etiqueta: "Pendiente", clase: "bg-yellow-100 text-yellow-700" },
  preparando: { etiqueta: "Preparando", clase: "bg-orange-100 text-orange-700" },
  en_camino: { etiqueta: "En tránsito", clase: "bg-blue-100 text-blue-700" },
  entregado: { etiqueta: "Entregado", clase: "bg-green-100 text-green-700" },
  completado: { etiqueta: "Entregado", clase: "bg-green-100 text-green-700" },
  cancelado: { etiqueta: "Cancelado", clase: "bg-red-100 text-red-700" },
  problema: { etiqueta: "Incidencia", clase: "bg-fuchsia-100 text-fuchsia-700" },
};
const badgeDeEstado = (status: string | null) =>
  ESTADO_BADGE[status ?? ""] ?? { etiqueta: status || "Sin estado", clase: "bg-muted text-muted-foreground" };

const numeroPedido = (d: Pick<OrderDetalle, "id" | "order_number">) =>
  d.order_number != null ? `Venta ${String(d.order_number).padStart(4, "0")}` : `#${d.id.slice(0, 8).toUpperCase()}`;

const formatoMXN = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });

export default function OrderDetailDialog({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const [detalle, setDetalle] = useState<OrderDetalle | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setDetalle(null);
      return;
    }
    let cancelado = false;
    setCargando(true);
    setDetalle(null);
    supabase
      .from("orders")
      .select("id, order_number, customer_name, customer_phone, customer_address, total, status, created_at, source, branch, incident_note, items, notes, payment_method, delivered_at")
      .eq("id", orderId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelado) return;
        setCargando(false);
        setDetalle(data as unknown as OrderDetalle | null);
      });
    return () => {
      cancelado = true;
    };
  }, [orderId]);

  return (
    <Dialog open={!!orderId} onOpenChange={(abierto) => { if (!abierto) onClose(); }}>
      <DialogContent className="max-w-lg">
        {cargando || !detalle ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {numeroPedido(detalle)}
                <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-medium ${badgeDeEstado(detalle.status).clase}`}>
                  {badgeDeEstado(detalle.status).etiqueta}
                </span>
              </DialogTitle>
              <DialogDescription>
                {detalle.created_at ? format(new Date(detalle.created_at), "d MMM yyyy, HH:mm", { locale: es }) : "—"}
                {detalle.branch ? ` · ${detalle.branch}` : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-[13px]">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-foreground truncate">{detalle.customer_name}</p>
                    <p className="text-[11px] text-muted-foreground">Cliente</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-foreground truncate">{detalle.customer_phone}</p>
                    <p className="text-[11px] text-muted-foreground">Teléfono</p>
                  </div>
                </div>
                {detalle.customer_address && (
                  <div className="flex items-start gap-2 col-span-2">
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-foreground">{detalle.customer_address}</p>
                      <p className="text-[11px] text-muted-foreground">Dirección de entrega</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  {detalle.source === "voice" ? <Mic className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" /> : detalle.source === "whatsapp" ? <MessageCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" /> : <Globe className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <p className="text-foreground">{detalle.source === "voice" ? "Llamada" : detalle.source === "whatsapp" ? "WhatsApp" : detalle.source ?? "—"}</p>
                    <p className="text-[11px] text-muted-foreground">Canal</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  {detalle.payment_method === "tarjeta" ? <CreditCard className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" /> : detalle.payment_method === "efectivo" ? <Banknote className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" /> : <Wallet className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <p className="text-foreground capitalize">{detalle.payment_method ?? "No registrada"}</p>
                    <p className="text-[11px] text-muted-foreground">Forma de pago</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">Producto</th>
                      <th className="px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground text-right">Cant.</th>
                      <th className="px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground text-right">P. unit.</th>
                      <th className="px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detalle.items ?? []).map((it, idx) => (
                      <tr key={it.id ?? idx} className="border-b border-dashed border-border last:border-0">
                        <td className="px-2.5 py-1.5 text-foreground">{it.name}</td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums text-foreground">{it.quantity}</td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">{formatoMXN(Number(it.price))}</td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums text-foreground font-medium">{formatoMXN(Number(it.price) * it.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/40">
                      <td colSpan={3} className="px-2.5 py-2 text-right text-[11px] font-mono uppercase tracking-wide text-muted-foreground">Total</td>
                      <td className="px-2.5 py-2 text-right font-display text-[14px] font-semibold tabular-nums text-foreground">{formatoMXN(Number(detalle.total))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {detalle.notes && (
                <div className="flex items-start gap-2 rounded-xl border border-border p-2.5">
                  <StickyNote className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-foreground">{detalle.notes}</p>
                    <p className="text-[11px] text-muted-foreground">Instrucciones especiales</p>
                  </div>
                </div>
              )}

              {detalle.status === "problema" && detalle.incident_note && (
                <div className="flex items-start gap-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-2.5">
                  <AlertTriangle className="w-4 h-4 text-fuchsia-700 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-foreground">{detalle.incident_note}</p>
                    <p className="text-[11px] text-fuchsia-700">Incidencia reportada</p>
                  </div>
                </div>
              )}

              {detalle.delivered_at && (
                <p className="text-[11.5px] text-muted-foreground">
                  Entregado el {format(new Date(detalle.delivered_at), "d MMM yyyy, HH:mm", { locale: es })}
                </p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
