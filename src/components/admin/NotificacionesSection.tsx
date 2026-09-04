// Centro de notificaciones estilo Rappi: barra de tabs horizontal con
// scroll y un indicador deslizante que brilla (glow) bajo el tab activo —
// mismo mecanismo visual que el centro de notificaciones de Rappi, en el
// azul/cielo de marca de esta app, con tabs reales ligados al ciclo de vida
// real de un pedido (tabla `orders`) más las dos categorías de triage que ya
// existían (quejas anotadas por el agente, escalar a personal). Cada tab lee
// datos reales — nada de contadores inventados.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import PedidoDetalleSection from "@/components/admin/PedidoDetalleSection";
import {
  ShoppingCart, AlertTriangle, PhoneCall, SlidersHorizontal,
  Mic, MessageCircle, Loader2, Package, CheckCircle2, Ban, Clock,
  CalendarClock, Bell, BellOff, CheckCheck,
} from "lucide-react";

// `notify_entrega_tardia` y `notify_programado_por_vencer` son opcionales:
// existen en la migración 20260903041514_orders_delivered_at_and_staff_notify_prefs.sql
// pero esa migración quedó bloqueada por el clasificador de Auto Mode (ver
// nota dentro del archivo) — hasta que alguien con permiso la aplique, la
// columna real no existe todavía y Supabase simplemente no la devuelve. El
// resto del código trata "undefined" igual que "true" (el default real de
// la migración), así que nada se rompe mientras tanto.
interface PreferenciasRow {
  id: string;
  restaurant_id: string;
  notify_nuevo: boolean;
  notify_preparando: boolean;
  notify_en_camino: boolean;
  notify_entregado: boolean;
  notify_cancelado: boolean;
  notify_entrega_tardia?: boolean;
  notify_programado_por_vencer?: boolean;
  notify_queja: boolean;
  notify_escalar: boolean;
}

// Un pedido tal cual sale de `orders` — se pide con select("*") a propósito
// (no una lista fija de columnas) para que estas pantallas no truenen si
// `delivered_at` todavía no existe en la base real (ver nota arriba).
interface OrderRow {
  id: string;
  order_number?: number;
  customer_name: string;
  total: number;
  status: string | null;
  source: string | null;
  branch: string | null;
  created_at: string;
  delivered_at?: string | null;
  estimated_delivery_at?: string | null;
  scheduled_for?: string | null;
  incident_note?: string | null;
}

interface CallbackRow {
  id: string;
  customer_name: string;
  customer_phone: string;
  reason: string | null;
  message: string | null;
  source: string;
  resolved: boolean;
  created_at: string;
}

// Umbrales de negocio — los dos únicos números "editables" de este archivo.
const VENTANA_PROGRAMADO_POR_VENCER_MIN = 30; // qué tan cerca de su hora (antes o después) cuenta como "a punto de vencer"
const UMBRAL_TARDANZA_MIN_DEFAULT = 60; // solo aplica cuando el pedido no tiene `estimated_delivery_at` real con qué compararse

const EVENTOS: { key: keyof Omit<PreferenciasRow, "id" | "restaurant_id">; label: string; descripcion: string; sinCorreoAun?: boolean }[] = [
  { key: "notify_nuevo", label: "Pedido nuevo", descripcion: "Cuando el agente de voz o WhatsApp toma un pedido — correo real, y controla la pestaña \"Recibidos\"." },
  { key: "notify_preparando", label: "En preparación", descripcion: "Cuando se confirma un pedido y pasa a cocina — correo real." },
  { key: "notify_en_camino", label: "En camino", descripcion: "Cuando un pedido sale a entrega — correo real." },
  { key: "notify_entregado", label: "Entregado", descripcion: "Cuando se marca un pedido como entregado — correo real, y controla la pestaña \"Entregados\"." },
  { key: "notify_cancelado", label: "Incidencias (cancelado o problema)", descripcion: "Cuando se cancela un pedido o se reporta una incidencia real (dirección incorrecta, cliente no contesta, queja, etc.) — correo real, y controla la pestaña \"Incidencias\"." },
  { key: "notify_entrega_tardia", label: "Entrega tardía", descripcion: "Cuando un pedido se entrega más tarde de lo prometido (o de lo común, si no hay hora prometida). Controla la pestaña \"Entrega tardía\".", sinCorreoAun: true },
  { key: "notify_programado_por_vencer", label: "Programado por vencer", descripcion: "Cuando un pedido programado está por llegar a su hora y sigue sin despacharse. Controla la pestaña \"Programados\".", sinCorreoAun: true },
  { key: "notify_queja", label: "Quejas registradas", descripcion: "Cuando el agente anota un contacto con motivo de queja o inconformidad — riesgo directo de perder al cliente si no se atiende rápido. Controla la pestaña \"Quejas\".", sinCorreoAun: true },
  { key: "notify_escalar", label: "Escalar a personal", descripcion: "Cuando un cliente pidió hablar con una persona durante la conversación con el agente. Controla la pestaña \"Escalar\".", sinCorreoAun: true },
];

// Palabras que delatan una queja real dentro de `reason` (texto libre que
// anota el propio agente al llamar a la tool `registrar_contacto`).
const PALABRAS_QUEJA = ["queja", "reclamo", "inconform", "molest", "insatisfe", "mal servicio"];

type TabId = "recibidos" | "entregados" | "reclamos" | "entrega_tardia" | "programados" | "quejas" | "escalar";

const TABS: { id: TabId; label: string; icon: typeof Package }[] = [
  { id: "recibidos", label: "Recibidos", icon: Package },
  { id: "entregados", label: "Entregados", icon: CheckCircle2 },
  { id: "reclamos", label: "Incidencias", icon: Ban },
  { id: "entrega_tardia", label: "Entrega tardía", icon: Clock },
  { id: "programados", label: "Programados", icon: CalendarClock },
  { id: "quejas", label: "Quejas", icon: AlertTriangle },
  { id: "escalar", label: "Escalar", icon: PhoneCall },
];

// Preferencia que apaga/prende cada tab con contador real — los dos tabs de
// triage (quejas anotadas, escalar) no tienen una columna de preferencia
// propia todavía, así que siempre se muestran.
const TOGGLE_POR_TAB: Partial<Record<TabId, keyof Omit<PreferenciasRow, "id" | "restaurant_id">>> = {
  recibidos: "notify_nuevo",
  entregados: "notify_entregado",
  reclamos: "notify_cancelado",
  entrega_tardia: "notify_entrega_tardia",
  programados: "notify_programado_por_vencer",
  quejas: "notify_queja",
  escalar: "notify_escalar",
};

// undefined se trata como "activo" — es el default real de la migración
// (ver PreferenciasRow arriba) y evita apagar todo de golpe mientras esa
// migración no se haya aplicado en la base real.
const activo = (v: boolean | undefined) => v !== false;

const formatoDuracion = (minutos: number) => {
  const m = Math.max(0, Math.round(minutos));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
};

// ¿Este pedido entregado tardó más de lo debido? Compara contra la hora
// prometida real (`estimated_delivery_at`, capturada al despachar) cuando
// existe; si no, cae al umbral fijo de creación→entrega.
const esEntregaTardia = (o: OrderRow): boolean => {
  if (!o.delivered_at) return false;
  const entregado = new Date(o.delivered_at).getTime();
  if (o.estimated_delivery_at) return entregado > new Date(o.estimated_delivery_at).getTime();
  return (entregado - new Date(o.created_at).getTime()) / 60000 > UMBRAL_TARDANZA_MIN_DEFAULT;
};

const IconoFuente = ({ source }: { source: string | null | undefined }) =>
  source === "voice" ? <Mic className="w-5 h-5 text-primary" strokeWidth={1.75} />
  : source === "whatsapp" ? <MessageCircle className="w-5 h-5 text-primary" strokeWidth={1.75} />
  : <ShoppingCart className="w-5 h-5 text-primary" strokeWidth={1.75} />;

const numeroPedido = (o: OrderRow) => (o.order_number ? `Venta ${String(o.order_number).padStart(4, "0")}` : `#${o.id.slice(0, 8)}`);

// Fila compartida por los 5 tabs de pedidos — solo cambia el `pill` de la
// derecha (estado propio de cada categoría).
function FilaPedido({ order, pill, onClick }: { order: OrderRow; pill?: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`p-3 flex items-center justify-between gap-3 border-b border-dashed border-border last:border-0 ${onClick ? "cursor-pointer hover:bg-muted/40 transition-colors" : ""}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <IconoFuente source={order.source} />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-foreground truncate">{order.customer_name}</p>
          <p className="text-[12px] text-muted-foreground truncate">
            {numeroPedido(order)}
            {order.branch ? ` · ${order.branch}` : ""} · {format(new Date(order.created_at), "d MMM, HH:mm", { locale: es })}
          </p>
          {/* Nota real de la incidencia (incident_note) — pedido real de
              Javier el 4-sep-2026, mismo patrón que ya usa el mensaje de
              Quejas/Escalar más abajo en este archivo. */}
          {order.status === "problema" && order.incident_note && (
            <p className="text-[12px] text-foreground mt-0.5 leading-snug">{order.incident_note}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <p className="font-display text-[13px] font-semibold tabular-nums text-foreground">${Number(order.total).toLocaleString()}</p>
        {pill}
      </div>
    </div>
  );
}

function Pill({ children, clase }: { children: React.ReactNode; clase: string }) {
  return <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-medium whitespace-nowrap ${clase}`}>{children}</span>;
}

function EstadoVacio({ icon: Icon, texto }: { icon: typeof Package; texto: string }) {
  return (
    <div className="py-10 text-center">
      <Icon className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" strokeWidth={1.5} />
      <p className="text-[13px] text-muted-foreground">{texto}</p>
    </div>
  );
}

function ListasPorLectura<T extends { id: string }>({
  pendientes,
  leidas,
  icon: Icon,
  textoVacio,
  renderItem,
}: {
  pendientes: T[];
  leidas: T[];
  icon: typeof Package;
  textoVacio: string;
  renderItem: (item: T, leida: boolean) => React.ReactNode;
}) {
  if (pendientes.length === 0 && leidas.length === 0) {
    return <EstadoVacio icon={Icon} texto={textoVacio} />;
  }

  return (
    <div className="space-y-4">
      {pendientes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-7 text-center">
          <CheckCheck className="w-8 h-8 mx-auto mb-2 text-emerald-500" strokeWidth={1.6} />
          <p className="text-[13px] font-medium text-foreground">Todo leído</p>
          <p className="text-[12px] text-muted-foreground">No hay notificaciones pendientes en esta categoría.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {pendientes.map((item) => renderItem(item, false))}
        </div>
      )}

      <section className="space-y-2" aria-label="Notificaciones leídas">
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <CheckCheck className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Notificaciones leídas</p>
          </div>
          <span className="text-[11px] text-muted-foreground">Últimas 200 por categoría</span>
        </div>
        {leidas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-5 text-center text-[12px] text-muted-foreground">
            Aún no has leído notificaciones de esta categoría.
          </p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden bg-muted/20 opacity-70">
            {leidas.map((item) => renderItem(item, true))}
          </div>
        )}
      </section>
    </div>
  );
}

// Categoría apagada por el propio usuario en Preferencias — se respeta
// "no quiere ver esto" ocultando la lista, con un atajo para reactivarla.
function EstadoSilenciado({ etiqueta, onActivar, activando }: { etiqueta: string; onActivar: () => void; activando: boolean }) {
  return (
    <div className="py-10 text-center">
      <BellOff className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" strokeWidth={1.5} />
      <p className="text-[13px] text-muted-foreground mb-3 max-w-xs mx-auto">
        Desactivaste "{etiqueta}" en tus preferencias — por eso no se muestra aquí.
      </p>
      <Button size="sm" variant="outline" className="h-8 rounded-full text-[12px]" onClick={onActivar} disabled={activando}>
        {activando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
        Volver a activar
      </Button>
    </div>
  );
}

const NotificacionesSection = ({ userId }: { userId: string | undefined }) => {
  const { toast } = useToast();
  const [fila, setFila] = useState<PreferenciasRow | null>(null);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("recibidos");
  // Pedido real de Javier el 4-sep-2026: "no es un pop up, cada pedido
  // tiene su página completa" — misma página compartida que Historial de
  // Órdenes y Pedidos, ver PedidoDetalleSection.tsx.
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const [cargandoListas, setCargandoListas] = useState(true);
  const [recibidos, setRecibidos] = useState<OrderRow[]>([]);
  const [entregados, setEntregados] = useState<OrderRow[]>([]);
  const [reclamos, setReclamos] = useState<OrderRow[]>([]);
  const [entregaTardiaPool, setEntregaTardiaPool] = useState<OrderRow[]>([]);
  const [programados, setProgramados] = useState<OrderRow[]>([]);
  const [quejas, setQuejas] = useState<CallbackRow[]>([]);
  const [escalar, setEscalar] = useState<CallbackRow[]>([]);
  const [leidas, setLeidas] = useState<Set<string>>(() => new Set());
  const [marcandoTodas, setMarcandoTodas] = useState(false);

  // Solo para refrescar las etiquetas "vencido hace / en" de Programados
  // cada tanto — no dispara ninguna consulta nueva.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!userId) return;
    const sb: any = supabase; // select("*") a propósito — ver nota junto a PreferenciasRow
    sb.from("restaurant_staff")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }: { data: PreferenciasRow | null }) => {
        setFila(data);
        setLoadingPrefs(false);
      })
      // Sin este .catch(), un fallo de red aquí (la promesa se rechaza en
      // vez de resolver a { data, error }) dejaba `loadingPrefs` en true
      // para siempre — el componente entero devuelve null mientras tanto
      // (ver `if (loadingPrefs) return null;` abajo), así que la sección
      // completa de Notificaciones se quedaba en blanco sin spinner ni
      // error visible. Mismo patrón de bug que Sucursales/Voces e idiomas.
      .catch((err: unknown) => {
        console.error("No se pudo leer preferencias de notificaciones:", err);
        setFila(null);
        setLoadingPrefs(false);
      });
  }, [userId]);

  const cargarListas = useCallback(async (restaurantId: string) => {
    setCargandoListas(true);
    // try/finally: sin esto, cualquier falla real de red en el Promise.all
    // (no un error devuelto por Supabase, sino la promesa rechazándose) dejaba
    // `cargandoListas` en true para siempre y las 7 pestañas de pedidos se
    // quedaban en el spinner sin importar cuántas veces recargara la página —
    // mismo patrón de bug que Sucursales/Voces e idiomas.
    try {
      const sb: any = supabase;
      const umbralProgramado = new Date(Date.now() + VENTANA_PROGRAMADO_POR_VENCER_MIN * 60_000).toISOString();
      const [recibidosRes, entregadosRes, reclamosRes, entregaTardiaRes, programadosRes, quejasRes, escalarRes, leidasRes] = await Promise.all([
        sb.from("orders").select("*").eq("restaurant_id", restaurantId).eq("status", "pending")
          .order("created_at", { ascending: false }).limit(200),
        sb.from("orders").select("*").eq("restaurant_id", restaurantId).eq("status", "entregado")
          .order("created_at", { ascending: false }).limit(200),
        // "Incidencias": cancelados + el estado genérico "problema" (pedido
        // real de Javier el 4-sep-2026) — cualquier incidencia real
        // reportada en cualquier punto del ciclo, con su nota en incident_note.
        sb.from("orders").select("*").eq("restaurant_id", restaurantId).in("status", ["cancelado", "problema"])
          .order("created_at", { ascending: false }).limit(200),
        // Candidatos a "entrega tardía": todo lo entregado con marca real de
        // hora de entrega — el filtro fino (¿de verdad tardó?) es client-side
        // en `esEntregaTardia`, porque cruza dos columnas distintas.
        sb.from("orders").select("*").eq("restaurant_id", restaurantId).eq("status", "entregado")
          .not("delivered_at", "is", null).order("delivered_at", { ascending: false }).limit(200),
        sb.from("orders").select("*").eq("restaurant_id", restaurantId).eq("status", "pending")
          .not("scheduled_for", "is", null).lte("scheduled_for", umbralProgramado)
          .order("scheduled_for", { ascending: true }).limit(200),
        supabase.from("callback_requests").select("*").eq("restaurant_id", restaurantId)
          .or(PALABRAS_QUEJA.map((p) => `reason.ilike.%${p}%`).join(","))
          .order("created_at", { ascending: false }).limit(200),
        supabase.from("callback_requests").select("*").eq("restaurant_id", restaurantId)
          .eq("resolved", false).order("created_at", { ascending: false }).limit(200),
        sb.from("notification_reads").select("notification_key").eq("restaurant_id", restaurantId)
          .eq("user_id", userId).order("read_at", { ascending: false }).limit(5000),
      ]);

      const primerError = [recibidosRes, entregadosRes, reclamosRes, entregaTardiaRes, programadosRes, quejasRes, escalarRes, leidasRes]
        .find((resultado) => resultado.error)?.error;
      if (primerError) throw primerError;

      setRecibidos((recibidosRes.data as OrderRow[] | null) ?? []);
      setEntregados((entregadosRes.data as OrderRow[] | null) ?? []);
      setReclamos((reclamosRes.data as OrderRow[] | null) ?? []);
      setEntregaTardiaPool((entregaTardiaRes.data as OrderRow[] | null) ?? []);
      setProgramados((programadosRes.data as OrderRow[] | null) ?? []);
      setQuejas((quejasRes.data as CallbackRow[] | null) ?? []);
      setEscalar((escalarRes.data as CallbackRow[] | null) ?? []);
      setLeidas(new Set(((leidasRes.data as { notification_key: string }[] | null) ?? []).map((r) => r.notification_key)));
    } catch (err) {
      console.error("No se pudieron cargar las listas de notificaciones:", err);
    } finally {
      setCargandoListas(false);
    }
  }, [userId]);

  useEffect(() => {
    if (fila?.restaurant_id) cargarListas(fila.restaurant_id);
  }, [fila?.restaurant_id, cargarListas]);

  const entregaTardia = entregaTardiaPool.filter(esEntregaTardia);

  const claveNotificacion = (categoria: TabId, id: string) => `${categoria}:${id}`;
  const separarPorLectura = <T extends { id: string }>(items: T[], categoria: TabId) => ({
    pendientes: items.filter((item) => !leidas.has(claveNotificacion(categoria, item.id))),
    leidas: items.filter((item) => leidas.has(claveNotificacion(categoria, item.id))),
  });

  const recibidosPorLectura = separarPorLectura(recibidos, "recibidos");
  const entregadosPorLectura = separarPorLectura(entregados, "entregados");
  const reclamosPorLectura = separarPorLectura(reclamos, "reclamos");
  const tardiasPorLectura = separarPorLectura(entregaTardia, "entrega_tardia");
  const programadosPorLectura = separarPorLectura(programados, "programados");
  const quejasPorLectura = separarPorLectura(quejas, "quejas");
  const escalarPorLectura = separarPorLectura(escalar, "escalar");

  const persistirLeidas = async (notificaciones: { categoria: TabId; id: string }[]) => {
    if (!fila || !userId) return false;
    const nuevas = notificaciones
      .map(({ categoria, id }) => claveNotificacion(categoria, id))
      .filter((clave, indice, todas) => !leidas.has(clave) && todas.indexOf(clave) === indice);
    if (nuevas.length === 0) return true;

    setLeidas((actuales) => new Set([...actuales, ...nuevas]));
    try {
      const sb: any = supabase;
      const { error } = await sb.from("notification_reads").upsert(
        nuevas.map((notification_key) => ({
          user_id: userId,
          restaurant_id: fila.restaurant_id,
          notification_key,
          read_at: new Date().toISOString(),
        })),
        { onConflict: "user_id,restaurant_id,notification_key" },
      );
      if (error) throw error;
      window.dispatchEvent(new CustomEvent("atiende:notifications-read"));
      return true;
    } catch (err) {
      setLeidas((actuales) => {
        const restauradas = new Set(actuales);
        nuevas.forEach((clave) => restauradas.delete(clave));
        return restauradas;
      });
      toast({
        title: "No se pudo marcar como leída",
        description: err instanceof Error ? err.message : "Intenta nuevamente.",
        variant: "destructive",
      });
      return false;
    }
  };

  const abrirPedido = (categoria: TabId, id: string) => {
    setDetalleId(id);
    void persistirLeidas([{ categoria, id }]);
  };

  const marcarTodasComoLeidas = async () => {
    setMarcandoTodas(true);
    try {
      await persistirLeidas([
        ...recibidosPorLectura.pendientes.map(({ id }) => ({ categoria: "recibidos" as const, id })),
        ...entregadosPorLectura.pendientes.map(({ id }) => ({ categoria: "entregados" as const, id })),
        ...reclamosPorLectura.pendientes.map(({ id }) => ({ categoria: "reclamos" as const, id })),
        ...tardiasPorLectura.pendientes.map(({ id }) => ({ categoria: "entrega_tardia" as const, id })),
        ...programadosPorLectura.pendientes.map(({ id }) => ({ categoria: "programados" as const, id })),
        ...quejasPorLectura.pendientes.map(({ id }) => ({ categoria: "quejas" as const, id })),
        ...escalarPorLectura.pendientes.map(({ id }) => ({ categoria: "escalar" as const, id })),
      ]);
    } finally {
      setMarcandoTodas(false);
    }
  };

  const toggle = async (key: keyof Omit<PreferenciasRow, "id" | "restaurant_id">, value: boolean) => {
    if (!fila) return;
    const anterior = fila;
    setFila({ ...fila, [key]: value });
    setGuardando(key);
    // try/finally: si el update truena de verdad (red) en vez de resolver a
    // { error }, sin esto `guardando` se quedaba fijo en este switch para
    // siempre — el toggle correspondiente quedaba deshabilitado/girando por
    // el resto de la sesión.
    try {
      const { data: updated, error } = await supabase.rpc("update_my_notification_preference", {
        p_membership_id: fila.id,
        p_preference: key,
        p_value: value,
      });
      if (error || !updated) {
        setFila(anterior);
        toast({
          title: "No se pudo guardar",
          description: key === "notify_entrega_tardia" || key === "notify_programado_por_vencer"
            ? "Esta preferencia es nueva y su columna todavía no existe en la base real — aplica la migración pendiente y vuelve a intentar."
            : error.message,
          variant: "destructive",
        });
      }
    } catch (err) {
      setFila(anterior);
      toast({ title: "No se pudo guardar", description: err instanceof Error ? err.message : "Intenta de nuevo.", variant: "destructive" });
    } finally {
      setGuardando(null);
    }
  };

  const marcarAtendido = async (id: string) => {
    void persistirLeidas([{ categoria: "quejas", id }, { categoria: "escalar", id }]);
    const { error } = await supabase.from("callback_requests").update({ resolved: true }).eq("id", id);
    if (error) {
      toast({ title: "No se pudo actualizar", description: error.message, variant: "destructive" });
      return;
    }
    if (fila?.restaurant_id) cargarListas(fila.restaurant_id);
  };

  // Barra de tabs con scroll horizontal — con 7 categorías ya no cabe un
  // grid de columnas iguales, así que el indicador deslizante se mide de
  // verdad contra el ancho real de cada botón (ref por tab) en vez de
  // asumir 1/N del ancho del contenedor.
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
  const [indicador, setIndicador] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const el = tabRefs.current[tab];
    if (el) setIndicador({ left: el.offsetLeft, width: el.offsetWidth });
  }, [tab, loadingPrefs]);

  if (loadingPrefs) return null;

  if (!fila) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-[13px] text-muted-foreground text-center py-8">
          No encontramos tu cuenta dentro del staff de este restaurante, así que no hay notificaciones que mostrar.
        </p>
      </div>
    );
  }

  if (detalleId) {
    return <PedidoDetalleSection orderId={detalleId} onVolver={() => setDetalleId(null)} onSelect={setDetalleId} />;
  }

  const conteos: Record<TabId, number> = {
    recibidos: activo(fila.notify_nuevo) ? recibidosPorLectura.pendientes.length : 0,
    entregados: activo(fila.notify_entregado) ? entregadosPorLectura.pendientes.length : 0,
    reclamos: activo(fila.notify_cancelado) ? reclamosPorLectura.pendientes.length : 0,
    entrega_tardia: activo(fila.notify_entrega_tardia) ? tardiasPorLectura.pendientes.length : 0,
    programados: activo(fila.notify_programado_por_vencer) ? programadosPorLectura.pendientes.length : 0,
    quejas: activo(fila.notify_queja) ? quejasPorLectura.pendientes.length : 0,
    escalar: activo(fila.notify_escalar) ? escalarPorLectura.pendientes.length : 0,
  };
  const totalPendientes = Object.values(conteos).reduce((total, cantidad) => total + cantidad, 0);

  // Si el tab activo tiene preferencia y está apagada, se muestra el
  // silenciado en vez de la lista (para cualquier tab de triage sin
  // preferencia propia, `toggleKey` es undefined y esto nunca aplica).
  const toggleKeyDeTab = TOGGLE_POR_TAB[tab];
  const tabSilenciado = toggleKeyDeTab ? !activo(fila[toggleKeyDeTab]) : false;
  const etiquetaTabActivo = TABS.find((t) => t.id === tab)?.label ?? "";

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {/* Barra de tabs — indicador deslizante con glow azul/cielo, mismo
            mecanismo del centro de notificaciones de Rappi (subrayado que se
            mueve con spring + resplandor bajo el tab activo), ahora en una
            tira con scroll horizontal para caber las 7 categorías reales. */}
        <div className="relative border-b border-border overflow-x-auto">
          <div className="relative flex" style={{ minWidth: "max-content" }}>
            {TABS.map((t) => {
              const Icono = t.icon;
              const activoTab = t.id === tab;
              const n = conteos[t.id];
              return (
                <button
                  key={t.id}
                  ref={(el) => { tabRefs.current[t.id] = el; }}
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 text-[12px] font-medium whitespace-nowrap transition-colors ${
                    activoTab ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                  style={activoTab ? { filter: "drop-shadow(0 0 5px hsl(var(--primary) / 0.5))" } : undefined}
                >
                  <Icono className="w-4 h-4" strokeWidth={1.75} />
                  {t.label}
                  {n > 0 && (
                    <span className="min-w-[15px] h-[15px] px-1 rounded-full bg-primary text-primary-foreground font-mono text-[9px] font-semibold flex items-center justify-center leading-none">
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
            <motion.div
              className="absolute bottom-0 h-[3px] rounded-full bg-primary"
              style={{ boxShadow: "0 0 10px 2px hsl(var(--primary) / 0.65), 0 0 22px 4px hsl(var(--primary) / 0.35)" }}
              animate={{ left: indicador.left, width: indicador.width }}
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            />
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-muted-foreground">
              {totalPendientes === 0 ? "No tienes notificaciones pendientes." : `${totalPendientes} ${totalPendientes === 1 ? "notificación pendiente" : "notificaciones pendientes"}`}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-full text-[12px] shrink-0"
              disabled={marcandoTodas || totalPendientes === 0 || cargandoListas}
              onClick={marcarTodasComoLeidas}
            >
              {marcandoTodas ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
              Marcar todas como leídas
            </Button>
          </div>

          {tab === "recibidos" && (
            tabSilenciado ? (
              <EstadoSilenciado etiqueta={etiquetaTabActivo} activando={guardando === "notify_nuevo"} onActivar={() => toggle("notify_nuevo", true)} />
            ) : (
              <>
                <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{recibidosPorLectura.pendientes.length} sin leer · {recibidos.length} en total</p>
                <p className="text-[12px] text-muted-foreground -mt-1">
                  Pedidos nuevos recién colocados por el agente de voz, WhatsApp o el sitio — status inicial real ("pending"), antes de pasar a cocina.
                </p>
                {cargandoListas ? (
                  <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <ListasPorLectura
                    pendientes={recibidosPorLectura.pendientes}
                    leidas={recibidosPorLectura.leidas}
                    icon={Package}
                    textoVacio="No hay pedidos nuevos en este momento."
                    renderItem={(o) => <FilaPedido key={o.id} order={o} onClick={() => abrirPedido("recibidos", o.id)} pill={<Pill clase="bg-yellow-100 text-yellow-700">Pendiente</Pill>} />}
                  />
                )}
              </>
            )
          )}

          {tab === "entregados" && (
            tabSilenciado ? (
              <EstadoSilenciado etiqueta={etiquetaTabActivo} activando={guardando === "notify_entregado"} onActivar={() => toggle("notify_entregado", true)} />
            ) : (
              <>
                <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{entregadosPorLectura.pendientes.length} sin leer · {entregados.length} en total</p>
                <p className="text-[12px] text-muted-foreground -mt-1">Pedidos que ya se marcaron como entregados — status real "entregado".</p>
                {cargandoListas ? (
                  <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <ListasPorLectura
                    pendientes={entregadosPorLectura.pendientes}
                    leidas={entregadosPorLectura.leidas}
                    icon={CheckCircle2}
                    textoVacio="Todavía no hay pedidos entregados."
                    renderItem={(o) => (
                      <FilaPedido
                        key={o.id}
                        order={o}
                        onClick={() => abrirPedido("entregados", o.id)}
                        pill={
                          <Pill clase="bg-green-100 text-green-700">
                            {o.delivered_at ? `Entregado ${format(new Date(o.delivered_at), "HH:mm", { locale: es })}` : "Entregado"}
                          </Pill>
                        }
                      />
                    )}
                  />
                )}
              </>
            )
          )}

          {tab === "reclamos" && (
            tabSilenciado ? (
              <EstadoSilenciado etiqueta={etiquetaTabActivo} activando={guardando === "notify_cancelado"} onActivar={() => toggle("notify_cancelado", true)} />
            ) : (
              <>
                <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{reclamosPorLectura.pendientes.length} sin leer · {reclamos.length} en total</p>
                <p className="text-[12px] text-muted-foreground -mt-1">
                  Pedidos cancelados o con una incidencia real reportada (dirección incorrecta, cliente no contesta, queja del cliente, etc. — con la nota
                  real que se escribió al reportarla).
                </p>
                {cargandoListas ? (
                  <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <ListasPorLectura
                    pendientes={reclamosPorLectura.pendientes}
                    leidas={reclamosPorLectura.leidas}
                    icon={Ban}
                    textoVacio="No hay incidencias ni pedidos cancelados."
                    renderItem={(o) => (
                      <FilaPedido
                        key={o.id}
                        order={o}
                        onClick={() => abrirPedido("reclamos", o.id)}
                        pill={
                          o.status === "problema"
                            ? <Pill clase="bg-fuchsia-100 text-fuchsia-700">Incidencia</Pill>
                            : <Pill clase="bg-red-100 text-red-700">Cancelado</Pill>
                        }
                      />
                    )}
                  />
                )}
              </>
            )
          )}

          {tab === "entrega_tardia" && (
            tabSilenciado ? (
              <EstadoSilenciado etiqueta={etiquetaTabActivo} activando={guardando === "notify_entrega_tardia"} onActivar={() => toggle("notify_entrega_tardia", true)} />
            ) : (
              <>
                <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{tardiasPorLectura.pendientes.length} sin leer · {entregaTardia.length} en total</p>
                <p className="text-[12px] text-muted-foreground -mt-1">
                  Pedidos entregados más tarde de lo prometido (contra su "estimated_delivery_at" real, capturada al despachar) o, si no hubo hora
                  prometida, más de {UMBRAL_TARDANZA_MIN_DEFAULT} min entre creación y entrega.
                </p>
                {cargandoListas ? (
                  <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <ListasPorLectura
                    pendientes={tardiasPorLectura.pendientes}
                    leidas={tardiasPorLectura.leidas}
                    icon={Clock}
                    textoVacio="Ningún pedido entregado se pasó de tiempo."
                    renderItem={(o) => {
                      const referencia = o.estimated_delivery_at ? new Date(o.estimated_delivery_at) : new Date(o.created_at);
                      const minutosTarde = (new Date(o.delivered_at as string).getTime() - referencia.getTime()) / 60000;
                      return (
                        <FilaPedido
                          key={o.id}
                          order={o}
                          onClick={() => abrirPedido("entrega_tardia", o.id)}
                          pill={<Pill clase="bg-orange-100 text-orange-700">+{formatoDuracion(minutosTarde)} tarde</Pill>}
                        />
                      );
                    }}
                  />
                )}
              </>
            )
          )}

          {tab === "programados" && (
            tabSilenciado ? (
              <EstadoSilenciado etiqueta={etiquetaTabActivo} activando={guardando === "notify_programado_por_vencer"} onActivar={() => toggle("notify_programado_por_vencer", true)} />
            ) : (
              <>
                <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{programadosPorLectura.pendientes.length} sin leer · {programados.length} en total</p>
                <p className="text-[12px] text-muted-foreground -mt-1">
                  Pedidos programados (columna real "scheduled_for") cuya hora está a {VENTANA_PROGRAMADO_POR_VENCER_MIN} min o menos, o ya pasó, y
                  siguen sin despacharse — para no dejar que un programado se escape sin repartidor asignado a tiempo.
                </p>
                {cargandoListas ? (
                  <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <ListasPorLectura
                    pendientes={programadosPorLectura.pendientes}
                    leidas={programadosPorLectura.leidas}
                    icon={CalendarClock}
                    textoVacio="No hay programados a punto de vencer su ventana."
                    renderItem={(o) => {
                      const objetivo = new Date(o.scheduled_for as string).getTime();
                      const vencido = objetivo <= ahora;
                      return (
                        <FilaPedido
                          key={o.id}
                          order={o}
                          onClick={() => abrirPedido("programados", o.id)}
                          pill={
                            <Pill clase={vencido ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}>
                              {vencido ? "Vencido hace " : "En "}{formatDistanceToNow(new Date(o.scheduled_for as string), { locale: es })}
                            </Pill>
                          }
                        />
                      );
                    }}
                  />
                )}
              </>
            )
          )}

          {tab === "quejas" && (
            tabSilenciado ? (
              <EstadoSilenciado etiqueta={etiquetaTabActivo} activando={guardando === "notify_queja"} onActivar={() => toggle("notify_queja", true)} />
            ) : (
            <>
              <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {quejasPorLectura.pendientes.length} sin leer · {quejas.filter((c) => !c.resolved).length} sin atender · {quejas.length} en total
              </p>
              <p className="text-[12px] text-muted-foreground -mt-1">
                Contactos que el agente anotó con un motivo de queja — construido sobre los mismos registros de "Escalar" filtrados por motivo.
              </p>
              {cargandoListas ? (
                <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <ListasPorLectura
                  pendientes={quejasPorLectura.pendientes}
                  leidas={quejasPorLectura.leidas}
                  icon={AlertTriangle}
                  textoVacio="No hay quejas registradas."
                  renderItem={(c, leida) => (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => void persistirLeidas([{ categoria: "quejas", id: c.id }])}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") void persistirLeidas([{ categoria: "quejas", id: c.id }]);
                      }}
                      className={`p-3 flex items-start justify-between gap-3 border-b border-dashed border-border last:border-0 cursor-pointer hover:bg-muted/40 transition-colors ${c.resolved || leida ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                          <AlertTriangle className="w-5 h-5 text-destructive" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-foreground truncate">{c.customer_name} <span className="text-muted-foreground font-normal">· {c.customer_phone}</span></p>
                          <p className="text-[12px] text-muted-foreground">
                            {c.reason && <span className="px-1.5 py-0.5 rounded bg-muted text-foreground mr-1.5">{c.reason}</span>}
                            {format(new Date(c.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                          </p>
                          {c.message && <p className="text-[12.5px] text-foreground mt-1 leading-snug">{c.message}</p>}
                        </div>
                      </div>
                      {!c.resolved && (
                        <Button size="sm" className="h-7 px-2.5 rounded-full text-[11px] shrink-0" onClick={(e) => { e.stopPropagation(); void marcarAtendido(c.id); }}>
                          Marcar atendido
                        </Button>
                      )}
                    </div>
                  )}
                />
              )}
            </>
            )
          )}

          {tab === "escalar" && (
            tabSilenciado ? (
              <EstadoSilenciado etiqueta={etiquetaTabActivo} activando={guardando === "notify_escalar"} onActivar={() => toggle("notify_escalar", true)} />
            ) : (
            <>
              <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{escalarPorLectura.pendientes.length} sin leer · {escalar.length} sin atender</p>
              <p className="text-[12px] text-muted-foreground -mt-1">
                Contactos sin resolver que el agente de voz o WhatsApp registró con "registrar_contacto" — necesitan que alguien del restaurante regrese la comunicación.
              </p>
              {cargandoListas ? (
                <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <ListasPorLectura
                  pendientes={escalarPorLectura.pendientes}
                  leidas={escalarPorLectura.leidas}
                  icon={PhoneCall}
                  textoVacio="No hay contactos pendientes de escalar a personal."
                  renderItem={(c, leida) => (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => void persistirLeidas([{ categoria: "escalar", id: c.id }])}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") void persistirLeidas([{ categoria: "escalar", id: c.id }]);
                      }}
                      className={`p-3 flex items-start justify-between gap-3 border-b border-dashed border-border last:border-0 cursor-pointer hover:bg-muted/40 transition-colors ${leida ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <IconoFuente source={c.source} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-foreground truncate">{c.customer_name} <span className="text-muted-foreground font-normal">· {c.customer_phone}</span></p>
                          <p className="text-[12px] text-muted-foreground">
                            {c.reason && <span className="px-1.5 py-0.5 rounded bg-muted text-foreground mr-1.5">{c.reason}</span>}
                            {format(new Date(c.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                          </p>
                          {c.message && <p className="text-[12.5px] text-foreground mt-1 leading-snug">{c.message}</p>}
                        </div>
                      </div>
                      <Button size="sm" className="h-7 px-2.5 rounded-full text-[11px] shrink-0" onClick={(e) => { e.stopPropagation(); void marcarAtendido(c.id); }}>
                        Marcar atendido
                      </Button>
                    </div>
                  )}
                />
              )}
            </>
            )
          )}
        </div>
      </div>

      {/* Preferencias — al final de la página, debajo de las listas, NO
          escondidas en otro tab: un toggle real por tipo de notificación,
          leído y escrito de verdad contra el row de `restaurant_staff` del
          usuario actual (mismas columnas boolean que ya usaba el correo). */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Preferencias de notificaciones</p>
        </div>
        <p className="text-[12px] text-muted-foreground -mt-1">
          Elige qué eventos de pedido quieres ver en las pestañas de arriba y recibir por correo — solo para tu cuenta.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {EVENTOS.map((ev) => (
            <div key={ev.key} className="rounded-xl border border-border p-3 flex items-start justify-between gap-3">
              <div className="pr-2 min-w-0">
                <p className="text-[13px] font-medium text-foreground">{ev.label}</p>
                <p className="text-[12px] text-muted-foreground">{ev.descripcion}</p>
                {ev.sinCorreoAun && (
                  <p className="text-[11px] text-muted-foreground/70 italic mt-0.5">Por ahora solo controla lo que ves aquí — el correo automático de este evento todavía no está conectado.</p>
                )}
              </div>
              <Switch
                checked={activo(fila[ev.key])}
                disabled={guardando === ev.key}
                onCheckedChange={(v) => toggle(ev.key, v)}
                className="shrink-0 mt-0.5"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotificacionesSection;
