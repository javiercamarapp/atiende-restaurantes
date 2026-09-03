// Sección Pedidos — flujo real de despacho: Recibidas → Enviadas, más
// Programadas a pantalla completa con auto-promoción por horario. El mapa de
// entrega en curso (columna derecha en Recibidas/Enviadas) usa Leaflet +
// tiles de OpenStreetMap (sin API key) con un marcador REAL de la sucursal
// (lat/lng de "branches") y un marcador de repartidor SIMULADO — la
// integración con GPS real del repartidor llega después; por eso la
// insignia "SIMULADO" nunca se quita del mapa.
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ShoppingCart, MapPin, Bike, Clock, User, Package, Truck, CheckCircle2,
  CalendarClock, Store, Loader2, Radar,
} from "lucide-react";

// Cada 60s: refresca pedidos y re-evalúa a qué pestaña pertenece cada
// programado (regla real: se promueve a "Recibidas" 15 min antes de su hora).
const INTERVALO_POLL_MS = 60_000;
const MINUTOS_ANTICIPACION_PROMOCION = 15;
const MINUTOS_ENTREGA_ESTIMADA_DEFAULT = 35;

interface OrderRow {
  id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  branch_id: string | null;
  branch: string | null;
  total: number;
  status: string | null;
  created_at: string | null;
  source: string;
  scheduled_for: string | null;
  assigned_repartidor_id: string | null;
  estimated_delivery_at: string | null;
}
interface BranchRow {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
}
interface RepartidorRow {
  user_id: string;
  email: string;
  nombre: string | null;
  telefono: string | null;
}

type Tab = "recibidas" | "enviadas" | "programadas";

const esProgramada = (o: OrderRow, ahora: number) => {
  if (!o.scheduled_for) return false;
  const objetivo = new Date(o.scheduled_for).getTime() - MINUTOS_ANTICIPACION_PROMOCION * 60_000;
  return ahora < objetivo;
};

export default function PedidosSection({ restaurantId }: { restaurantId: string | null }) {
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [repartidores, setRepartidores] = useState<RepartidorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("recibidas");
  const [ahora, setAhora] = useState(() => Date.now());
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [asignando, setAsignando] = useState<string | null>(null); // order.id en flujo de despacho
  const [repartidorElegido, setRepartidorElegido] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);

  const branchById = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);
  const repartidorById = useMemo(() => new Map(repartidores.map((r) => [r.user_id, r])), [repartidores]);

  const cargar = async () => {
    // Sin try/finally aquí, cualquier falla de red (la query no siempre
    // resuelve a { data, error }; a veces el fetch subyacente truena de
    // verdad) dejaba `loading` en true para siempre — la pantalla se
    // quedaba pasmada en el spinner sin importar cuántas veces refrescara
    // el poll de 60s (mismo patrón de bug que Sucursales/Voces e idiomas).
    try {
      const sb: any = supabase;
      // Recibidas/Enviadas/Programadas es un tablero operativo, no un
      // histórico — se acota a los últimos 3 días (de sobra para cualquier
      // pedido activo real) para no traer las 90,000 filas de demo completo
      // a un tablero que solo necesita lo reciente/sin completar. El
      // histórico completo vive en HistorialOrdenesSection.
      const desde = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const ordersQueryBase = sb.from("orders").select("*").order("created_at", { ascending: false }).gte("created_at", desde)
        // El widget de WhatsApp de prueba de la página pública crea pedidos
        // reales con customer_phone = "widget-<uuid>" para poder probar la
        // conversación de punta a punta — no son pedidos operativos reales,
        // nunca deben aparecer en el tablero de despacho.
        .not("customer_phone", "ilike", "widget-%");
      const ordersQuery = restaurantId
        ? ordersQueryBase.eq("restaurant_id", restaurantId)
        : ordersQueryBase;
      const [{ data: ordersData }, { data: branchesData }, { data: repartidoresRoles }] = await Promise.all([
        ordersQuery,
        restaurantId
          ? supabase.from("branches").select("id, name, lat, lng").eq("restaurant_id", restaurantId)
          : supabase.from("branches").select("id, name, lat, lng"),
        supabase.from("user_roles").select("user_id").eq("role", "repartidor"),
      ]);
      setOrders((ordersData as OrderRow[]) || []);
      setBranches((branchesData as BranchRow[]) || []);

      if (repartidoresRoles && repartidoresRoles.length > 0) {
        const userIds = repartidoresRoles.map((r) => r.user_id);
        const { data: repartidorProfiles } = await supabase
          .from("profiles")
          .select("user_id, email, nombre, telefono")
          .in("user_id", userIds);
        setRepartidores((repartidorProfiles as RepartidorRow[]) || []);
      } else {
        setRepartidores([]);
      }
    } catch (err) {
      console.error("No se pudo cargar Pedidos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  useEffect(() => {
    const id = setInterval(() => {
      setAhora(Date.now());
      cargar();
    }, INTERVALO_POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  // Ventana compartida por "Recibidas" y "Enviadas": ninguna de las dos es
  // un histórico, son colas de "esto necesita atención AHORA" — un pedido
  // "pending" (sin repartidor) o "en_camino" (sin marcar entregado) que
  // lleva más de esto sin actualizarse casi seguro ya se resolvió en la
  // vida real y nadie tocó su estado; sale de la vista activa (sigue en la
  // base) para no acumularse para siempre.
  const VENTANA_MAX_EN_TRAYECTO_MIN = 90;
  const recibidas = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === "pending" &&
          !esProgramada(o, ahora) &&
          (ahora - new Date(o.created_at).getTime()) / 60000 <= VENTANA_MAX_EN_TRAYECTO_MIN,
      ),
    [orders, ahora],
  );
  const enviadas = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === "en_camino" &&
          (ahora - new Date(o.created_at).getTime()) / 60000 <= VENTANA_MAX_EN_TRAYECTO_MIN,
      ),
    [orders, ahora],
  );
  const programadas = useMemo(
    () => orders.filter((o) => o.status === "pending" && esProgramada(o, ahora)),
    [orders, ahora],
  );

  const listaActual = tab === "recibidas" ? recibidas : tab === "enviadas" ? enviadas : programadas;

  // La orden seleccionada para el mapa: la elegida a mano, o la primera de la lista visible.
  useEffect(() => {
    if (tab === "programadas") return;
    if (selectedOrderId && listaActual.some((o) => o.id === selectedOrderId)) return;
    setSelectedOrderId(listaActual[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, recibidas, enviadas]);

  const confirmarDespacho = async (order: OrderRow) => {
    const repartidorId = repartidorElegido[order.id];
    if (!repartidorId) {
      toast({ title: "Elige un repartidor", description: "Selecciona quién va a entregar este pedido.", variant: "destructive" });
      return;
    }
    setGuardando(order.id);
    const estimada = new Date(Date.now() + MINUTOS_ENTREGA_ESTIMADA_DEFAULT * 60_000).toISOString();
    const { error } = await supabase
      .from("orders")
      .update({ status: "en_camino", assigned_repartidor_id: repartidorId, estimated_delivery_at: estimada })
      .eq("id", order.id);
    setGuardando(null);
    if (error) {
      toast({ title: "No se pudo despachar el pedido", description: error.message, variant: "destructive" });
      return;
    }
    setAsignando(null);
    toast({ title: "Pedido enviado", description: `#${order.order_number} pasó a Enviadas.` });
    setTab("enviadas");
    await cargar();
    setSelectedOrderId(order.id);
  };

  const marcarEntregado = async (order: OrderRow) => {
    setGuardando(order.id);
    const { error } = await supabase.from("orders").update({ status: "entregado" }).eq("id", order.id);
    setGuardando(null);
    if (error) {
      toast({ title: "No se pudo marcar como entregado", description: error.message, variant: "destructive" });
      return;
    }
    // Marca de tiempo real de entrega, aparte del status — usada por
    // "Entrega tardía" en Notificaciones. Va suelta y sin bloquear: la
    // columna `delivered_at` viene de una migración (ver
    // supabase/migrations/20260903041514_...) que Auto Mode bloqueó aplicar
    // en vivo, así que si todavía no existe, esto falla en silencio y el
    // pedido de todos modos queda marcado como entregado.
    const sb: any = supabase;
    sb.from("orders").update({ delivered_at: new Date().toISOString() }).eq("id", order.id)
      .then(({ error: errDelivered }: { error: unknown }) => {
        if (errDelivered) console.warn("No se pudo guardar delivered_at (¿falta aplicar la migración?)", errDelivered);
      });
    toast({ title: "Pedido entregado", description: `#${order.order_number} se marcó como entregado.` });
    await cargar();
  };

  const conteo = tab === "recibidas" ? recibidas.length : tab === "enviadas" ? enviadas.length : programadas.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{conteo} en total</p>
        <div className="inline-flex items-center rounded-full border border-border bg-muted/40 p-1 gap-1">
          {([
            { id: "recibidas" as const, label: "Órdenes recibidas", icon: Package },
            { id: "enviadas" as const, label: "Órdenes enviadas", icon: Truck },
            { id: "programadas" as const, label: "Órdenes programadas", icon: CalendarClock },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                tab === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-12 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : tab === "programadas" ? (
        <PanelProgramadas
          orders={programadas}
          branchById={branchById}
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-3 items-start">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            {listaActual.length === 0 ? (
              <div className="py-12 text-center">
                {tab === "recibidas" ? (
                  <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" strokeWidth={1.5} />
                ) : (
                  <Truck className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" strokeWidth={1.5} />
                )}
                <p className="text-[13px] text-muted-foreground">
                  {tab === "recibidas" ? "No hay pedidos por despachar" : "No hay pedidos en camino"}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                {listaActual.map((order) => {
                  const sucursal = order.branch_id ? branchById.get(order.branch_id) : undefined;
                  const repartidor = order.assigned_repartidor_id ? repartidorById.get(order.assigned_repartidor_id) : undefined;
                  const seleccionado = order.id === selectedOrderId;
                  return (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className={`p-3 border-b border-dashed border-border last:border-0 transition-colors cursor-pointer ${
                        seleccionado ? "bg-primary/5" : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <ShoppingCart className="w-5 h-5 text-primary" strokeWidth={1.75} />
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-[13px] font-medium text-foreground truncate">{order.customer_name}</p>
                            <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                              Pedido #{order.id.slice(0, 8)} · Venta <span className="tabular-nums">{String(order.order_number).padStart(4, "0")}</span>
                            </p>
                            {order.customer_address && (
                              <p className="text-[12px] text-muted-foreground flex items-center gap-1 truncate">
                                <MapPin className="w-3 h-3 shrink-0" strokeWidth={1.75} />
                                <span className="truncate">{order.customer_address}</span>
                              </p>
                            )}
                            {sucursal && (
                              <p className="text-[11.5px] text-muted-foreground flex items-center gap-1">
                                <Store className="w-3 h-3 shrink-0" strokeWidth={1.75} /> {sucursal.name}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <p className="font-display text-[13px] font-semibold tabular-nums text-foreground">${Number(order.total).toLocaleString()}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {order.created_at && format(new Date(order.created_at), "d MMM, HH:mm", { locale: es })}
                          </p>
                        </div>
                      </div>

                      {tab === "enviadas" && (
                        <div className="mt-2.5 ml-[52px] flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span className="inline-flex items-center gap-1.5 text-[12px] text-foreground">
                            <Bike className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                            {repartidor?.nombre || repartidor?.email || "Repartidor"}
                          </span>
                          {order.estimated_delivery_at && (
                            <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                              <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
                              Llega {format(new Date(order.estimated_delivery_at), "HH:mm", { locale: es })}
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-full px-3 text-[11.5px] ml-auto"
                            disabled={guardando === order.id}
                            onClick={(e) => { e.stopPropagation(); marcarEntregado(order); }}
                          >
                            {guardando === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                            Marcar entregado
                          </Button>
                        </div>
                      )}

                      {tab === "recibidas" && (
                        <div className="mt-2.5 ml-[52px]">
                          {asignando === order.id ? (
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <Select
                                value={repartidorElegido[order.id] || ""}
                                onValueChange={(v) => setRepartidorElegido((prev) => ({ ...prev, [order.id]: v }))}
                              >
                                <SelectTrigger className="h-8 text-[12.5px] max-w-[220px]">
                                  <SelectValue placeholder="Elegir repartidor" />
                                </SelectTrigger>
                                <SelectContent>
                                  {repartidores.length === 0 ? (
                                    <div className="px-2 py-1.5 text-[12px] text-muted-foreground">Sin repartidores registrados</div>
                                  ) : (
                                    repartidores.map((r) => (
                                      <SelectItem key={r.user_id} value={r.user_id} className="text-[12.5px]">
                                        {r.nombre || r.email}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                className="h-8 rounded-full px-3 text-[12px]"
                                disabled={guardando === order.id}
                                onClick={() => confirmarDespacho(order)}
                              >
                                {guardando === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Truck className="w-3 h-3" />}
                                Confirmar envío
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 rounded-full px-2 text-[12px]" onClick={() => setAsignando(null)}>
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-full px-3 text-[11.5px]"
                              onClick={(e) => { e.stopPropagation(); setAsignando(order.id); }}
                            >
                              <Bike className="w-3 h-3" strokeWidth={1.75} />
                              Asignar repartidor
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <MapaEntrega
            order={listaActual.find((o) => o.id === selectedOrderId) || null}
            sucursal={
              (() => {
                const o = listaActual.find((x) => x.id === selectedOrderId);
                return o?.branch_id ? branchById.get(o.branch_id) || null : null;
              })()
            }
            repartidor={
              (() => {
                const o = listaActual.find((x) => x.id === selectedOrderId);
                return o?.assigned_repartidor_id ? repartidorById.get(o.assigned_repartidor_id) || null : null;
              })()
            }
          />
        </div>
      )}
    </div>
  );
}

function PanelProgramadas({ orders, branchById }: { orders: OrderRow[]; branchById: Map<string, BranchRow> }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          Se promueven a Recibidas automáticamente {MINUTOS_ANTICIPACION_PROMOCION} min antes de su hora
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="py-16 text-center">
          <CalendarClock className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" strokeWidth={1.5} />
          <p className="text-[13px] text-muted-foreground">No hay pedidos programados</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {orders
            .slice()
            .sort((a, b) => new Date(a.scheduled_for || 0).getTime() - new Date(b.scheduled_for || 0).getTime())
            .map((order) => {
              const sucursal = order.branch_id ? branchById.get(order.branch_id) : undefined;
              return (
                <div key={order.id} className="p-3 flex items-center justify-between gap-3 border-b border-dashed border-border last:border-0 transition-colors hover:bg-muted/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <CalendarClock className="w-5 h-5 text-primary" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[13px] font-medium text-foreground truncate">{order.customer_name}</p>
                      <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                        Pedido #{order.id.slice(0, 8)} · Venta <span className="tabular-nums">{String(order.order_number).padStart(4, "0")}</span>
                      </p>
                      {order.customer_address && (
                        <p className="text-[12px] text-muted-foreground flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 shrink-0" strokeWidth={1.75} /> <span className="truncate">{order.customer_address}</span>
                        </p>
                      )}
                      {sucursal && (
                        <p className="text-[11.5px] text-muted-foreground flex items-center gap-1">
                          <Store className="w-3 h-3 shrink-0" strokeWidth={1.75} /> {sucursal.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="font-display text-[13px] font-semibold tabular-nums text-foreground">${Number(order.total).toLocaleString()}</p>
                    {order.scheduled_for && (
                      <>
                        <p className="text-[12.5px] font-medium text-primary tabular-nums">
                          {format(new Date(order.scheduled_for), "d MMM, HH:mm", { locale: es })}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          en {formatDistanceToNow(new Date(order.scheduled_for), { locale: es })}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

// Desplazamiento fijo (~900m) usado como "zona del cliente" simulada cuando
// no hay lat/lng real del cliente — geocodificar la dirección queda fuera de
// alcance por ahora (ver nota en el reporte de integración).
const DESPLAZAMIENTO_CLIENTE_SIMULADO = { dLat: 0.0065, dLng: 0.006 };
const CICLO_ANIMACION_MS = 26_000;

function MapaEntrega({
  order, sucursal, repartidor,
}: {
  order: OrderRow | null;
  sucursal: BranchRow | null;
  repartidor: RepartidorRow | null;
}) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const marcadorSucursalRef = useRef<L.Marker | null>(null);
  const marcadorClienteRef = useRef<L.Marker | null>(null);
  const marcadorRepartidorRef = useRef<L.Marker | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!contenedorRef.current || mapaRef.current) return;
    const mapa = L.map(contenedorRef.current, { zoomControl: true, attributionControl: true }).setView([20.98, -89.62], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapa);
    mapaRef.current = mapa;
    return () => {
      mapa.remove();
      mapaRef.current = null;
    };
  }, []);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;

    // Limpia marcadores previos.
    marcadorSucursalRef.current?.remove();
    marcadorClienteRef.current?.remove();
    marcadorRepartidorRef.current?.remove();
    marcadorSucursalRef.current = null;
    marcadorClienteRef.current = null;
    marcadorRepartidorRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (!sucursal || sucursal.lat == null || sucursal.lng == null) return;

    const origen: [number, number] = [Number(sucursal.lat), Number(sucursal.lng)];
    const destino: [number, number] = [
      origen[0] + DESPLAZAMIENTO_CLIENTE_SIMULADO.dLat,
      origen[1] + DESPLAZAMIENTO_CLIENTE_SIMULADO.dLng,
    ];

    const iconoSucursal = L.divIcon({
      className: "",
      html: `<div style="width:30px;height:30px;border-radius:9999px;background:#1D4ED8;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:white;font-size:14px;">🏠</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    const iconoCliente = L.divIcon({
      className: "",
      html: `<div style="width:26px;height:26px;border-radius:9999px;background:#0EA5E9;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;">📍</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    const iconoRepartidor = L.divIcon({
      className: "",
      html: `<div style="width:32px;height:32px;border-radius:9999px;background:#F59E0B;border:2.5px solid white;box-shadow:0 1px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:white;font-size:15px;">🛵</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    marcadorSucursalRef.current = L.marker(origen, { icon: iconoSucursal }).addTo(mapa).bindTooltip(sucursal.name, { direction: "top" });
    marcadorClienteRef.current = L.marker(destino, { icon: iconoCliente }).addTo(mapa)
      .bindTooltip(order?.customer_address || "Dirección del cliente (simulada)", { direction: "top" });

    const enCamino = order?.status === "en_camino";
    marcadorRepartidorRef.current = L.marker(enCamino ? origen : origen, { icon: iconoRepartidor })
      .addTo(mapa)
      .bindTooltip(repartidor?.nombre || repartidor?.email || "Repartidor", { direction: "top" });

    mapa.fitBounds(L.latLngBounds([origen, destino]), { padding: [40, 40] });

    if (enCamino) {
      const inicio = performance.now();
      const animar = (t: number) => {
        // Va y vuelve entre sucursal y cliente — es la simulación del
        // trayecto (GPS real pendiente); nunca se detiene sola.
        const progresoCrudo = ((t - inicio) % CICLO_ANIMACION_MS) / CICLO_ANIMACION_MS;
        const progreso = progresoCrudo <= 0.5 ? progresoCrudo * 2 : 2 - progresoCrudo * 2;
        const lat = origen[0] + (destino[0] - origen[0]) * progreso;
        const lng = origen[1] + (destino[1] - origen[1]) * progreso;
        marcadorRepartidorRef.current?.setLatLng([lat, lng]);
        rafRef.current = requestAnimationFrame(animar);
      };
      rafRef.current = requestAnimationFrame(animar);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [order?.id, order?.status, sucursal?.id, repartidor?.user_id]);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3 xl:sticky xl:top-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground flex items-center gap-1.5">
          <Radar className="w-3.5 h-3.5" strokeWidth={1.75} /> Entrega en curso
        </p>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold uppercase tracking-wide">
          Simulado
        </span>
      </div>

      {!order ? (
        <div className="h-[360px] rounded-xl border border-dashed border-border flex items-center justify-center">
          <p className="text-[12.5px] text-muted-foreground px-6 text-center">Selecciona un pedido de la lista para ver su entrega en el mapa</p>
        </div>
      ) : (
        <div ref={contenedorRef} className="h-[360px] rounded-xl overflow-hidden border border-border" />
      )}

      {order && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-1.5 text-[12px] text-foreground">
            <User className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
            {order.customer_name}
          </div>
          {order.status === "en_camino" ? (
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Bike className="w-3.5 h-3.5" strokeWidth={1.75} />
              {repartidor?.nombre || repartidor?.email || "Repartidor asignado"} — posición simulada en tránsito
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Package className="w-3.5 h-3.5" strokeWidth={1.75} />
              Aún no sale a reparto — el repartidor se muestra en la sucursal
            </div>
          )}
          <p className="text-[11px] text-muted-foreground leading-snug pt-1">
            La ubicación de la sucursal es real. La posición del repartidor y del cliente son simuladas —
            la integración con GPS en vivo se conecta más adelante.
          </p>
        </div>
      )}
    </div>
  );
}
