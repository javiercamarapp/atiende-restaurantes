// CRM real de clientes del restaurante — reemplaza la vieja pestaña
// "Usuarios" (que listaba cuentas de staff) por los clientes de verdad
// guardados en `customers`/`customer_addresses` (memoria del agente de voz
// y de WhatsApp — ver 20260902040000_customers.sql). Todo lo que se ve aquí
// sale de datos reales: nada de números inventados. Cuando no hay datos
// suficientes para calcular algo (tiers, ticket promedio, etc.) se muestra
// "Sin datos" en vez de simular una cifra.
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AtiendeMark } from "@/components/AtiendeLogo";
import { StatCard } from "@/components/admin/ui/StatCard";
import {
  Users, Search, UploadCloud, Phone, MapPin, Award, Clock, DollarSign, Repeat,
  Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, ChevronDown, Crown, Gem, Star, Circle,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────────
   TIERS — cortes de percentil (AJUSTABLES)
   El dueño del restaurante puede pedir mover estos 4 números más adelante
   según cómo se vea la distribución real de sus clientes — son los únicos
   valores "de negocio" fijos en este archivo. Todo lo demás (a qué tier
   cae cada cliente, los KPIs) se calcula en vivo contra los datos reales.
   ──────────────────────────────────────────────────────────────────────── */
const CORTE_PERCENTIL_BLACK = 90; // percentil ≥ 90 → BLACK (10% que más consume)
const CORTE_PERCENTIL_PLATINUM = 75; // percentil ≥ 75 → PLATINUM (siguiente 15%)
const CORTE_PERCENTIL_GOLD = 35; // percentil ≥ 35 → GOLD (siguiente ~40%)
// el resto (percentil < 35, ~65% que menos consume) → BLUE

type Tier = "BLACK" | "PLATINUM" | "GOLD" | "BLUE";

const TIER_META: Record<Tier, { etiqueta: string; clase: string; Icono: typeof Crown }> = {
  BLACK: {
    etiqueta: "Black",
    clase: "bg-zinc-900 text-zinc-50 border border-zinc-900/10 dark:bg-zinc-100 dark:text-zinc-900",
    Icono: Crown,
  },
  PLATINUM: {
    etiqueta: "Platinum",
    clase: "bg-slate-200 text-slate-700 border border-slate-300/70 dark:bg-slate-500/30 dark:text-slate-100",
    Icono: Gem,
  },
  GOLD: {
    etiqueta: "Gold",
    clase: "bg-amber-100 text-amber-800 border border-amber-300/60 dark:bg-amber-500/20 dark:text-amber-300",
    Icono: Star,
  },
  BLUE: {
    etiqueta: "Blue",
    clase: "bg-primary/10 text-primary border border-primary/20",
    Icono: Circle,
  },
};

// Rangos de frecuencia de pedido para el filtro — igual de simples de tocar
// si el dueño quiere otros cortes.
const RANGOS_FRECUENCIA: { id: string; label: string; test: (n: number) => boolean }[] = [
  { id: "nuevo", label: "Nuevo (0 pedidos)", test: (n) => n === 0 },
  { id: "1", label: "1 pedido", test: (n) => n === 1 },
  { id: "2-4", label: "2 a 4 pedidos", test: (n) => n >= 2 && n <= 4 },
  { id: "5-9", label: "5 a 9 pedidos", test: (n) => n >= 5 && n <= 9 },
  { id: "10+", label: "10 pedidos o más", test: (n) => n >= 10 },
];

/* ── Tipos que reflejan el schema real (customers / customer_addresses / orders) ── */
interface CustomerRow {
  id: string;
  phone: string;
  name: string | null;
  order_count: number;
  last_order_at: string | null;
  created_at: string;
  restaurant_id: string;
}
interface AddressRow {
  id: string;
  customer_id: string;
  label: string | null;
  address: string;
  is_default: boolean;
}
interface OrderMoneyRow {
  customer_id: string | null;
  total: number;
}

interface ClienteConTier extends CustomerRow {
  direccion: AddressRow | null;
  gastoTotal: number;
  tier: Tier | null;
  percentil: number | null;
}

/* ── Helpers ── */
const normalizarTexto = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const formatMoney = (n: number) =>
  `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const diasDesde = (fechaISO: string) => Math.max(0, Math.floor((Date.now() - new Date(fechaISO).getTime()) / 86400000));

/** Percentil "rank" con empates promediados (0-100). n=1 → 100 (es, por definición, el mejor de un universo de uno). */
function calcularPercentiles(valores: number[]): number[] {
  const n = valores.length;
  if (n === 0) return [];
  if (n === 1) return [100];
  const indicesOrdenados = valores.map((_, i) => i).sort((a, b) => valores[a] - valores[b]);
  const percentiles = new Array(n).fill(0);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && valores[indicesOrdenados[j + 1]] === valores[indicesOrdenados[i]]) j++;
    const rangoPromedio = (i + j) / 2;
    const percentil = (rangoPromedio / (n - 1)) * 100;
    for (let k = i; k <= j; k++) percentiles[indicesOrdenados[k]] = percentil;
    i = j + 1;
  }
  return percentiles;
}

function tierDesdePercentil(p: number): Tier {
  if (p >= CORTE_PERCENTIL_BLACK) return "BLACK";
  if (p >= CORTE_PERCENTIL_PLATINUM) return "PLATINUM";
  if (p >= CORTE_PERCENTIL_GOLD) return "GOLD";
  return "BLUE";
}

/* ── Dropdown de filtro tipo píldora — mismo lenguaje que el selector de sucursal de "Agente de voz" ── */
function FiltroDropdown<T extends string>({
  etiqueta,
  valor,
  opciones,
  onChange,
}: {
  etiqueta: string;
  valor: T;
  opciones: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const actual = opciones.find((o) => o.id === valor);
  return (
    <div className="relative">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center gap-1.5 h-8 px-2.5 rounded-full border border-border text-[12px] text-foreground hover:bg-muted transition-colors shrink-0"
      >
        <span className="text-muted-foreground">{etiqueta}:</span> {actual?.label ?? "Todos"}
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setAbierto(false)} />
          <div className="absolute left-0 top-9 z-30 w-56 rounded-xl border border-border bg-card shadow-lg p-1 max-h-72 overflow-y-auto">
            {opciones.map((o) => (
              <button
                key={o.id}
                onClick={() => { onChange(o.id); setAbierto(false); }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[12.5px] text-left transition-colors ${
                  o.id === valor ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Sección principal
   ──────────────────────────────────────────────────────────────────────── */
export default function ClientesSection({ restaurantId }: { restaurantId: string }) {
  const [clientes, setClientes] = useState<CustomerRow[]>([]);
  const [direcciones, setDirecciones] = useState<AddressRow[]>([]);
  const [ordenes, setOrdenes] = useState<OrderMoneyRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [recargarNonce, setRecargarNonce] = useState(0);

  const [busqueda, setBusqueda] = useState("");
  const [tierFiltro, setTierFiltro] = useState<"todos" | Tier | "sin_tier">("todos");
  const [frecuenciaFiltro, setFrecuenciaFiltro] = useState<"todos" | string>("todos");
  const [modalImportarAbierto, setModalImportarAbierto] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelado = false;
    (async () => {
      setCargando(true);
      setErrorCarga(null);
      const [{ data: clientesData, error: errClientes }, { data: ordenesData, error: errOrdenes }] = await Promise.all([
        supabase.from("customers").select("*").eq("restaurant_id", restaurantId).order("created_at", { ascending: false }),
        supabase.from("orders").select("customer_id, total").eq("restaurant_id", restaurantId),
      ]);
      if (cancelado) return;
      if (errClientes || errOrdenes) {
        setErrorCarga((errClientes ?? errOrdenes)?.message ?? "No se pudo cargar la información de clientes.");
        setCargando(false);
        return;
      }
      const listaClientes = (clientesData ?? []) as CustomerRow[];
      const ids = listaClientes.map((c) => c.id);
      let listaDirecciones: AddressRow[] = [];
      if (ids.length > 0) {
        const { data: direccionesData, error: errDirecciones } = await supabase
          .from("customer_addresses")
          .select("*")
          .in("customer_id", ids);
        if (!errDirecciones) listaDirecciones = (direccionesData ?? []) as AddressRow[];
      }
      if (cancelado) return;
      setClientes(listaClientes);
      setDirecciones(listaDirecciones);
      setOrdenes((ordenesData ?? []) as OrderMoneyRow[]);
      setCargando(false);
    })();
    return () => { cancelado = true; };
  }, [restaurantId, recargarNonce]);

  const { clientesConTier, metrica, distribucionTier } = useMemo(() => {
    const gastoPorCliente = new Map<string, number>();
    ordenes.forEach((o) => {
      if (o.customer_id) gastoPorCliente.set(o.customer_id, (gastoPorCliente.get(o.customer_id) ?? 0) + Number(o.total ?? 0));
    });

    const conGasto = clientes.filter((c) => (gastoPorCliente.get(c.id) ?? 0) > 0).length;
    const conFrecuencia = clientes.filter((c) => c.order_count > 0).length;

    // Preferimos gasto real (suma de orders.total por customer_id) como
    // métrica de tier — es la más fiel a "consumo". Pero si muy pocos
    // clientes tienen pedidos con customer_id enlazado, esa suma no
    // representaría bien a la base completa, así que caemos a order_count
    // (que sí se mantiene siempre — ver upsertCustomer en
    // supabase/functions/_shared/create-order-core.ts). Si tampoco hay eso,
    // no hay señal real: no se inventan tiers.
    let metricaElegida: "gasto" | "frecuencia" | "sin_datos" = "sin_datos";
    if (clientes.length > 0) {
      if (conGasto >= Math.max(1, Math.ceil(clientes.length * 0.3))) metricaElegida = "gasto";
      else if (conFrecuencia > 0) metricaElegida = "frecuencia";
    }

    const valores = clientes.map((c) =>
      metricaElegida === "gasto" ? (gastoPorCliente.get(c.id) ?? 0) : metricaElegida === "frecuencia" ? c.order_count : 0,
    );
    const percentiles = metricaElegida !== "sin_datos" ? calcularPercentiles(valores) : valores.map(() => null as number | null);

    const direccionPorCliente = new Map<string, AddressRow>();
    direcciones.forEach((a) => {
      const actual = direccionPorCliente.get(a.customer_id);
      if (!actual || (a.is_default && !actual.is_default)) direccionPorCliente.set(a.customer_id, a);
    });

    const distrib: Record<Tier, number> = { BLACK: 0, PLATINUM: 0, GOLD: 0, BLUE: 0 };
    const conTier: ClienteConTier[] = clientes.map((c, i) => {
      const gastoTotal = gastoPorCliente.get(c.id) ?? 0;
      const percentil = percentiles[i];
      const tier = percentil === null ? null : tierDesdePercentil(percentil);
      if (tier) distrib[tier]++;
      return { ...c, direccion: direccionPorCliente.get(c.id) ?? null, gastoTotal, tier, percentil };
    });

    return { clientesConTier: conTier, metrica: metricaElegida, distribucionTier: distrib };
  }, [clientes, ordenes, direcciones]);

  const kpis = useMemo(() => {
    const total = clientes.length;
    const recurrentes = clientes.filter((c) => c.order_count > 1).length;
    const unaVez = clientes.filter((c) => c.order_count === 1).length;
    const baseConPedidos = recurrentes + unaVez;
    const pctRecurrentes = baseConPedidos > 0 ? (recurrentes / baseConPedidos) * 100 : null;

    const ticketPromedio = ordenes.length > 0 ? ordenes.reduce((s, o) => s + Number(o.total ?? 0), 0) / ordenes.length : null;

    let clienteTop: CustomerRow | null = null;
    clientes.forEach((c) => {
      if (c.order_count > 0 && (!clienteTop || c.order_count > clienteTop.order_count)) clienteTop = c;
    });

    const conUltimoPedido = clientes.filter((c) => c.last_order_at);
    const diasPromedio = conUltimoPedido.length > 0
      ? conUltimoPedido.reduce((s, c) => s + diasDesde(c.last_order_at as string), 0) / conUltimoPedido.length
      : null;

    return { total, pctRecurrentes, ticketPromedio, clienteTop, diasPromedio };
  }, [clientes, ordenes]);

  const listaFiltrada = useMemo(() => {
    const buscar = busqueda.trim();
    const buscarNorm = normalizarTexto(buscar);
    const buscarDigits = buscar.replace(/\D/g, "");
    return clientesConTier.filter((c) => {
      if (tierFiltro === "sin_tier" && c.tier !== null) return false;
      if (tierFiltro !== "todos" && tierFiltro !== "sin_tier" && c.tier !== tierFiltro) return false;
      if (frecuenciaFiltro !== "todos") {
        const rango = RANGOS_FRECUENCIA.find((r) => r.id === frecuenciaFiltro);
        if (rango && !rango.test(c.order_count)) return false;
      }
      if (buscar) {
        const enNombre = buscarNorm ? normalizarTexto(c.name ?? "").includes(buscarNorm) : false;
        const enTelefono = buscarDigits ? c.phone.replace(/\D/g, "").includes(buscarDigits) : false;
        if (!enNombre && !enTelefono) return false;
      }
      return true;
    });
  }, [clientesConTier, busqueda, tierFiltro, frecuenciaFiltro]);

  const opcionesTier = [
    { id: "todos" as const, label: "Todos los tiers" },
    { id: "BLACK" as const, label: "Black" },
    { id: "PLATINUM" as const, label: "Platinum" },
    { id: "GOLD" as const, label: "Gold" },
    { id: "BLUE" as const, label: "Blue" },
    { id: "sin_tier" as const, label: "Sin tier todavía" },
  ];
  const opcionesFrecuencia = [{ id: "todos", label: "Cualquier frecuencia" }, ...RANGOS_FRECUENCIA.map((r) => ({ id: r.id, label: r.label }))];

  return (
    <>
      {/* KPIs */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Panorama de clientes</p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <StatCard icon={Users} label="Clientes totales" value={String(kpis.total)} />
          <StatCard
            icon={DollarSign}
            label="Ticket promedio"
            value={kpis.ticketPromedio !== null ? formatMoney(kpis.ticketPromedio) : "Sin datos"}
          />
          <StatCard
            icon={Repeat}
            label="Clientes recurrentes"
            value={kpis.pctRecurrentes !== null ? `${kpis.pctRecurrentes.toFixed(0)}%` : "Sin datos"}
            nota={kpis.pctRecurrentes !== null ? "de quienes ya pidieron al menos una vez" : undefined}
          />
          <StatCard
            icon={Award}
            label="Cliente más frecuente"
            value={kpis.clienteTop ? (kpis.clienteTop.name || kpis.clienteTop.phone) : "Sin datos"}
            nota={kpis.clienteTop ? `${kpis.clienteTop.order_count} pedidos` : undefined}
          />
          <StatCard
            icon={Clock}
            label="Días desde su último pedido"
            value={kpis.diasPromedio !== null ? kpis.diasPromedio.toFixed(0) : "Sin datos"}
            nota={kpis.diasPromedio !== null ? "promedio de la base" : undefined}
          />
        </div>

        <div className="pt-1 border-t border-dashed border-border">
          <p className="text-[11.5px] text-muted-foreground mb-2 mt-3">Distribución por tier</p>
          {metrica === "sin_datos" ? (
            <p className="text-[12.5px] text-muted-foreground">
              Todavía no hay pedidos vinculados a clientes ni frecuencia registrada — los tiers aparecen en cuanto haya actividad real.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {(["BLACK", "PLATINUM", "GOLD", "BLUE"] as Tier[]).map((t) => {
                const Icono = TIER_META[t].Icono;
                return (
                  <div key={t} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${TIER_META[t].clase}`}>
                    <Icono className="w-3 h-3" strokeWidth={2} />
                    {TIER_META[t].etiqueta}
                    <span className="tabular-nums opacity-80">· {distribucionTier[t]}</span>
                  </div>
                );
              })}
              {clientes.length > 0 && clientes.length < 10 && (
                <span className="text-[11px] text-muted-foreground/70">(con tan pocos clientes todavía, los tiers dicen poco — se vuelven más significativos según crece la base)</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filtros + lista */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{listaFiltrada.length} de {clientes.length} en total</p>
          <Button onClick={() => setModalImportarAbierto(true)} size="sm" className="h-8 px-3 rounded-full text-[12.5px]">
            <UploadCloud className="w-3.5 h-3.5" /> Importar clientes
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[180px] flex items-center gap-1.5 h-8 rounded-lg border border-border bg-background px-2.5">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o teléfono…"
              className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          <FiltroDropdown<"todos" | Tier | "sin_tier"> etiqueta="Tier" valor={tierFiltro} opciones={opcionesTier} onChange={setTierFiltro} />
          <FiltroDropdown<string> etiqueta="Frecuencia" valor={frecuenciaFiltro} opciones={opcionesFrecuencia} onChange={setFrecuenciaFiltro} />
        </div>

        {cargando ? (
          <div className="py-12 text-center">
            <Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground/50" />
          </div>
        ) : errorCarga ? (
          <div className="py-8 text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-destructive/70" />
            <p className="text-[13px] text-destructive">{errorCarga}</p>
          </div>
        ) : listaFiltrada.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" strokeWidth={1.5} />
            <p className="text-[13px] text-muted-foreground max-w-sm mx-auto">
              {clientes.length === 0
                ? "Todavía no hay clientes reales guardados. Se registran solos cuando alguien pide por voz o WhatsApp — o impórtalos ahora desde un archivo."
                : "Ningún cliente coincide con estos filtros."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            {listaFiltrada.map((c) => (
              <div
                key={c.id}
                className="p-3 flex flex-wrap items-center gap-3 border-b border-dashed border-border last:border-0 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 basis-[220px]">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-primary" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{c.name || "Sin nombre"}</p>
                    <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <Phone className="w-3 h-3 shrink-0" /> <span className="truncate">{c.phone}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground min-w-0 flex-1 basis-[200px]">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{c.direccion?.address ?? "Sin domicilio guardado"}</span>
                </div>

                <div className="text-[12px] text-muted-foreground shrink-0 basis-[160px]">
                  {c.order_count > 0 ? `${c.order_count} pedido${c.order_count === 1 ? "" : "s"}` : "Sin pedidos aún"}
                  {c.last_order_at && <span className="opacity-70"> · hace {diasDesde(c.last_order_at)}d</span>}
                </div>

                {c.tier ? (
                  <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0 ${TIER_META[c.tier].clase}`}>
                    {(() => { const Icono = TIER_META[c.tier].Icono; return <Icono className="w-3 h-3" strokeWidth={2} />; })()}
                    {TIER_META[c.tier].etiqueta}
                  </div>
                ) : (
                  <div className="px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0 bg-muted text-muted-foreground border border-border">
                    Sin tier aún
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ImportarClientesModal
        open={modalImportarAbierto}
        onOpenChange={setModalImportarAbierto}
        restaurantId={restaurantId}
        onImportado={() => setRecargarNonce((n) => n + 1)}
      />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Importación masiva — CSV / Excel con mapeo asistido de columnas
   ──────────────────────────────────────────────────────────────────────── */
type PasoImport = "archivo" | "mapeo" | "confirmar" | "resultado";
type CampoDestino = "ignorar" | "nombre" | "telefono" | "direccion" | "etiqueta";

// Coincidencia de texto sobre el nombre de columna — NO es IA, es una lista
// de sinónimos normalizada (sin acentos/espacios). Se lo decimos así al
// usuario en la UI para no sobre-prometer.
const SINONIMOS_COLUMNA: Record<Exclude<CampoDestino, "ignorar">, string[]> = {
  nombre: ["nombre", "name", "cliente", "nombrecompleto", "fullname", "contacto"],
  telefono: ["telefono", "phone", "celular", "tel", "numero", "movil", "whatsapp", "numerocelular", "numerodetelefono"],
  direccion: ["direccion", "domicilio", "address", "calle", "ubicacion"],
  etiqueta: ["etiqueta", "label", "tipodedireccion", "alias", "tipo"],
};

function autoMapearColumnas(encabezados: string[]): Record<number, CampoDestino> {
  const mapa: Record<number, CampoDestino> = {};
  const usados = new Set<CampoDestino>();
  encabezados.forEach((h, i) => {
    const norm = normalizarTexto(h);
    let asignado: CampoDestino = "ignorar";
    for (const campo of Object.keys(SINONIMOS_COLUMNA) as (keyof typeof SINONIMOS_COLUMNA)[]) {
      if (usados.has(campo)) continue;
      if (norm && SINONIMOS_COLUMNA[campo].some((s) => norm.includes(s) || s.includes(norm))) {
        asignado = campo;
        break;
      }
    }
    if (asignado !== "ignorar") usados.add(asignado);
    mapa[i] = asignado;
  });
  return mapa;
}

interface ResultadoImport {
  guardados: number;
  domiciliosDetectados: number;
  omitidas: number;
  erroresLote: string[];
}

function ImportarClientesModal({
  open,
  onOpenChange,
  restaurantId,
  onImportado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  restaurantId: string;
  onImportado: () => void;
}) {
  const { toast } = useToast();
  const [paso, setPaso] = useState<PasoImport>("archivo");
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [filas, setFilas] = useState<string[][]>([]);
  const [mapeo, setMapeo] = useState<Record<number, CampoDestino>>({});
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setPaso("archivo");
      setArchivoNombre(null);
      setHeaders([]);
      setFilas([]);
      setMapeo({});
      setError(null);
      setResultado(null);
      setProcesando(false);
      setArrastrando(false);
    }
  }, [open]);

  const PASOS: { id: PasoImport; etiqueta: string }[] = [
    { id: "archivo", etiqueta: "Subir archivo" },
    { id: "mapeo", etiqueta: "Mapear columnas" },
    { id: "confirmar", etiqueta: "Confirmar" },
    { id: "resultado", etiqueta: "Resultado" },
  ];

  const procesarArchivo = async (file: File) => {
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const hoja = wb.Sheets[wb.SheetNames[0]];
      const crudo = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: "" }) as string[][];
      if (crudo.length < 2) throw new Error("El archivo no tiene filas de datos debajo del encabezado.");
      const [enc, ...resto] = crudo;
      const encabezados = enc.map((h) => (String(h ?? "").trim() || "(sin nombre)"));
      const filasLimpias = resto.filter((f) => f.some((c) => String(c ?? "").trim() !== ""));
      if (filasLimpias.length === 0) throw new Error("No encontramos filas con datos en el archivo.");
      setHeaders(encabezados);
      setFilas(filasLimpias);
      setArchivoNombre(file.name);
      setMapeo(autoMapearColumnas(encabezados));
      setPaso("mapeo");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo — revisa que sea un CSV o Excel válido.");
    }
  };

  const idxTelefonoEntry = Object.entries(mapeo).find(([, v]) => v === "telefono");
  const tieneTelefonoMapeado = idxTelefonoEntry !== undefined;

  const resumenPreview = useMemo(() => {
    if (!idxTelefonoEntry) return { validas: 0, invalidas: filas.length };
    const i = Number(idxTelefonoEntry[0]);
    let validas = 0;
    filas.forEach((f) => {
      if ((f[i] ?? "").replace(/\D/g, "").length >= 10) validas++;
    });
    return { validas, invalidas: filas.length - validas };
  }, [filas, idxTelefonoEntry]);

  const ejecutarImportacion = async () => {
    if (!idxTelefonoEntry) return;
    setProcesando(true);
    setError(null);
    try {
      const idxTelefono = Number(idxTelefonoEntry[0]);
      const idxNombreEntry = Object.entries(mapeo).find(([, v]) => v === "nombre")?.[0];
      const idxDireccionEntry = Object.entries(mapeo).find(([, v]) => v === "direccion")?.[0];
      const idxEtiquetaEntry = Object.entries(mapeo).find(([, v]) => v === "etiqueta")?.[0];

      type FilaLista = { telefono: string; nombre: string | null; direccion: string | null; etiqueta: string | null };
      const porTelefono = new Map<string, FilaLista>();
      let omitidas = 0;
      filas.forEach((f) => {
        const digitos = (f[idxTelefono] ?? "").replace(/\D/g, "");
        if (digitos.length < 10) { omitidas++; return; }
        const nombre = idxNombreEntry !== undefined ? ((f[Number(idxNombreEntry)] ?? "").trim() || null) : null;
        const direccion = idxDireccionEntry !== undefined ? ((f[Number(idxDireccionEntry)] ?? "").trim() || null) : null;
        const etiqueta = idxEtiquetaEntry !== undefined ? ((f[Number(idxEtiquetaEntry)] ?? "").trim() || null) : null;
        // Si el archivo repite un teléfono, la última fila gana (mismo criterio simple que un upsert).
        porTelefono.set(digitos, { telefono: digitos, nombre, direccion, etiqueta });
      });

      const listaFinal = Array.from(porTelefono.values());
      let guardados = 0;
      let domiciliosDetectados = 0;
      const erroresLote: string[] = [];
      const TAMANO_LOTE = 200;

      for (let i = 0; i < listaFinal.length; i += TAMANO_LOTE) {
        const lote = listaFinal.slice(i, i + TAMANO_LOTE);
        const { data: upsertados, error: errUpsert } = await supabase
          .from("customers")
          .upsert(
            lote.map((f) => ({ restaurant_id: restaurantId, phone: f.telefono, name: f.nombre })),
            { onConflict: "restaurant_id,phone" },
          )
          .select("id, phone");
        if (errUpsert) { erroresLote.push(errUpsert.message); continue; }
        guardados += upsertados?.length ?? 0;

        const direccionesLote = lote
          .filter((f) => f.direccion)
          .map((f) => {
            const cust = upsertados?.find((u) => u.phone === f.telefono);
            if (!cust) return null;
            return { customer_id: cust.id, address: f.direccion as string, label: f.etiqueta, is_default: true };
          })
          .filter((x): x is { customer_id: string; address: string; label: string | null; is_default: boolean } => x !== null);

        if (direccionesLote.length > 0) {
          const { error: errDir } = await supabase
            .from("customer_addresses")
            .upsert(direccionesLote, { onConflict: "customer_id,address", ignoreDuplicates: true });
          if (errDir) erroresLote.push(errDir.message);
          else domiciliosDetectados += direccionesLote.length;
        }
      }

      setResultado({ guardados, domiciliosDetectados, omitidas, erroresLote });
      setPaso("resultado");
      if (guardados > 0) onImportado();
      if (erroresLote.length > 0) {
        toast({ title: "Algunos lotes no se guardaron", description: erroresLote[0], variant: "destructive" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la importación.");
    } finally {
      setProcesando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !procesando) onOpenChange(false); }}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden" onInteractOutside={(e) => procesando && e.preventDefault()}>
        <div className="h-1 bg-gradient-to-r from-primary to-secondary" />
        <div className="grid grid-cols-[200px_1fr] min-h-[480px]">
          <div className="border-r border-border p-6 flex flex-col gap-6 bg-muted/30">
            <AtiendeMark className="h-7 w-auto" />
            <div>
              <p className="font-display text-base font-semibold text-foreground mb-4">Importar clientes</p>
              <div className="space-y-3">
                {PASOS.map((p) => {
                  const activo = p.id === paso;
                  const completado = PASOS.findIndex((x) => x.id === paso) > PASOS.findIndex((x) => x.id === p.id);
                  return (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activo ? "bg-primary" : completado ? "bg-primary/50" : "bg-border"}`} />
                      <span className={`text-[13px] ${activo ? "font-medium text-foreground" : "text-muted-foreground"}`}>{p.etiqueta}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-6 flex flex-col">
            {paso === "archivo" && (
              <div className="flex-1 flex flex-col">
                <p className="font-display text-lg font-semibold text-foreground mb-1">Sube tu archivo de clientes</p>
                <p className="text-[13px] text-muted-foreground mb-5">
                  Acepta CSV o Excel (.xlsx, .xls). En el siguiente paso decides qué columna es cuál.
                </p>
                <div
                  onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
                  onDragLeave={() => setArrastrando(false)}
                  onDrop={(e) => { e.preventDefault(); setArrastrando(false); const f = e.dataTransfer.files?.[0]; if (f) procesarArchivo(f); }}
                  className={`flex-1 rounded-xl border border-dashed p-8 flex flex-col items-center justify-center text-center transition-colors ${arrastrando ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    hidden
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) procesarArchivo(f); }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-10 h-10 rounded-full border border-border flex items-center justify-center mb-3 hover:bg-muted transition-colors"
                  >
                    <UploadCloud className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
                  </button>
                  <p className="text-[13px] font-medium text-foreground">Haz clic para subir, o arrastra y suelta</p>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">Un archivo .csv, .xlsx o .xls con tus clientes</p>
                </div>
                {error && (
                  <p className="text-[12px] text-destructive flex items-center gap-1.5 mt-3">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
                  </p>
                )}
              </div>
            )}

            {paso === "mapeo" && (
              <div className="flex-1 flex flex-col">
                <p className="font-display text-lg font-semibold text-foreground mb-1">Mapea tus columnas</p>
                <p className="text-[13px] text-muted-foreground mb-4">
                  Detectamos {headers.length} columnas y {filas.length} filas en "{archivoNombre}". El mapeo de abajo ya viene
                  sugerido por coincidencia de texto en el nombre de columna — no es IA, revísalo antes de continuar.
                </p>
                <div className="space-y-2 flex-1 overflow-y-auto pr-1 max-h-[280px]">
                  {headers.map((h, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium text-foreground truncate">{h}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          Ej: {filas.slice(0, 2).map((f) => f[i] || "—").join(" · ") || "—"}
                        </p>
                      </div>
                      <select
                        value={mapeo[i] ?? "ignorar"}
                        onChange={(e) => setMapeo((m) => ({ ...m, [i]: e.target.value as CampoDestino }))}
                        className="h-8 px-2.5 rounded-full border border-border bg-background text-[12px] text-foreground shrink-0"
                      >
                        <option value="ignorar">Ignorar</option>
                        <option value="nombre">Nombre</option>
                        <option value="telefono">Teléfono</option>
                        <option value="direccion">Dirección</option>
                        <option value="etiqueta">Etiqueta de dirección</option>
                      </select>
                    </div>
                  ))}
                </div>
                {!tieneTelefonoMapeado && (
                  <p className="text-[12px] text-destructive flex items-center gap-1.5 mt-3">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Asigna una columna a "Teléfono" — es el único campo obligatorio (así identificamos y evitamos duplicar clientes).
                  </p>
                )}
                <div className="flex items-center justify-between mt-auto pt-5">
                  <Button variant="outline" className="rounded-full" onClick={() => setPaso("archivo")}>Atrás</Button>
                  <Button disabled={!tieneTelefonoMapeado} onClick={() => setPaso("confirmar")} className="rounded-full px-6">Siguiente</Button>
                </div>
              </div>
            )}

            {paso === "confirmar" && (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                  <FileSpreadsheet className="w-10 h-10 text-primary mb-3" strokeWidth={1.5} />
                  <p className="font-display text-lg font-semibold text-foreground mb-1">Listo para importar</p>
                  <p className="text-[13px] text-muted-foreground max-w-sm">
                    {resumenPreview.validas} cliente{resumenPreview.validas === 1 ? "" : "s"} con teléfono válido se van a guardar
                    (los que ya existan por ese teléfono se actualizan, no se duplican).
                    {resumenPreview.invalidas > 0 && ` ${resumenPreview.invalidas} fila${resumenPreview.invalidas === 1 ? "" : "s"} sin teléfono válido se van a omitir.`}
                  </p>
                </div>
                {error && (
                  <p className="text-[12px] text-destructive flex items-center gap-1.5 mb-3">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
                  </p>
                )}
                <div className="flex items-center justify-between mt-auto pt-5">
                  <Button variant="outline" className="rounded-full" onClick={() => setPaso("mapeo")} disabled={procesando}>Atrás</Button>
                  <Button disabled={procesando || resumenPreview.validas === 0} onClick={ejecutarImportacion} className="rounded-full px-6">
                    {procesando ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importando…</> : `Importar ${resumenPreview.validas} cliente${resumenPreview.validas === 1 ? "" : "s"}`}
                  </Button>
                </div>
              </div>
            )}

            {paso === "resultado" && resultado && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <CheckCircle2 className="w-12 h-12 text-primary mb-3" />
                <p className="font-display text-lg font-semibold text-foreground mb-1">Importación completa</p>
                <p className="text-[13px] text-muted-foreground max-w-sm">
                  {resultado.guardados} cliente{resultado.guardados === 1 ? "" : "s"} guardado{resultado.guardados === 1 ? "" : "s"} (nuevo{resultado.guardados === 1 ? "" : "s"} o actualizado{resultado.guardados === 1 ? "" : "s"})
                  {resultado.domiciliosDetectados > 0 && `, con ${resultado.domiciliosDetectados} domicilio${resultado.domiciliosDetectados === 1 ? "" : "s"} asociado${resultado.domiciliosDetectados === 1 ? "" : "s"}`}.
                  {resultado.omitidas > 0 && ` ${resultado.omitidas} fila${resultado.omitidas === 1 ? "" : "s"} se omitieron por no tener un teléfono válido.`}
                </p>
                {resultado.erroresLote.length > 0 && (
                  <div className="mt-3 text-left w-full max-w-sm rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-[12px] font-medium text-destructive mb-1 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" /> Algunos lotes no se guardaron
                    </p>
                    <ul className="text-[11.5px] text-destructive/90 space-y-0.5 list-disc list-inside">
                      {resultado.erroresLote.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
                <Button className="rounded-full mt-5 px-6" onClick={() => onOpenChange(false)}>Cerrar</Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
