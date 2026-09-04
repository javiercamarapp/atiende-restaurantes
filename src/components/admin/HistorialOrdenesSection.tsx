// Historial de Órdenes — lista real y paginada de la tabla `orders`, con
// filtros server-side (rango de fecha, sucursal, "no entregados / problemas")
// y exportación real a Excel/PDF de los pedidos ya filtrados en pantalla.
//
// Vocabulario REAL de `orders.status` (confirmado contra el código existente
// — RepartidorDashboard.tsx, NotificacionesSection.tsx y el comentario de la
// migración 20260902000000_branches_and_order_source.sql):
//   pending -> preparando -> en_camino -> entregado   (también: cancelado)
// No existen en el backend los conceptos "programado", "reclamado" ni
// "reembolsado" — no hay columna, ni valor, ni tabla que los represente hoy.
// El filtro de "reclamos/quejas/no entregados" usa el estado real más
// cercano: todo lo que no es `entregado` (incluye `cancelado`, que es la
// única señal real de un pedido que salió mal).
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ShoppingCart, Search, Globe, Store, ChevronDown, Download, FileSpreadsheet,
  FileText, Loader2, AlertTriangle, CalendarDays, X,
  User, Phone, MapPin, CreditCard, Banknote, Wallet, StickyNote, Mic, MessageCircle,
} from "lucide-react";

interface OrderRow {
  id: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  status: string | null;
  created_at: string | null;
  source: string;
  branch: string | null;
  branch_id: string | null;
  estimated_delivery_at: string | null;
  incident_note: string | null;
}
interface BranchOption {
  id: string;
  name: string;
}

// Pedido real de Javier el 4-sep-2026: quería que al hacer clic en un
// pedido de Historial saliera todo detallado — productos, cantidad, monto,
// cliente, dirección, teléfono, forma de pago, todo. `OrderRow` (arriba)
// solo trae las columnas angostas que necesita la tabla; este detalle trae
// la fila completa, pedida bajo demanda solo al abrir un pedido (no de
// entrada, para no cargar `items`/notas de los 50 pedidos de la página a
// la vez).
interface OrderDetalle extends OrderRow {
  customer_address: string | null;
  items: { id?: string; name: string; quantity: number; price: number }[] | null;
  notes: string | null;
  payment_method: string | null;
  delivered_at: string | null;
}

const PAGE_SIZE = 50;
const MAX_CARGADOS = 200;

const PRESETS_HISTORIAL = [
  { id: "7d", etiqueta: "Últimos 7 días", dias: 7 },
  { id: "30d", etiqueta: "Últimos 30 días", dias: 30 },
  { id: "90d", etiqueta: "Últimos 90 días", dias: 90 },
  { id: "todo", etiqueta: "Todo el historial", dias: null },
] as const;
type PresetHistorialId = (typeof PRESETS_HISTORIAL)[number]["id"];

const rangoDesdePreset = (id: PresetHistorialId): DateRange | undefined => {
  const preset = PRESETS_HISTORIAL.find((p) => p.id === id);
  if (!preset || preset.dias === null) return undefined;
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(desde.getDate() - preset.dias);
  return { from: desde, to: hasta };
};

const ESTADO_BADGE: Record<string, { etiqueta: string; clase: string }> = {
  pending: { etiqueta: "Pendiente", clase: "bg-yellow-100 text-yellow-700" },
  preparando: { etiqueta: "Preparando", clase: "bg-orange-100 text-orange-700" },
  en_camino: { etiqueta: "En tránsito", clase: "bg-blue-100 text-blue-700" },
  entregado: { etiqueta: "Entregado", clase: "bg-green-100 text-green-700" },
  completado: { etiqueta: "Entregado", clase: "bg-green-100 text-green-700" },
  cancelado: { etiqueta: "Cancelado", clase: "bg-red-100 text-red-700" },
  programado: { etiqueta: "Programado", clase: "bg-purple-100 text-purple-700" },
  // Estado genérico "Incidencias" (`problema` en la base, pedido real de
  // Javier el 4-sep-2026): cubre cualquier problema real reportado en
  // cualquier punto del ciclo — dirección incorrecta, cliente no contesta,
  // o una queja real después de que el pedido ya se entregó — con la nota
  // libre en `incident_note`.
  problema: { etiqueta: "Incidencia", clase: "bg-fuchsia-100 text-fuchsia-700" },
  reclamado: { etiqueta: "Reclamado", clase: "bg-amber-100 text-amber-800" },
  regresado: { etiqueta: "Regresado", clase: "bg-red-100 text-red-700" },
};
const badgeDeEstado = (status: string | null) =>
  ESTADO_BADGE[status ?? ""] ?? { etiqueta: status || "Sin estado", clase: "bg-muted text-muted-foreground" };

// "Demorado" no es un status guardado — es una condición calculada: el
// pedido sigue en_camino pero ya se pasó de su tiempo estimado real
// (estimated_delivery_at, capturada al despachar desde Pedidos). Pedido
// real de Javier el 4-sep-2026 ("también agrega el demorado").
const esDemorado = (o: OrderRow) =>
  o.status === "en_camino" && !!o.estimated_delivery_at && new Date(o.estimated_delivery_at).getTime() < Date.now();

const numeroPedido = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;
const formatoMXN = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });

interface Props {
  restaurantId: string | null;
}

export default function HistorialOrdenesSection({ restaurantId }: Props) {
  const [ordenes, setOrdenes] = useState<OrderRow[]>([]);
  const [totalFiltrado, setTotalFiltrado] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detalle real de un pedido, cargado bajo demanda al hacer clic en una
  // fila — ver interfaz OrderDetalle arriba.
  const [detalleAbierto, setDetalleAbierto] = useState<OrderDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const abrirDetalle = async (id: string) => {
    setCargandoDetalle(true);
    const { data, error: errDetalle } = await supabase
      .from("orders")
      .select("id, customer_name, customer_phone, customer_address, total, status, created_at, source, branch, branch_id, estimated_delivery_at, incident_note, items, notes, payment_method, delivered_at")
      .eq("id", id)
      .maybeSingle();
    setCargandoDetalle(false);
    if (errDetalle || !data) return;
    setDetalleAbierto(data as unknown as OrderDetalle);
  };

  const [sucursales, setSucursales] = useState<BranchOption[]>([]);
  const [sucursalId, setSucursalId] = useState<string>("todas");
  const [mostrarSucursales, setMostrarSucursales] = useState(false);
  const [soloProblemas, setSoloProblemas] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");

  const [presetRango, setPresetRango] = useState<PresetHistorialId>("30d");
  const [rangoAplicado, setRangoAplicado] = useState<DateRange | undefined>(undefined);
  const [rangoBorrador, setRangoBorrador] = useState<DateRange | undefined>(undefined);
  const [mostrarCalendario, setMostrarCalendario] = useState(false);

  // Bug real corregido el 4-sep-2026 (Historial de Órdenes se quedaba en
  // "Cargando..." para siempre): rangoDesdePreset(presetRango) creaba
  // objetos Date NUEVOS en cada render (nunca memoizado). Como rangoActivo
  // entraba tal cual a las dependencias de construirQuery (useCallback), su
  // identidad "cambiaba" en cada render aunque el preset fuera el mismo —
  // eso recreaba construirQuery, luego cargarPrimeraPagina, y el useEffect
  // que la llama disparaba una fetch nueva en CADA render, para siempre: un
  // loop real de fetch→setState→render→fetch que nunca dejaba a `cargando`
  // asentarse en false. Memoizar por presetRango corta el loop.
  const rangoDesdePresetMemo = useMemo(() => rangoDesdePreset(presetRango), [presetRango]);
  const rangoActivo = rangoAplicado ?? rangoDesdePresetMemo;
  const etiquetaRango = rangoAplicado
    ? `${format(rangoAplicado.from as Date, "d MMM", { locale: es })} – ${format((rangoAplicado.to ?? rangoAplicado.from) as Date, "d MMM yyyy", { locale: es })}`
    : (PRESETS_HISTORIAL.find((p) => p.id === presetRango)?.etiqueta ?? "Todo el historial");

  useEffect(() => {
    if (!restaurantId) return;
    supabase
      .from("branches")
      .select("id, name")
      .eq("restaurant_id", restaurantId)
      .order("display_order")
      .then(({ data }) => setSucursales((data ?? []) as BranchOption[]));
  }, [restaurantId]);

  const construirQuery = useCallback(
    (desde: number, hasta: number) => {
      const sb: any = supabase;
      let q = sb
        .from("orders")
        .select("id, customer_name, customer_phone, total, status, created_at, source, branch, branch_id, estimated_delivery_at, incident_note", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(desde, hasta)
        // Pedidos de prueba reales del widget de WhatsApp de la página
        // pública (customer_phone = "widget-<uuid>") — nunca son historial
        // real, no deben contar en el conteo ni aparecer en la lista.
        .not("customer_phone", "ilike", "widget-%");
      if (restaurantId) q = q.eq("restaurant_id", restaurantId);
      if (sucursalId !== "todas") q = q.eq("branch_id", sucursalId);
      if (soloProblemas) q = q.neq("status", "entregado").neq("status", "completado");
      if (rangoActivo?.from) q = q.gte("created_at", new Date(rangoActivo.from.setHours(0, 0, 0, 0)).toISOString());
      if (rangoActivo?.to) {
        const fin = new Date(rangoActivo.to);
        fin.setHours(23, 59, 59, 999);
        q = q.lte("created_at", fin.toISOString());
      }
      if (busquedaAplicada.trim()) {
        const t = busquedaAplicada.trim().replace(/[%,]/g, "");
        q = q.or(`customer_name.ilike.%${t}%,customer_phone.ilike.%${t}%`);
      }
      return q;
    },
    [restaurantId, sucursalId, soloProblemas, rangoActivo, busquedaAplicada],
  );

  const cargarPrimeraPagina = useCallback(async () => {
    if (!restaurantId) return;
    setCargando(true);
    setError(null);
    // try/finally: si la query truena de verdad (falla de red, no un error
    // devuelto por Supabase) en vez de resolver a { data, error }, sin esto
    // `cargando` se quedaba en true para siempre y la sección no salía
    // nunca del spinner — mismo patrón de bug que Sucursales/Voces e idiomas.
    try {
      const { data, error: err, count } = await construirQuery(0, PAGE_SIZE - 1);
      if (err) {
        setError(err.message);
        setOrdenes([]);
        setTotalFiltrado(0);
      } else {
        setOrdenes((data ?? []) as OrderRow[]);
        setTotalFiltrado(count ?? 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el historial.");
      setOrdenes([]);
      setTotalFiltrado(0);
    } finally {
      setCargando(false);
    }
  }, [construirQuery, restaurantId]);

  useEffect(() => {
    cargarPrimeraPagina();
  }, [cargarPrimeraPagina]);

  const cargarMas = async () => {
    setCargandoMas(true);
    try {
      const desde = ordenes.length;
      const hasta = Math.min(desde + PAGE_SIZE, MAX_CARGADOS) - 1;
      const { data, error: err } = await construirQuery(desde, hasta);
      if (!err) setOrdenes((prev) => [...prev, ...((data ?? []) as OrderRow[])]);
    } catch (err) {
      console.error("No se pudo cargar más historial:", err);
    } finally {
      setCargandoMas(false);
    }
  };

  const nombreSucursal = (o: OrderRow) => sucursales.find((s) => s.id === o.branch_id)?.name ?? o.branch ?? "—";

  const hayMas = ordenes.length < Math.min(totalFiltrado, MAX_CARGADOS);

  // Exportación: siempre a partir de los pedidos ya cargados/filtrados en
  // pantalla (mismo dataset que ve el usuario — nada de datos inventados).
  const filaExport = (o: OrderRow) => ({
    "N° de pedido": numeroPedido(o.id),
    Cliente: o.customer_name,
    Teléfono: o.customer_phone,
    Sucursal: nombreSucursal(o),
    Total: Number(o.total),
    Estado: badgeDeEstado(o.status).etiqueta,
    Fecha: o.created_at ? format(new Date(o.created_at), "d MMM yyyy, HH:mm", { locale: es }) : "—",
    Origen: o.source,
  });

  const exportarExcel = () => {
    const filas = ordenes.map(filaExport);
    const hoja = XLSX.utils.json_to_sheet(filas);
    hoja["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 10 }];
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Historial de órdenes");
    XLSX.writeFile(libro, `atiende-historial-ordenes-${Date.now()}.xlsx`);
  };

  const exportarPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Atiende — Historial de Órdenes", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`${ordenes.length} pedidos · ${etiquetaRango}`, 14, 25);
    doc.text(new Date().toLocaleString("es-MX"), 14, 30);
    doc.setTextColor(0);
    autoTable(doc, {
      startY: 36,
      head: [["N° pedido", "Cliente", "Teléfono", "Sucursal", "Total", "Estado", "Fecha", "Origen"]],
      body: ordenes.map((o) => {
        const f = filaExport(o);
        return [f["N° de pedido"], f.Cliente, f.Teléfono, f.Sucursal, formatoMXN(f.Total), f.Estado, f.Fecha, f.Origen];
      }),
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 8 },
    });
    doc.save(`atiende-historial-ordenes-${Date.now()}.pdf`);
  };

  const hayFiltrosActivos = sucursalId !== "todas" || soloProblemas || !!rangoAplicado || presetRango !== "30d" || !!busquedaAplicada;
  const limpiarFiltros = () => {
    setSucursalId("todas");
    setSoloProblemas(false);
    setRangoAplicado(undefined);
    setPresetRango("30d");
    setBusqueda("");
    setBusquedaAplicada("");
  };

  return (
    <div className="space-y-3">
      {/* Header: filtros a la izquierda, exportar (azul, primario) a la derecha */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Rango de fecha — mismo componente/patrón (Popover + Calendar
              shadcn en modo "range", con presets a un lado) que ya usa el
              selector de rango de "Agente de voz" en este mismo panel. */}
          <Popover open={mostrarCalendario} onOpenChange={(v) => { setMostrarCalendario(v); if (v) setRangoBorrador(rangoAplicado); }}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 h-8 pl-2.5 pr-2 rounded-full border border-border bg-card text-[12px] text-foreground hover:bg-muted transition-colors">
                <CalendarDays className="w-3.5 h-3.5 text-primary" />
                <span className="font-medium">{etiquetaRango}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0 overflow-hidden">
              <div className="flex">
                <div className="w-40 border-r border-border p-1.5 space-y-0.5">
                  {PRESETS_HISTORIAL.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setPresetRango(p.id); setRangoAplicado(undefined); setMostrarCalendario(false); }}
                      className={`w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] text-left transition-colors ${!rangoAplicado && presetRango === p.id ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"}`}
                    >
                      {p.etiqueta}
                      {!rangoAplicado && presetRango === p.id && <span className="text-primary">✓</span>}
                    </button>
                  ))}
                </div>
                <div className="p-2">
                  <Calendar mode="range" selected={rangoBorrador} onSelect={setRangoBorrador} numberOfMonths={1} locale={es} />
                  <div className="flex items-center justify-end px-2 pb-2 gap-1.5">
                    <button
                      onClick={() => setMostrarCalendario(false)}
                      className="h-7 px-3 rounded-full border border-border text-[11px] text-foreground hover:bg-muted transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => { if (rangoBorrador?.from && rangoBorrador?.to) setRangoAplicado(rangoBorrador); setMostrarCalendario(false); }}
                      disabled={!rangoBorrador?.from || !rangoBorrador?.to}
                      className="h-7 px-3 rounded-full bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Sucursal — mismo patrón de popover con lista tipo tarjeta
              (bordes, hover, estado seleccionado) que el resto del panel;
              antes era un <select> nativo cuyo menú desplegado no se puede
              vestir con Tailwind y salía como una lista lisa del sistema
              operativo, sin el estilo del software. */}
          <Popover open={mostrarSucursales} onOpenChange={setMostrarSucursales}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 h-8 pl-2.5 pr-2 rounded-full border border-border bg-card text-[12px] text-foreground hover:bg-muted transition-colors">
                {sucursalId === "todas"
                  ? <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                  : <Store className="w-3.5 h-3.5 text-muted-foreground" />}
                <span className="font-medium truncate max-w-[160px]">
                  {sucursalId === "todas" ? "Todas las sucursales" : (sucursales.find((s) => s.id === sucursalId)?.name ?? "Sucursal")}
                </span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-1">
              <button
                onClick={() => { setSucursalId("todas"); setMostrarSucursales(false); }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] text-left transition-colors ${sucursalId === "todas" ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"}`}
              >
                <Globe className="w-3.5 h-3.5 shrink-0" /> Todas las sucursales
              </button>
              {sucursales.length > 0 && <div className="my-1 border-t border-border" />}
              {sucursales.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSucursalId(s.id); setMostrarSucursales(false); }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] text-left transition-colors ${sucursalId === s.id ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"}`}
                >
                  <Store className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{s.name}</span>
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Reclamos / incidencias / no entregados — todo pedido que no
              llegó a "entregado" (incluye cancelado E incidencias reales,
              ver ESTADO_BADGE.problema arriba). */}
          <button
            onClick={() => setSoloProblemas((v) => !v)}
            title="Muestra todo pedido que no llegó a entregado: cancelados e incidencias reportadas."
            className={`flex items-center gap-1.5 h-8 px-2.5 rounded-full text-[12px] font-medium transition-colors ${
              soloProblemas ? "bg-destructive text-destructive-foreground" : "border border-border text-foreground hover:bg-muted"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Incidencias / no entregados
          </button>

          <form
            onSubmit={(e) => { e.preventDefault(); setBusquedaAplicada(busqueda); }}
            className="flex items-center gap-1 h-8 pl-2.5 pr-1 rounded-full border border-border bg-card"
          >
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Cliente o teléfono…"
              className="h-full w-32 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground outline-none"
            />
          </form>

          {hayFiltrosActivos && (
            <button onClick={limpiarFiltros} className="flex items-center gap-1 h-8 px-2 rounded-full text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <X className="w-3 h-3" /> Limpiar filtros
            </button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" disabled={ordenes.length === 0} className="h-8 rounded-full text-[12.5px] shrink-0">
              <Download className="w-3.5 h-3.5" /> Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportarExcel}>
              <FileSpreadsheet className="w-3.5 h-3.5 mr-2 text-green-600" /> Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportarPdf}>
              <FileText className="w-3.5 h-3.5 mr-2 text-red-600" /> PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {cargando ? "Cargando…" : `${totalFiltrado.toLocaleString("es-MX")} en total · mostrando ${ordenes.length}${totalFiltrado > MAX_CARGADOS ? ` (tope de ${MAX_CARGADOS})` : ""}`}
        </p>

        {error && (
          <p className="text-[12px] text-destructive flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}</p>
        )}

        {cargando ? (
          <div className="py-12 text-center">
            <Loader2 className="w-6 h-6 mx-auto text-muted-foreground/50 animate-spin" />
          </div>
        ) : ordenes.length === 0 ? (
          <div className="py-12 text-center">
            <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" strokeWidth={1.5} />
            <p className="text-[13px] text-muted-foreground">No hay pedidos que coincidan con estos filtros</p>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-3 py-2 text-[10.5px] font-mono uppercase tracking-wide text-muted-foreground">Cliente</th>
                    <th className="px-3 py-2 text-[10.5px] font-mono uppercase tracking-wide text-muted-foreground">N° de pedido</th>
                    <th className="px-3 py-2 text-[10.5px] font-mono uppercase tracking-wide text-muted-foreground">Sucursal</th>
                    <th className="px-3 py-2 text-[10.5px] font-mono uppercase tracking-wide text-muted-foreground text-right">Monto</th>
                    <th className="px-3 py-2 text-[10.5px] font-mono uppercase tracking-wide text-muted-foreground">Estado</th>
                    <th className="px-3 py-2 text-[10.5px] font-mono uppercase tracking-wide text-muted-foreground">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenes.map((o) => {
                    const badge = badgeDeEstado(o.status);
                    return (
                      <tr
                        key={o.id}
                        onClick={() => abrirDetalle(o.id)}
                        className="border-b border-dashed border-border last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                      >
                        <td className="px-3 py-2.5">
                          <p className="text-[13px] font-medium text-foreground truncate max-w-[180px]">{o.customer_name}</p>
                          <p className="text-[11px] text-muted-foreground">{o.customer_phone}</p>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[12px] text-muted-foreground tabular-nums">{numeroPedido(o.id)}</td>
                        <td className="px-3 py-2.5 text-[12.5px] text-foreground">{nombreSucursal(o)}</td>
                        <td className="px-3 py-2.5 text-right font-display text-[13px] font-semibold tabular-nums text-foreground">{formatoMXN(Number(o.total))}</td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-medium ${badge.clase}`}
                            title={o.status === "problema" && o.incident_note ? o.incident_note : undefined}
                          >
                            {badge.etiqueta}
                          </span>
                          {esDemorado(o) && (
                            <span className="inline-block ml-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-100 text-red-700">
                              Demorado
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-muted-foreground whitespace-nowrap">
                          {o.created_at ? format(new Date(o.created_at), "d MMM yyyy, HH:mm", { locale: es }) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {hayMas && (
              <div className="flex justify-center pt-1">
                <button
                  onClick={cargarMas}
                  disabled={cargandoMas}
                  className="flex items-center gap-1.5 h-8 px-4 rounded-full border border-border text-[12.5px] text-foreground hover:bg-muted transition-colors disabled:opacity-60"
                >
                  {cargandoMas ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando…</> : "Cargar más"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detalle real de un pedido — ver abrirDetalle() arriba */}
      <Dialog open={!!detalleAbierto || cargandoDetalle} onOpenChange={(abierto) => { if (!abierto) setDetalleAbierto(null); }}>
        <DialogContent className="max-w-lg">
          {cargandoDetalle && !detalleAbierto ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : detalleAbierto ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {numeroPedido(detalleAbierto.id)}
                  <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-medium ${badgeDeEstado(detalleAbierto.status).clase}`}>
                    {badgeDeEstado(detalleAbierto.status).etiqueta}
                  </span>
                </DialogTitle>
                <DialogDescription>
                  {detalleAbierto.created_at ? format(new Date(detalleAbierto.created_at), "d MMM yyyy, HH:mm", { locale: es }) : "—"}
                  {" · "}{nombreSucursal(detalleAbierto)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-[13px]">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-foreground truncate">{detalleAbierto.customer_name}</p>
                      <p className="text-[11px] text-muted-foreground">Cliente</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-foreground truncate">{detalleAbierto.customer_phone}</p>
                      <p className="text-[11px] text-muted-foreground">Teléfono</p>
                    </div>
                  </div>
                  {detalleAbierto.customer_address && (
                    <div className="flex items-start gap-2 col-span-2">
                      <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-foreground">{detalleAbierto.customer_address}</p>
                        <p className="text-[11px] text-muted-foreground">Dirección de entrega</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    {detalleAbierto.source === "voice" ? <Mic className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" /> : detalleAbierto.source === "whatsapp" ? <MessageCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" /> : <Globe className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                    <div className="min-w-0">
                      <p className="text-foreground capitalize">{detalleAbierto.source === "voice" ? "Llamada" : detalleAbierto.source === "whatsapp" ? "WhatsApp" : detalleAbierto.source}</p>
                      <p className="text-[11px] text-muted-foreground">Canal</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    {detalleAbierto.payment_method === "tarjeta" ? <CreditCard className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" /> : detalleAbierto.payment_method === "efectivo" ? <Banknote className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" /> : <Wallet className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                    <div className="min-w-0">
                      <p className="text-foreground capitalize">{detalleAbierto.payment_method ?? "No registrada"}</p>
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
                      {(detalleAbierto.items ?? []).map((it, idx) => (
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
                        <td className="px-2.5 py-2 text-right font-display text-[14px] font-semibold tabular-nums text-foreground">{formatoMXN(Number(detalleAbierto.total))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {detalleAbierto.notes && (
                  <div className="flex items-start gap-2 rounded-xl border border-border p-2.5">
                    <StickyNote className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-foreground">{detalleAbierto.notes}</p>
                      <p className="text-[11px] text-muted-foreground">Instrucciones especiales</p>
                    </div>
                  </div>
                )}

                {detalleAbierto.status === "problema" && detalleAbierto.incident_note && (
                  <div className="flex items-start gap-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-2.5">
                    <AlertTriangle className="w-4 h-4 text-fuchsia-700 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-foreground">{detalleAbierto.incident_note}</p>
                      <p className="text-[11px] text-fuchsia-700">Incidencia reportada</p>
                    </div>
                  </div>
                )}

                {detalleAbierto.delivered_at && (
                  <p className="text-[11.5px] text-muted-foreground">
                    Entregado el {format(new Date(detalleAbierto.delivered_at), "d MMM yyyy, HH:mm", { locale: es })}
                  </p>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
