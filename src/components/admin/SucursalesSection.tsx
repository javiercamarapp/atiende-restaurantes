// Administración de sucursales: nombre/dirección/teléfono, horario, y los
// switches independientes de voice_agent_active / whatsapp_agent_active que
// controlan si cada canal de IA atiende esa sucursal. "Eliminar" es en
// realidad is_active=false (baja reversible) — nunca un delete físico, así
// que las sucursales dadas de baja se siguen listando (grises, con opción
// de reactivar) en vez de desaparecer sin rastro.
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ModalFormularioElegante, CampoFormulario } from "@/components/ModalFormularioElegante";
import {
  Store, Copy, Check, Edit, Clock, Trash2, RotateCcw, Loader2, MapPin, Navigation, Search,
} from "lucide-react";

interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  hours: string | null;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
  display_order: number | null;
  voice_agent_active: boolean;
  whatsapp_agent_active: boolean;
}

type CampoAgente = "voice_agent_active" | "whatsapp_agent_active";

interface Props {
  restaurantId: string | null;
}

// ---------------------------------------------------------------------------
// Horario estructurado por día — se guarda como texto natural en `hours`
// (los agentes de voz/WhatsApp lo leen tal cual en sus prompts), pero se
// edita en un formulario por día. parsearHorario/serializarHorario son el
// puente en ambas direcciones.
// ---------------------------------------------------------------------------
type DiaSemana = "lun" | "mar" | "mie" | "jue" | "vie" | "sab" | "dom";

interface HorarioDia {
  cerrado: boolean;
  abre: string; // "HH:MM" 24h — lo que produce <input type="time">
  cierra: string;
}

type HorarioSemana = Record<DiaSemana, HorarioDia>;

const ORDEN_DIAS: DiaSemana[] = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"];

const DIAS: { id: DiaSemana; etiqueta: string }[] = [
  { id: "lun", etiqueta: "Lunes" },
  { id: "mar", etiqueta: "Martes" },
  { id: "mie", etiqueta: "Miércoles" },
  { id: "jue", etiqueta: "Jueves" },
  { id: "vie", etiqueta: "Viernes" },
  { id: "sab", etiqueta: "Sábado" },
  { id: "dom", etiqueta: "Domingo" },
];

const ETIQUETA_DIA_CORTA: Record<DiaSemana, string> = {
  lun: "Lun", mar: "Mar", mie: "Mié", jue: "Jue", vie: "Vie", sab: "Sáb", dom: "Dom",
};

const DIAS_ABREV: Record<string, DiaSemana> = {
  lun: "lun", lunes: "lun",
  mar: "mar", martes: "mar",
  mie: "mie", "mié": "mie", miercoles: "mie", "miércoles": "mie",
  jue: "jue", jueves: "jue",
  vie: "vie", viernes: "vie",
  sab: "sab", "sáb": "sab", sabado: "sab", "sábado": "sab",
  dom: "dom", domingo: "dom",
};

const HORARIO_DIA_DEFAULT: HorarioDia = { cerrado: false, abre: "12:00", cierra: "01:00" };

function horarioSemanaDefault(): HorarioSemana {
  const semana = {} as HorarioSemana;
  ORDEN_DIAS.forEach((d) => { semana[d] = { ...HORARIO_DIA_DEFAULT }; });
  return semana;
}

const firmaDia = (d: HorarioDia) => (d.cerrado ? "cerrado" : `${d.abre}-${d.cierra}`);

function diaDesdeTexto(txt: string): DiaSemana | null {
  const clave = txt.trim().toLowerCase().replace(/\.$/, "");
  return DIAS_ABREV[clave] ?? null;
}

function expandirRangoDias(desde: DiaSemana, hasta: DiaSemana): DiaSemana[] {
  const i = ORDEN_DIAS.indexOf(desde);
  const j = ORDEN_DIAS.indexOf(hasta);
  if (i === -1 || j === -1) return [];
  const dias: DiaSemana[] = [];
  if (i <= j) {
    for (let k = i; k <= j; k++) dias.push(ORDEN_DIAS[k]);
  } else {
    for (let k = i; k < ORDEN_DIAS.length; k++) dias.push(ORDEN_DIAS[k]);
    for (let k = 0; k <= j; k++) dias.push(ORDEN_DIAS[k]);
  }
  return dias;
}

function parseHora12aHora24(texto: string): string | null {
  const m = texto.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = m[3].toLowerCase();
  if (h === 12) h = 0;
  if (ampm === "pm") h += 12;
  return `${String(h).padStart(2, "0")}:${min}`;
}

function formatHora24a12(hora24: string): string {
  const [hStr, min] = hora24.split(":");
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "pm" : "am";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${min ?? "00"} ${ampm}`;
}

function parsearRangoHoras(texto: string): { abre: string; cierra: string } | null {
  const partes = texto.split(/[–-]/).map((p) => p.trim());
  if (partes.length !== 2) return null;
  const abre = parseHora12aHora24(partes[0]);
  const cierra = parseHora12aHora24(partes[1]);
  if (!abre || !cierra) return null;
  return { abre, cierra };
}

/** Interpreta el texto libre guardado en `hours`. Best-effort: reconoce "Todos
 * los días, X – Y", "Cerrado todos los días" y el formato por rangos de días
 * que produce serializarHorario ("Lun–Vie X – Y, Sáb–Dom X – Y") — si nada de
 * eso calza limpio, cae a un horario uniforme por default para los 7 días. */
function parsearHorario(texto: string | null): HorarioSemana {
  const base = horarioSemanaDefault();
  if (!texto || !texto.trim()) return base;
  const t = texto.trim();

  if (/^cerrado todos los d[ií]as$/i.test(t)) {
    const semana = horarioSemanaDefault();
    ORDEN_DIAS.forEach((d) => { semana[d] = { ...semana[d], cerrado: true }; });
    return semana;
  }

  const mTodos = t.match(/^todos los d[ií]as,?\s*(.+)$/i);
  if (mTodos) {
    const rango = parsearRangoHoras(mTodos[1]);
    if (rango) {
      const semana = horarioSemanaDefault();
      ORDEN_DIAS.forEach((d) => { semana[d] = { cerrado: false, ...rango }; });
      return semana;
    }
    return base;
  }

  // Formato por rangos de días — el que produce nuestro propio serializador.
  const segmentos = t.split(",").map((s) => s.trim()).filter(Boolean);
  const semana: Partial<HorarioSemana> = {};
  let ok = segmentos.length > 0;

  for (const seg of segmentos) {
    const m = seg.match(/^([A-Za-zÀ-ÿ]+(?:\s*–\s*[A-Za-zÀ-ÿ]+)?)\s+(.+)$/);
    if (!m) { ok = false; break; }
    const [, spanDias, resto] = m;
    const [d1txt, d2txt] = spanDias.split("–").map((s) => s.trim());
    const dia1 = diaDesdeTexto(d1txt);
    const dia2 = d2txt ? diaDesdeTexto(d2txt) : dia1;
    if (!dia1 || !dia2) { ok = false; break; }
    const dias = expandirRangoDias(dia1, dia2);
    if (dias.length === 0) { ok = false; break; }

    if (/^cerrado$/i.test(resto.trim())) {
      dias.forEach((d) => { semana[d] = { cerrado: true, abre: HORARIO_DIA_DEFAULT.abre, cierra: HORARIO_DIA_DEFAULT.cierra }; });
      continue;
    }
    const rango = parsearRangoHoras(resto);
    if (!rango) { ok = false; break; }
    dias.forEach((d) => { semana[d] = { cerrado: false, ...rango }; });
  }

  if (ok && ORDEN_DIAS.every((d) => semana[d])) {
    return semana as HorarioSemana;
  }
  return base;
}

/** Serializa el horario por día de vuelta a texto natural — lo único que
 * leen los agentes de voz/WhatsApp. Uniforme -> "Todos los días, X – Y";
 * distinto por día -> rangos agrupados ("Lun–Vie X – Y, Sáb–Dom X – Y"). */
function serializarHorario(semana: HorarioSemana): string {
  const firmas = ORDEN_DIAS.map((d) => firmaDia(semana[d]));
  const todosIguales = firmas.every((f) => f === firmas[0]);

  if (todosIguales) {
    if (firmas[0] === "cerrado") return "Cerrado todos los días";
    const dia = semana.lun;
    return `Todos los días, ${formatHora24a12(dia.abre)} – ${formatHora24a12(dia.cierra)}`;
  }

  const grupos: { dias: DiaSemana[]; firma: string }[] = [];
  ORDEN_DIAS.forEach((d, i) => {
    const firma = firmas[i];
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.firma === firma) {
      ultimo.dias.push(d);
    } else {
      grupos.push({ dias: [d], firma });
    }
  });

  return grupos
    .map((g) => {
      const etiquetaDias = g.dias.length === 1
        ? ETIQUETA_DIA_CORTA[g.dias[0]]
        : `${ETIQUETA_DIA_CORTA[g.dias[0]]}–${ETIQUETA_DIA_CORTA[g.dias[g.dias.length - 1]]}`;
      if (g.firma === "cerrado") return `${etiquetaDias} cerrado`;
      const dia = semana[g.dias[0]];
      return `${etiquetaDias} ${formatHora24a12(dia.abre)} – ${formatHora24a12(dia.cierra)}`;
    })
    .join(", ");
}

// ---------------------------------------------------------------------------
// Ubicación — Mérida, Yucatán como centro por default cuando la sucursal
// todavía no tiene lat/lng real. Reverse geocoding vía Nominatim (OSM,
// gratis, sin API key) es "best effort": si falla, nunca bloquea guardar.
// ---------------------------------------------------------------------------
const CENTRO_DEFAULT: [number, number] = [20.98, -89.62];

async function geocodificarInverso(lat: number, lng: number): Promise<string | null> {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=0`,
      { headers: { Accept: "application/json" } },
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return typeof data?.display_name === "string" ? data.display_name : null;
  } catch {
    return null;
  }
}

interface ResultadoBusquedaUbicacion {
  lat: number;
  lng: number;
  etiqueta: string;
}

// Búsqueda directa por texto — alterna a "usar mi ubicación actual" cuando
// el navegador niega el permiso de geolocalización (común en demo/desktop).
// Sesgado a Yucatán con viewbox + bounded=1, pero no exclusivo (por si la
// sucursal de verdad está fuera, ej. un caso raro).
async function buscarUbicacion(texto: string): Promise<ResultadoBusquedaUbicacion[]> {
  if (!texto.trim()) return [];
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(texto)}&limit=5&viewbox=-90.4,21.4,-88.7,20.4&bounded=0`,
      { headers: { Accept: "application/json" } },
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((r: any) => ({ lat: Number(r.lat), lng: Number(r.lon), etiqueta: String(r.display_name ?? "") }))
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
  } catch {
    return [];
  }
}

const SucursalesSection = ({ restaurantId }: Props) => {
  const { toast } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardandoAgente, setGuardandoAgente] = useState<Set<string>>(new Set());
  const [idCopiado, setIdCopiado] = useState<string | null>(null);

  const [modalTienda, setModalTienda] = useState<Branch | null>(null);
  const [formTienda, setFormTienda] = useState<{
    name: string; address: string; phone: string; lat: number | null; lng: number | null;
  }>({ name: "", address: "", phone: "", lat: null, lng: null });
  const [guardandoTienda, setGuardandoTienda] = useState(false);
  const [ubicando, setUbicando] = useState(false);
  const [buscarTexto, setBuscarTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultadosBusqueda, setResultadosBusqueda] = useState<ResultadoBusquedaUbicacion[]>([]);

  const [modalHorario, setModalHorario] = useState<Branch | null>(null);
  const [horarioSemana, setHorarioSemana] = useState<HorarioSemana>(() => horarioSemanaDefault());
  const [mismoHorarioTodos, setMismoHorarioTodos] = useState(true);
  const [guardandoHorario, setGuardandoHorario] = useState(false);

  const [confirmarBaja, setConfirmarBaja] = useState<Branch | null>(null);
  const [procesandoBaja, setProcesandoBaja] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelado = false;
    setCargando(true);
    // try/finally: sin esto, cualquier falla real de red (no un error
    // devuelto por Supabase, sino la promesa rechazándose — timeout, DNS,
    // CORS, un proxy que corta la conexión) dejaba `cargando` en true para
    // siempre y la pestaña se quedaba pasmada en "Cargando sucursales…" sin
    // importar cuántas veces se recargara. Mismo patrón ya corregido en
    // checkAuth y cargarDatosAgentes (AdminDashboard.tsx) — aquí faltaba.
    (async () => {
      try {
        const { data, error } = await supabase
          .from("branches")
          .select("id, name, address, phone, hours, lat, lng, is_active, display_order, voice_agent_active, whatsapp_agent_active")
          .eq("restaurant_id", restaurantId)
          .order("display_order", { ascending: true })
          .order("name", { ascending: true });
        if (cancelado) return;
        if (error) {
          toast({ title: "No se pudieron cargar las sucursales", description: error.message, variant: "destructive" });
        } else {
          setBranches((data ?? []) as Branch[]);
        }
      } catch (err) {
        if (cancelado) return;
        toast({
          title: "No se pudieron cargar las sucursales",
          description: "Ocurrió un problema de conexión. Intenta recargar la página.",
          variant: "destructive",
        });
        console.error("No se pudieron cargar las sucursales:", err);
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [restaurantId, toast]);

  const copiarId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setIdCopiado(id);
      setTimeout(() => setIdCopiado((actual) => (actual === id ? null : actual)), 1500);
    } catch {
      toast({ title: "No se pudo copiar el ID", variant: "destructive" });
    }
  };

  const alternarAgente = async (branch: Branch, campo: CampoAgente, valor: boolean) => {
    const clave = `${branch.id}-${campo}`;
    setBranches((prev) => prev.map((b) => (b.id === branch.id ? { ...b, [campo]: valor } : b)));
    setGuardandoAgente((prev) => new Set(prev).add(clave));
    const { error } = await supabase.from("branches").update({ [campo]: valor }).eq("id", branch.id);
    setGuardandoAgente((prev) => {
      const siguiente = new Set(prev);
      siguiente.delete(clave);
      return siguiente;
    });
    if (error) {
      setBranches((prev) => prev.map((b) => (b.id === branch.id ? { ...b, [campo]: !valor } : b)));
      toast({ title: "No se pudo guardar", description: error.message, variant: "destructive" });
    }
  };

  const abrirEditarTienda = (b: Branch) => {
    setFormTienda({ name: b.name, address: b.address ?? "", phone: b.phone ?? "", lat: b.lat, lng: b.lng });
    setBuscarTexto("");
    setResultadosBusqueda([]);
    setModalTienda(b);
  };

  const buscarYMostrarResultados = async () => {
    if (!buscarTexto.trim()) return;
    setBuscando(true);
    const resultados = await buscarUbicacion(buscarTexto);
    setBuscando(false);
    if (resultados.length === 0) {
      toast({ title: "No encontramos esa ubicación", description: "Prueba con más detalle (colonia, calle, ciudad).", variant: "destructive" });
      return;
    }
    setResultadosBusqueda(resultados);
  };

  const elegirResultadoBusqueda = (r: ResultadoBusquedaUbicacion) => {
    setFormTienda((f) => ({ ...f, lat: r.lat, lng: r.lng, address: r.etiqueta }));
    setResultadosBusqueda([]);
    setBuscarTexto("");
  };

  // Handler compartido por el arrastre del pin, el clic en el mapa y "usar mi
  // ubicación actual" — mueve el pin y, best-effort, autocompleta dirección.
  const moverPin = async (lat: number, lng: number) => {
    setFormTienda((f) => ({ ...f, lat, lng }));
    const direccion = await geocodificarInverso(lat, lng);
    if (direccion) setFormTienda((f) => ({ ...f, address: direccion }));
  };

  const usarUbicacionActual = () => {
    if (!navigator.geolocation) {
      toast({ title: "Tu navegador no soporta ubicación", variant: "destructive" });
      return;
    }
    setUbicando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUbicando(false);
        moverPin(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setUbicando(false);
        toast({ title: "No se pudo obtener tu ubicación", description: "Revisa los permisos de ubicación del navegador.", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const guardarTienda = async () => {
    if (!modalTienda || !formTienda.name.trim()) return;
    setGuardandoTienda(true);
    const cambios = {
      name: formTienda.name.trim(),
      address: formTienda.address.trim() || null,
      phone: formTienda.phone.trim() || null,
      lat: formTienda.lat,
      lng: formTienda.lng,
    };
    const { error } = await supabase.from("branches").update(cambios).eq("id", modalTienda.id);
    setGuardandoTienda(false);
    if (error) {
      toast({ title: "No se pudo guardar la sucursal", description: error.message, variant: "destructive" });
      return;
    }
    setBranches((prev) => prev.map((b) => (b.id === modalTienda.id ? { ...b, ...cambios } : b)));
    toast({ title: "Sucursal actualizada" });
    setModalTienda(null);
  };

  const abrirEditarHorario = (b: Branch) => {
    const semana = parsearHorario(b.hours);
    setHorarioSemana(semana);
    // Siempre abre mostrando los 7 días por separado — el toggle "mismo
    // horario todos los días" sigue disponible para quien quiera fijarlos
    // todos de un jalón, pero ya no se auto-colapsa solo porque hoy
    // coincidan, para que siempre se vea (y se pueda editar) día por día.
    setMismoHorarioTodos(false);
    setModalHorario(b);
  };

  const alternarMismoHorarioTodos = (v: boolean) => {
    setMismoHorarioTodos(v);
    if (v) {
      // Al activar "mismo horario", homogeneiza usando el horario del lunes.
      setHorarioSemana((prev) => {
        const base = prev.lun;
        const siguiente = {} as HorarioSemana;
        ORDEN_DIAS.forEach((d) => { siguiente[d] = { ...base }; });
        return siguiente;
      });
    }
  };

  const actualizarTodosLosDias = (cambios: Partial<HorarioDia>) => {
    setHorarioSemana((prev) => {
      const siguiente = { ...prev };
      ORDEN_DIAS.forEach((d) => { siguiente[d] = { ...siguiente[d], ...cambios }; });
      return siguiente;
    });
  };

  const actualizarUnDia = (dia: DiaSemana, cambios: Partial<HorarioDia>) => {
    setHorarioSemana((prev) => ({ ...prev, [dia]: { ...prev[dia], ...cambios } }));
  };

  const guardarHorario = async () => {
    if (!modalHorario) return;
    setGuardandoHorario(true);
    const hours = serializarHorario(horarioSemana);
    const { error } = await supabase.from("branches").update({ hours }).eq("id", modalHorario.id);
    setGuardandoHorario(false);
    if (error) {
      toast({ title: "No se pudo guardar el horario", description: error.message, variant: "destructive" });
      return;
    }
    setBranches((prev) => prev.map((b) => (b.id === modalHorario.id ? { ...b, hours } : b)));
    toast({ title: "Horario actualizado" });
    setModalHorario(null);
  };

  const confirmarCambioActiva = async () => {
    if (!confirmarBaja) return;
    setProcesandoBaja(true);
    const nuevoValor = !confirmarBaja.is_active;
    const { error } = await supabase.from("branches").update({ is_active: nuevoValor }).eq("id", confirmarBaja.id);
    setProcesandoBaja(false);
    if (error) {
      toast({ title: "No se pudo actualizar la sucursal", description: error.message, variant: "destructive" });
      return;
    }
    setBranches((prev) => prev.map((b) => (b.id === confirmarBaja.id ? { ...b, is_active: nuevoValor } : b)));
    toast({ title: nuevoValor ? "Sucursal reactivada" : "Sucursal dada de baja" });
    setConfirmarBaja(null);
  };

  if (cargando) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="py-12 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[13px]">Cargando sucursales…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{branches.length} en total</p>

      {branches.length === 0 ? (
        <div className="py-12 text-center">
          <Store className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" strokeWidth={1.5} />
          <p className="text-[13px] text-muted-foreground">No hay sucursales registradas</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className={`p-3 flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-border last:border-0 transition-colors hover:bg-muted/40 ${branch.is_active ? "" : "opacity-60"}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Store className="w-5 h-5 text-primary" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-medium text-foreground truncate">{branch.name}</p>
                    {!branch.is_active && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700 shrink-0">Inactiva</span>
                    )}
                  </div>
                  <p className="text-[12px] text-muted-foreground truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" strokeWidth={1.75} />
                    {branch.address || "Sin dirección registrada"}
                  </p>
                  <button
                    onClick={() => copiarId(branch.id)}
                    title={branch.id}
                    className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {branch.id.slice(0, 8)}
                    {idCopiado === branch.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="flex flex-col items-center gap-1">
                  <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Voz</span>
                  <Switch
                    checked={branch.voice_agent_active}
                    disabled={!branch.is_active || guardandoAgente.has(`${branch.id}-voice_agent_active`)}
                    onCheckedChange={(v) => alternarAgente(branch, "voice_agent_active", v)}
                    aria-label={`Agente de voz activo — ${branch.name}`}
                  />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">WhatsApp</span>
                  <Switch
                    checked={branch.whatsapp_agent_active}
                    disabled={!branch.is_active || guardandoAgente.has(`${branch.id}-whatsapp_agent_active`)}
                    onCheckedChange={(v) => alternarAgente(branch, "whatsapp_agent_active", v)}
                    aria-label={`Agente de WhatsApp activo — ${branch.name}`}
                  />
                </div>

                {/* Botones redondos: el hover de "ghost" (bg-accent) es el
                    mismo azul que "text-primary" en modo claro — un ícono
                    primary sobre un fondo accent se vuelve invisible. Se
                    fuerza aquí un fondo de hover tintado (primary/10 o
                    red-50) que nunca iguala el color del ícono, en vez del
                    bg-accent sólido por default de la variante ghost. */}
                <div className="flex items-center gap-1 border-l border-border pl-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                    onClick={() => abrirEditarTienda(branch)}
                    title="Editar tienda"
                  >
                    <Edit className="w-3.5 h-3.5 text-primary" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                    onClick={() => abrirEditarHorario(branch)}
                    title="Editar horario"
                  >
                    <Clock className="w-3.5 h-3.5 text-primary" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 ${branch.is_active ? "hover:bg-red-50 hover:text-red-500" : "hover:bg-primary/10 hover:text-primary"}`}
                    onClick={() => setConfirmarBaja(branch)}
                    title={branch.is_active ? "Eliminar sucursal" : "Reactivar sucursal"}
                  >
                    {branch.is_active ? <Trash2 className="w-3.5 h-3.5 stroke-red-500" /> : <RotateCcw className="w-3.5 h-3.5 text-primary" />}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editar sucursal — mismo ancho/proporciones que ModalClonarVoz: mapa
          interactivo con pin arrastrable a la izquierda... a la derecha del
          formulario, más "usar mi ubicación actual" (geolocalización real
          del navegador). Arrastrar/tocar el mapa autocompleta la dirección
          vía reverse geocoding de Nominatim (OSM, sin API key). */}
      <Dialog open={!!modalTienda} onOpenChange={(v) => !v && setModalTienda(null)}>
        <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary to-secondary" />

          <div className="px-6 pt-6 pb-5 flex flex-col items-center text-center border-b border-border">
            <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Store className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <p className="font-display text-lg font-semibold text-foreground">Editar sucursal</p>
            {modalTienda && <p className="text-[13px] text-muted-foreground mt-1">{modalTienda.name}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_360px]">
            <div className="p-6 space-y-4 border-b md:border-b-0 md:border-r border-border text-left">
              <CampoFormulario id="sucursal-nombre" label="Nombre">
                <Input id="sucursal-nombre" value={formTienda.name} onChange={(e) => setFormTienda({ ...formTienda, name: e.target.value })} />
              </CampoFormulario>
              <CampoFormulario id="sucursal-telefono" label="Teléfono">
                <Input id="sucursal-telefono" value={formTienda.phone} onChange={(e) => setFormTienda({ ...formTienda, phone: e.target.value })} />
              </CampoFormulario>
              <CampoFormulario
                id="sucursal-direccion"
                label="Dirección"
                hint="Se autocompleta al mover el pin en el mapa — puedes editarla a mano."
              >
                <Textarea
                  id="sucursal-direccion"
                  rows={3}
                  value={formTienda.address}
                  onChange={(e) => setFormTienda({ ...formTienda, address: e.target.value })}
                />
              </CampoFormulario>
            </div>

            <div className="p-6 space-y-3 flex flex-col text-left">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">Ubicación</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full px-3 text-[11.5px]"
                  onClick={usarUbicacionActual}
                  disabled={ubicando}
                >
                  {ubicando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                  Usar mi ubicación actual
                </Button>
              </div>

              <div className="relative">
                <div className="flex gap-1.5">
                  <Input
                    placeholder="Buscar dirección o colonia…"
                    className="h-8 text-[12.5px]"
                    value={buscarTexto}
                    onChange={(e) => setBuscarTexto(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscarYMostrarResultados(); } }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg px-2.5 shrink-0"
                    onClick={buscarYMostrarResultados}
                    disabled={buscando || !buscarTexto.trim()}
                  >
                    {buscando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                {resultadosBusqueda.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 left-0 right-0 rounded-lg border border-border bg-card shadow-lg overflow-hidden max-h-40 overflow-y-auto">
                    {resultadosBusqueda.map((r, i) => (
                      <button
                        key={i}
                        type="button"
                        className="w-full text-left px-2.5 py-1.5 text-[11.5px] hover:bg-muted transition-colors border-b border-border last:border-0 truncate"
                        onClick={() => elegirResultadoBusqueda(r)}
                      >
                        {r.etiqueta}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl overflow-hidden border border-border h-[220px] shrink-0">
                {modalTienda && (
                  <MapaSucursalEditable lat={formTienda.lat} lng={formTienda.lng} onMoverPin={moverPin} />
                )}
              </div>

              <p className="text-[11px] text-muted-foreground leading-snug">
                Arrastra el pin o toca el mapa para ajustar la ubicación exacta.
              </p>

              {formTienda.lat != null && formTienda.lng != null && (
                <p className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                  {formTienda.lat.toFixed(5)}, {formTienda.lng.toFixed(5)}
                </p>
              )}
            </div>
          </div>

          <div className="px-6 pb-6 pt-2">
            <Button
              className="rounded-full w-full"
              onClick={guardarTienda}
              disabled={guardandoTienda || !formTienda.name.trim()}
            >
              {guardandoTienda ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editar horario — por día de la semana, con atajo "mismo horario
          todos los días" (el default real de las sucursales) y toggle
          "cerrado" por día. Se serializa de vuelta a texto natural en
          `hours`, que es lo único que leen los prompts de los agentes. */}
      <ModalFormularioElegante
        open={!!modalHorario}
        onOpenChange={(v) => !v && setModalHorario(null)}
        icono={Clock}
        titulo="Editar horario"
        subtitulo={modalHorario?.name}
        onGuardar={guardarHorario}
        guardando={guardandoHorario}
        anchoClase="max-w-2xl"
      >
        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
          <div>
            <p className="text-[13px] font-medium text-foreground">Mismo horario todos los días</p>
            <p className="text-[11.5px] text-muted-foreground">Aplica un solo horario de lunes a domingo.</p>
          </div>
          <Switch checked={mismoHorarioTodos} onCheckedChange={alternarMismoHorarioTodos} />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {mismoHorarioTodos ? (
            <motion.div
              key="uniforme"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <FilaHorarioDia
                etiqueta="Todos los días"
                horario={horarioSemana.lun}
                onCambiar={actualizarTodosLosDias}
              />
            </motion.div>
          ) : (
            <motion.div
              key="por-dia"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="space-y-2"
            >
              {DIAS.map(({ id, etiqueta }, i) => (
                <motion.div
                  key={id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15, delay: i * 0.03, ease: "easeOut" }}
                >
                  <FilaHorarioDia
                    etiqueta={etiqueta}
                    horario={horarioSemana[id]}
                    onCambiar={(cambios) => actualizarUnDia(id, cambios)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-[11px] text-muted-foreground leading-snug pt-1">
          Así se lo explican al cliente el agente de voz y el de WhatsApp.
        </p>
      </ModalFormularioElegante>

      {/* Confirmación de baja / reactivación */}
      <AlertDialog open={!!confirmarBaja} onOpenChange={(v) => !v && setConfirmarBaja(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmarBaja?.is_active ? "¿Eliminar esta sucursal?" : "¿Reactivar esta sucursal?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmarBaja?.is_active
                ? `"${confirmarBaja?.name}" se marcará como inactiva y sus agentes de voz y WhatsApp dejarán de atenderla. No se borra ningún dato — puedes reactivarla cuando quieras.`
                : `"${confirmarBaja?.name}" volverá a aparecer como sucursal activa.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={procesandoBaja}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarCambioActiva} disabled={procesandoBaja}>
              {procesandoBaja ? "Guardando…" : confirmarBaja?.is_active ? "Eliminar" : "Reactivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Fila de horario de un día (o del bloque "Todos los días") — toggle
// abierto/cerrado + un par de <input type="time">, minimalista.
// ---------------------------------------------------------------------------
function FilaHorarioDia({
  etiqueta, horario, onCambiar,
}: {
  etiqueta: string;
  horario: HorarioDia;
  onCambiar: (cambios: Partial<HorarioDia>) => void;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border border-border px-4 py-2.5 transition-colors ${horario.cerrado ? "bg-muted/20" : "bg-card"}`}>
      <p className="text-[12.5px] font-medium text-foreground w-[88px] shrink-0">{etiqueta}</p>

      <label className="flex items-center gap-2 cursor-pointer shrink-0 w-[92px]">
        <Switch checked={!horario.cerrado} onCheckedChange={(v) => onCambiar({ cerrado: !v })} />
        <span className="text-[11px] text-muted-foreground">{horario.cerrado ? "Cerrado" : "Abierto"}</span>
      </label>

      {!horario.cerrado ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Input
            type="time"
            value={horario.abre}
            onChange={(e) => onCambiar({ abre: e.target.value })}
            className="h-9 text-[12.5px] tabular-nums flex-1 min-w-0"
            aria-label={`${etiqueta} — hora de apertura`}
          />
          <span className="text-muted-foreground text-[12px] shrink-0">–</span>
          <Input
            type="time"
            value={horario.cierra}
            onChange={(e) => onCambiar({ cierra: e.target.value })}
            className="h-9 text-[12.5px] tabular-nums flex-1 min-w-0"
            aria-label={`${etiqueta} — hora de cierre`}
          />
        </div>
      ) : (
        <div className="flex-1" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mapa Leaflet + tiles OSM (misma librería/import que PedidosSection.tsx —
// sin API key) con un único marcador arrastrable. Un clic en el mapa también
// mueve el pin. Mérida, Yucatán como centro cuando la sucursal no tiene
// lat/lng todavía.
// ---------------------------------------------------------------------------
function MapaSucursalEditable({
  lat, lng, onMoverPin,
}: {
  lat: number | null;
  lng: number | null;
  onMoverPin: (lat: number, lng: number) => void;
}) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const marcadorRef = useRef<L.Marker | null>(null);
  const onMoverPinRef = useRef(onMoverPin);
  const cambioInternoRef = useRef(false);
  onMoverPinRef.current = onMoverPin;

  useEffect(() => {
    if (!contenedorRef.current || mapaRef.current) return;
    const centro: [number, number] = lat != null && lng != null ? [lat, lng] : CENTRO_DEFAULT;
    const mapa = L.map(contenedorRef.current, { zoomControl: true, attributionControl: false }).setView(centro, 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapa);

    const icono = L.divIcon({
      className: "",
      html: `<div style="width:34px;height:34px;border-radius:9999px;background:#1D4ED8;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:white;font-size:16px;">📍</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    const marcador = L.marker(centro, { icon: icono, draggable: true }).addTo(mapa);
    marcador.on("dragend", () => {
      const pos = marcador.getLatLng();
      cambioInternoRef.current = true;
      onMoverPinRef.current(pos.lat, pos.lng);
    });
    mapa.on("click", (e: L.LeafletMouseEvent) => {
      marcador.setLatLng(e.latlng);
      cambioInternoRef.current = true;
      onMoverPinRef.current(e.latlng.lat, e.latlng.lng);
    });

    mapaRef.current = mapa;
    marcadorRef.current = marcador;

    // El diálogo anima su entrada — si Leaflet mide el contenedor antes de
    // que esa animación termine, el mapa nace con el tamaño equivocado.
    const t = setTimeout(() => mapa.invalidateSize(), 300);

    return () => {
      clearTimeout(t);
      mapa.remove();
      mapaRef.current = null;
      marcadorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refleja cambios externos de lat/lng (botón "usar mi ubicación actual")
  // en el mapa — pero no cuando el cambio vino del propio arrastre/clic
  // (ya está en su lugar; re-centrar ahí interrumpiría el gesto).
  useEffect(() => {
    if (!mapaRef.current || !marcadorRef.current || lat == null || lng == null) return;
    if (cambioInternoRef.current) {
      cambioInternoRef.current = false;
      return;
    }
    marcadorRef.current.setLatLng([lat, lng]);
    mapaRef.current.setView([lat, lng], mapaRef.current.getZoom());
  }, [lat, lng]);

  return <div ref={contenedorRef} className="h-full w-full" />;
}

export default SucursalesSection;
