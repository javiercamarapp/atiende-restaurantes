// Página completa de detalle de un pedido — pedido real de Javier el
// 4-sep-2026: "rediseñalo, no es un pop up, cada pedido tiene su página
// completa con todo compacto elegante y descripción, y abajo otros pedidos
// recientes". Reemplaza el modal (Dialog) anterior por una vista de página
// completa, reusada donde sea que se listen pedidos (Historial, Pedidos,
// Notificaciones, panel del repartidor): el padre solo mantiene un
// `pedidoDetalleId` y renderiza esta sección EN VEZ de la lista normal
// mientras haya un id activo — "Volver" limpia el id y regresa a la lista.
//
// Autosuficiente a propósito (fetch propio del pedido y de los recientes)
// para que cualquier lista pueda montarla con tres props nada más.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Loader2, User, Phone, MapPin, CreditCard, Banknote, Wallet, StickyNote,
  Mic, MessageCircle, Globe, AlertTriangle, ArrowLeft, ShoppingCart, Store,
} from "lucide-react";

interface PedidoDetalle {
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
  branch_id: string | null;
  restaurant_id: string | null;
  incident_note: string | null;
  items: { id?: string; name: string; quantity: number; price: number }[] | null;
  notes: string | null;
  payment_method: string | null;
  delivered_at: string | null;
}

interface PedidoReciente {
  id: string;
  order_number: number | null;
  customer_name: string;
  total: number;
  status: string | null;
  created_at: string | null;
  branch: string | null;
  source: string | null;
}

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

const numeroPedido = (d: { id: string; order_number: number | null }) =>
  d.order_number != null ? `Venta ${String(d.order_number).padStart(4, "0")}` : `#${d.id.slice(0, 8).toUpperCase()}`;

const formatoMXN = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });

const IconoFuente = ({ source }: { source: string | null }) =>
  source === "voice" ? <Mic className="w-4 h-4 text-primary" strokeWidth={1.75} />
  : source === "whatsapp" ? <MessageCircle className="w-4 h-4 text-primary" strokeWidth={1.75} />
  : <ShoppingCart className="w-4 h-4 text-primary" strokeWidth={1.75} />;

export default function PedidoDetalleSection({
  orderId,
  onVolver,
  onSelect,
}: {
  orderId: string;
  onVolver: () => void;
  onSelect: (id: string) => void;
}) {
  const [detalle, setDetalle] = useState<PedidoDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const [reintento, setReintento] = useState(0);
  const [recientes, setRecientes] = useState<PedidoReciente[]>([]);
  const [cargandoRecientes, setCargandoRecientes] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setDetalle(null);
    setErrorDetalle(null);
    supabase
      .from("orders")
      .select("id, order_number, customer_name, customer_phone, customer_address, total, status, created_at, source, branch, branch_id, restaurant_id, incident_note, items, notes, payment_method, delivered_at")
      .eq("id", orderId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelado) return;
        setCargando(false);
        if (error) {
          setErrorDetalle(error.message);
          return;
        }
        if (!data) {
          setErrorDetalle("El pedido no existe o ya no tienes acceso a él.");
          return;
        }
        setDetalle(data as unknown as PedidoDetalle | null);
      })
      .catch((error: unknown) => {
        if (cancelado) return;
        setCargando(false);
        setErrorDetalle(error instanceof Error ? error.message : "No fue posible consultar el pedido.");
      });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, reintento]);

  // "Otros pedidos recientes": mismo restaurante, excluyendo el pedido
  // actual — carga aparte una vez que se conoce el restaurant_id real del
  // pedido (no antes, para no adivinar).
  useEffect(() => {
    if (!detalle?.restaurant_id) return;
    let cancelado = false;
    setCargandoRecientes(true);
    supabase
      .from("orders")
      .select("id, order_number, customer_name, total, status, created_at, branch, source")
      .eq("restaurant_id", detalle.restaurant_id)
      .neq("id", detalle.id)
      .not("customer_phone", "ilike", "widget-%")
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (cancelado) return;
        setCargandoRecientes(false);
        setRecientes((data as PedidoReciente[] | null) ?? []);
      });
    return () => { cancelado = true; };
  }, [detalle?.restaurant_id, detalle?.id]);

  return (
    <div className="w-full min-w-0 space-y-4">
      <button
        onClick={onVolver}
        className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
        Volver
      </button>

      {cargando ? (
        <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : errorDetalle || !detalle ? (
        <div role="alert" className="w-full rounded-2xl border border-destructive/30 bg-card p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <p className="text-sm font-medium text-foreground">No se pudo cargar el pedido</p>
          <p className="mt-1 text-xs text-muted-foreground">{errorDetalle ?? "Pedido no encontrado."}</p>
          <Button className="mt-4" variant="outline" onClick={() => setReintento((valor) => valor + 1)}>
            Volver a intentar
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="font-display text-2xl font-semibold text-foreground">{numeroPedido(detalle)}</h2>
                <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-medium ${badgeDeEstado(detalle.status).clase}`}>
                  {badgeDeEstado(detalle.status).etiqueta}
                </span>
              </div>
              <p className="text-[12.5px] text-muted-foreground mt-1">
                {detalle.created_at ? format(new Date(detalle.created_at), "d MMM yyyy, HH:mm", { locale: es }) : "—"}
                {detalle.branch ? ` · ${detalle.branch}` : ""}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-[13px]">
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
              <div className="flex items-start gap-2">
                {detalle.source === "voice" ? <Mic className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" /> : detalle.source === "whatsapp" ? <MessageCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" /> : <Globe className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                <div className="min-w-0">
                  <p className="text-foreground">{detalle.source === "voice" ? "Llamada" : detalle.source === "whatsapp" ? "WhatsApp" : detalle.source ?? "—"}</p>
                  <p className="text-[11px] text-muted-foreground">Canal</p>
                </div>
              </div>
              {detalle.customer_address && (
                <div className="flex items-start gap-2 col-span-2 sm:col-span-2">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-foreground">{detalle.customer_address}</p>
                    <p className="text-[11px] text-muted-foreground">Dirección de entrega</p>
                  </div>
                </div>
              )}
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
                    <th className="px-3 py-2 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">Producto</th>
                    <th className="px-3 py-2 text-[10px] font-mono uppercase tracking-wide text-muted-foreground text-right">Cant.</th>
                    <th className="px-3 py-2 text-[10px] font-mono uppercase tracking-wide text-muted-foreground text-right">P. unit.</th>
                    <th className="px-3 py-2 text-[10px] font-mono uppercase tracking-wide text-muted-foreground text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(detalle.items ?? []).map((it, idx) => (
                    <tr key={it.id ?? idx} className="border-b border-dashed border-border last:border-0">
                      <td className="px-3 py-2 text-foreground">{it.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground">{it.quantity}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatoMXN(Number(it.price))}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground font-medium">{formatoMXN(Number(it.price) * it.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40">
                    <td colSpan={3} className="px-3 py-2.5 text-right text-[11px] font-mono uppercase tracking-wide text-muted-foreground">Total</td>
                    <td className="px-3 py-2.5 text-right font-display text-[15px] font-semibold tabular-nums text-foreground">{formatoMXN(Number(detalle.total))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {detalle.notes && (
              <div className="flex items-start gap-2 rounded-xl border border-border p-3">
                <StickyNote className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-foreground text-[13px]">{detalle.notes}</p>
                  <p className="text-[11px] text-muted-foreground">Instrucciones especiales</p>
                </div>
              </div>
            )}

            {detalle.status === "problema" && detalle.incident_note && (
              <div className="flex items-start gap-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-3">
                <AlertTriangle className="w-4 h-4 text-fuchsia-700 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-foreground text-[13px]">{detalle.incident_note}</p>
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

          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground px-1">Pedidos recientes</p>
            {cargandoRecientes ? (
              <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : recientes.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground px-1">No hay más pedidos recientes.</p>
            ) : (
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                {recientes.map((r) => {
                  const badge = badgeDeEstado(r.status);
                  return (
                    <button
                      key={r.id}
                      onClick={() => onSelect(r.id)}
                      className="w-full p-3 flex items-center justify-between gap-3 border-b border-dashed border-border last:border-0 hover:bg-muted/40 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <IconoFuente source={r.source} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-foreground truncate">{r.customer_name}</p>
                          <p className="text-[11.5px] text-muted-foreground truncate flex items-center gap-1">
                            {numeroPedido(r)}
                            {r.branch && <><Store className="w-3 h-3 shrink-0" strokeWidth={1.75} />{r.branch}</>}
                            {r.created_at ? ` · ${format(new Date(r.created_at), "d MMM, HH:mm", { locale: es })}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className="font-display text-[13px] font-semibold tabular-nums text-foreground">{formatoMXN(Number(r.total))}</p>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-medium ${badge.clase}`}>{badge.etiqueta}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
