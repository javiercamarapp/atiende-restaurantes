import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Package, DollarSign, Users, ShoppingCart, Plus, Edit, Trash2, Tag, Upload, Loader2, Menu, X, Bike, Phone, PhoneCall, MapPin, Percent, TrendingUp, TrendingDown, Eye, MessageCircle, Bell, Search, Paperclip, History, ArrowUp, FileDown, RefreshCw, ChevronUp, ChevronDown, PanelRightClose, LayoutGrid, HelpCircle, Info, ChevronRight, Mic, PlayCircle, Clock, Store, Globe, Volume2, Wrench, BookOpen, CheckCircle2, XCircle, Settings2, FileText, Maximize2, Contact } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format, subDays, subWeeks, subMonths, subYears, startOfDay, startOfWeek, startOfMonth, startOfYear, isAfter } from "date-fns";
import { es } from "date-fns/locale";
import AdminSidebar from "@/components/admin/AdminSidebar";
import NotificacionesSection from "@/components/admin/NotificacionesSection";
import { StatCard } from "@/components/admin/ui/StatCard";
import { AtiendeMark, AtiendeWordmark } from "@/components/AtiendeLogo";
import { ModalClonarVoz } from "@/components/ModalClonarVoz";
import { ModalFormularioLateral } from "@/components/ModalFormularioLateral";
import { Checkbox } from "@/components/ui/checkbox";
import { CampoPixeles } from "@/components/CampoPixeles";
import SucursalesSection from "@/components/admin/SucursalesSection";
import PedidosSection from "@/components/admin/PedidosSection";
import HistorialOrdenesSection from "@/components/admin/HistorialOrdenesSection";
import ClientesSection from "@/components/admin/ClientesSection";
import WhatsAppAgenteConfigSection from "@/components/admin/WhatsAppAgenteConfigSection";
import { SelectorIdiomasAgente } from "@/components/admin/SelectorIdiomasAgente";
import { WidgetWhatsApp } from "@/components/WidgetWhatsApp";
import { ModalProducto } from "@/components/ModalProducto";
import { ModalCategoria } from "@/components/ModalCategoria";
import { ModalRepartidor } from "@/components/ModalRepartidor";
import { ModalCuenta } from "@/components/ModalCuenta";
interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_popular: boolean | null;
  is_available: boolean | null;
  category_id: string | null;
  display_order: number | null;
}
interface Category {
  id: string;
  name: string;
  slug: string;
  display_order: number | null;
}
interface Order {
  id: string;
  customer_name: string;
  total: number;
  status: string | null;
  created_at: string;
  source?: string | null;
  call_transcript?: string | null;
  call_recording_url?: string | null;
}
interface Profile {
  id: string;
  user_id: string;
  email: string;
  nombre: string | null;
  telefono: string | null;
  created_at: string;
}
interface Promo {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  discount_text: string | null;
  is_active: boolean | null;
  display_order: number | null;
}
interface Repartidor {
  user_id: string;
  email: string;
  nombre: string | null;
  telefono: string | null;
  created_at: string;
}
interface CallbackRequest {
  id: string;
  customer_name: string;
  customer_phone: string;
  reason: string | null;
  message: string | null;
  source: string;
  resolved: boolean;
  created_at: string;
}
// Estilo compartido del tooltip de recharts — compacto y con tipografía
// fina (mono para la hora/etiqueta, como el resto de las cifras del panel)
// en vez del tooltip genérico grande de recharts.
const tooltipEstiloCompartido = {
  contentStyle: {
    backgroundColor: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '10px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    padding: '6px 10px',
    color: 'hsl(var(--popover-foreground))',
  },
  labelStyle: {
    fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
    fontSize: 11,
    color: 'hsl(var(--muted-foreground))',
    marginBottom: 2,
  },
  itemStyle: {
    fontSize: 12,
    fontWeight: 600,
    padding: 0,
  },
} as const;

// Tarjeta de KPI de agente — misma anatomía que "Tu Operación" de Rappi:
// etiqueta + ícono de info + "Ver más", cifra grande, meta chica debajo.
// `valor: null` = la métrica no se puede calcular todavía con el esquema
// real (falta instrumentación, no es solo "sin actividad") — se marca N/D
// con el porqué, en vez de fingir un cero medido. `valor: número` (0+) es
// una cifra real, calculada de Supabase, aunque hoy sea 0 por falta de uso.
function TileKpiAgente({
  label,
  valor,
  meta,
  notaGap,
  sufijo = '%',
  indice,
}: {
  label: string;
  valor: number | null;
  meta: string;
  notaGap?: string;
  sufijo?: string;
  indice: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, delay: indice * 0.05, ease: 'easeOut' }}
      className="rounded-xl border border-border bg-card p-3"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[13px] font-medium text-foreground truncate">{label}</span>
          {notaGap && (
            <span title={notaGap} className="shrink-0 text-muted-foreground/60">
              <Info className="w-3 h-3" strokeWidth={1.75} />
            </span>
          )}
        </div>
        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
          Ver más <ChevronRight className="w-2.5 h-2.5" />
        </span>
      </div>
      <p className="font-display text-xl font-semibold tabular-nums text-foreground mb-0.5">
        {notaGap ? 'N/D' : valor === null ? '—' : `${valor.toFixed(1)}${sufijo}`}
      </p>
      <p className="text-[10.5px] text-muted-foreground leading-snug">
        {notaGap ? notaGap : `Tu meta es de: ${meta}`}
      </p>
    </motion.div>
  );
}

// Cifra chica del "Dashboards" del agente de voz — misma anatomía que
// TileKpiAgente (motion + N/D honesto) pero sin el "Ver más" ni la meta,
// porque aquí no hay una meta declarada, sólo la cifra cruda.
// Cuenta regresiva/ascendente animada — mismas cifras reales de siempre,
// solo que suben de 0 hasta el valor real al entrar a la pestaña en vez de
// aparecer estáticas.
// Revela el último mensaje capturado letra por letra, para que la
// transcripción de la vista previa se sienta "escribiéndose" en vivo en
// vez de aparecer de golpe. El texto en sí sigue siendo el real capturado
// del widget — esto sólo cambia el ritmo en que se muestra.
function TextoEscribiendose({ texto }: { texto: string }) {
  const [visibles, setVisibles] = useState(0);
  useEffect(() => {
    setVisibles(0);
    const intervalo = setInterval(() => {
      setVisibles((v) => (v >= texto.length ? v : v + 1));
    }, 18);
    return () => clearInterval(intervalo);
  }, [texto]);
  return <>{texto.slice(0, visibles)}</>;
}

function CifraAnimada({ valor, formato = (n: number) => String(Math.round(n)), duracionMs = 900 }: { valor: number; formato?: (n: number) => string; duracionMs?: number }) {
  const [mostrado, setMostrado] = useState(0);
  useEffect(() => {
    let inicio: number | null = null;
    let frame: number;
    const tick = (t: number) => {
      if (inicio === null) inicio = t;
      const avance = Math.min(1, (t - inicio) / duracionMs);
      setMostrado(valor * (1 - Math.pow(1 - avance, 3)));
      if (avance < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [valor, duracionMs]);
  return <>{formato(mostrado)}</>;
}

function TileDashboardVoz({
  icon: Icon,
  label,
  valor,
  nota,
  indice,
  texto = false,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  label: string;
  valor: React.ReactNode;
  nota?: string;
  indice: number;
  /** true para valores de texto largo (nombre de modelo, de voz) — letra
   *  normal en vez del tratamiento grande/negrita de una cifra corta,
   *  que se ve pesado y fuera de lugar en una oración larga. */
  texto?: boolean;
}) {
  // Misma anatomía que StatCard de "Estadísticas" (caja --canvas interna,
  // chip de ícono sólido, pie con hairline punteado) — sólo agrega el
  // stagger de entrada y acepta un `valor` animado (CifraAnimada).
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: indice * 0.04, ease: 'easeOut' }}
      className="bg-card border border-border rounded-xl p-2"
    >
      <div className="rounded-lg px-3 py-2.5 bg-muted">
        <div className="flex items-center gap-2.5 min-w-0 mb-1.5">
          <div className="w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
          </div>
          <span className="text-[13px] text-muted-foreground truncate">{label}</span>
        </div>
        <p className={texto ? "text-[13px] font-normal text-foreground truncate" : "font-display text-xl font-semibold tabular-nums text-foreground"}>{valor}</p>
      </div>
      {nota && (
        <div className="mx-1.5 mt-1.5 pt-1.5 border-t border-dashed border-border">
          <p className="text-[11px] text-muted-foreground">{nota}</p>
        </div>
      )}
    </motion.div>
  );
}

// Caja de "no hay datos todavía" — mismo patrón honesto que usa ElevenLabs
// en sus propias pestañas (Audio/Herramientas/Base de conocimientos) hasta
// que hay conversaciones reales que analizar. Nunca inventa una cifra.
// "Gráfica fantasma" — mismo esqueleto de eje/rejilla que las gráficas
// reales de latencia de ElevenLabs, pero con una línea plana punteada en
// vez de datos: comunica "esto es lo que va a vivir aquí" sin inventar
// una sola cifra.
// Detecta la zona horaria REAL del navegador (Intl, sin pedir permiso de
// geolocalización) y la muestra al apretar el botón — no hay nada que
// guardar todavía (el agente sigue fijo a America/Merida), así que sólo
// informa, no finge configurar algo que no cambia nada real.
function BotonZonaHoraria({ compacto = false }: { compacto?: boolean }) {
  const [zona, setZona] = useState<string | null>(null);
  return (
    <div className="relative">
      <button
        onClick={() => setZona((z) => (z ? null : Intl.DateTimeFormat().resolvedOptions().timeZone))}
        className={`flex items-center gap-1.5 rounded-full border border-border text-foreground hover:bg-muted transition-colors ${compacto ? 'h-6 px-2 text-[10.5px]' : 'h-7 px-2.5 text-[11.5px]'}`}
      >
        <Globe className={compacto ? 'w-3 h-3 text-muted-foreground' : 'w-3.5 h-3.5 text-muted-foreground'} /> Establecer zona horaria
      </button>
      {zona && (
        <div className="absolute right-0 bottom-9 z-10 rounded-lg border border-border bg-card shadow-lg px-2.5 py-1.5 text-[10.5px] text-muted-foreground whitespace-nowrap">
          Tu navegador detecta: <span className="text-foreground font-medium">{zona}</span>
        </div>
      )}
    </div>
  );
}

function GraficaFantasma({ titulo }: { titulo: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3.5 flex flex-col">
      <p className="text-[11.5px] text-muted-foreground mb-2.5">{titulo}</p>
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="w-full h-16">
        <line x1="0" y1="31.5" x2="100" y2="31.5" stroke="hsl(var(--border))" strokeWidth="0.3" />
        <line x1="0" y1="16" x2="100" y2="16" stroke="hsl(var(--border))" strokeWidth="0.3" strokeDasharray="0.5 2" />
        <motion.line
          x1="0"
          y1="20"
          x2="100"
          y2="20"
          stroke="hsl(var(--primary))"
          strokeWidth="0.75"
          strokeLinecap="round"
          strokeDasharray="2 2.5"
          animate={{ strokeDashoffset: [0, -9] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
          opacity="0.3"
        />
      </svg>
      <p className="text-[10.5px] text-muted-foreground/60 mt-2">Sin datos aún</p>
    </div>
  );
}

function VacioDashboardVoz({ icon: Icon, titulo, detalle }: { icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>; titulo: string; detalle: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-border py-10 px-6">
      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center mb-3">
        <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
      </div>
      <p className="text-[13px] font-medium text-foreground mb-1">{titulo}</p>
      <p className="text-[11.5px] text-muted-foreground max-w-xs leading-snug">{detalle}</p>
    </div>
  );
}

// Panel "Dashboards" del agente de voz — mismo esqueleto de pestañas que
// ElevenLabs (General/Audio/Herramientas/Base de conocimientos), con la
// tipografía compacta y azul del resto del software. La pestaña General
// usa cifras REALES ya calculadas por cargarDatosAgentes (statsAgentes);
// el resto son estados vacíos honestos — no hay fuente de datos real para
// ellas todavía (requeriría la API de ElevenLabs + una función de borde).
// Nunca muestra costos/créditos: eso es infraestructura interna, no del cliente.
// Dona animada de tasa de éxito — mismo dato que la tarjeta de arriba
// (completados/total), sólo con otra representación visual.
function DonaTasaExito({ valor }: { valor: number | null }) {
  const radio = 30;
  const circunferencia = 2 * Math.PI * radio;
  const pct = valor ?? 0;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
      <circle cx="36" cy="36" r={radio} fill="none" stroke="hsl(var(--muted))" strokeWidth="7" />
      <motion.circle
        cx="36"
        cy="36"
        r={radio}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={circunferencia}
        transform="rotate(-90 36 36)"
        initial={{ strokeDashoffset: circunferencia }}
        animate={{ strokeDashoffset: circunferencia - (circunferencia * pct) / 100 }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
      <text x="36" y="40" textAnchor="middle" fontSize="15" fontWeight="600" fill="hsl(var(--foreground))">
        {valor === null ? '—' : `${Math.round(valor)}%`}
      </text>
    </svg>
  );
}

// Barra animada completados vs. cancelados — mismas cifras reales de
// statsAgentes, presentadas como comparación visual en vez de dos tarjetas.
function BarraComparativa({ completados, cancelados }: { completados: number; cancelados: number }) {
  const total = completados + cancelados;
  const pctCompletados = total > 0 ? (completados / total) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${pctCompletados}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
        <motion.div
          className="h-full bg-destructive/70"
          initial={{ width: 0 }}
          animate={{ width: `${total > 0 ? 100 - pctCompletados : 0}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.1 }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-primary" /> Completados: {completados}
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-destructive/70" /> Cancelados: {cancelados}
        </span>
      </div>
    </div>
  );
}

function DashboardAgente({
  restaurantId,
  canal,
  onCerrar,
  nombreAgente,
  statsAgentes,
  mensajesPromedioWhatsapp,
  sucursalesAgente = [],
  sucursalSeleccionada = 'global',
  onCambiarSucursal,
  presets = [],
  presetActivo,
  onCambiarPreset,
  agentId,
}: {
  restaurantId: string;
  canal: 'voz' | 'whatsapp';
  onCerrar: () => void;
  nombreAgente: string;
  statsAgentes: {
    totalOrdenes: number;
    ingresoTotal: number;
    voz: { total: number; completados: number; cancelados: number; ingreso: number };
    whatsapp: { total: number; completados: number; cancelados: number; ingreso: number };
  } | null;
  mensajesPromedioWhatsapp?: number | null;
  sucursalesAgente?: { id: string; name: string; elevenlabs_agent_id: string | null }[];
  sucursalSeleccionada?: string;
  onCambiarSucursal?: (id: string) => void;
  presets?: readonly { id: string; etiqueta: string }[];
  presetActivo?: string;
  onCambiarPreset?: (id: string) => void;
  agentId?: string | null;
}) {
  const [mostrarSelectorEnDashboard, setMostrarSelectorEnDashboard] = useState(false);

  // Configuración REAL del agente — leída/editada en vivo contra la API de
  // ElevenLabs vía la función de borde agent-config (nunca expone la key
  // al navegador). `borrador` es lo que el usuario está editando;
  // `original` es lo último confirmado guardado, para poder cancelar.
  type DocumentoKB = { id: string; name: string; type: string };
  type ConfigAgente = {
    first_message: string; language: string; prompt: string; temperature: number;
    llm: string; backup_llm: string; backup_llms: string[];
    voice_id: string | null; voice_public_owner_id?: string | null; speed: number; stability: number; similarity_boost: number;
    background_sound_id: string | null; background_sound_volume: number; background_sound_crossfade: boolean;
    first_message_interruptible: boolean;
    knowledge_base?: DocumentoKB[];
  };
  type VozDisponible = { voice_id: string; public_owner_id: string; name: string; gender: string; accent: string | null; description: string; preview_url: string };
  const [config, setConfig] = useState<ConfigAgente | null>(null);
  const [borrador, setBorrador] = useState<ConfigAgente | null>(null);
  const [voces, setVoces] = useState<VozDisponible[]>([]);
  const [misVoces, setMisVoces] = useState<VozDisponible[]>([]);
  const [busquedaVoz, setBusquedaVoz] = useState('');
  const [filtroGenero, setFiltroGenero] = useState<'todos' | 'male' | 'female' | 'mias'>('todos');
  const [cargandoConfig, setCargandoConfig] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorConfig, setErrorConfig] = useState<string | null>(null);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const [voceandoId, setVoceandoId] = useState<string | null>(null);

  // Base de conocimientos REAL del agente de voz — sincronizada contra las
  // tablas reales (productos, sucursales, pedidos, clientes, personal) vía
  // la acción sync_knowledge_base de agent-config, e importación de
  // documentos (PDF/imagen) vía upload_knowledge_base_file. Nunca datos de
  // relleno: si algo no existe en la base todavía (ej. repartidores dados
  // de alta), el documento generado lo dice tal cual en vez de inventarlo.
  const [sincronizandoKb, setSincronizandoKb] = useState(false);
  const [sincKbOk, setSincKbOk] = useState<string | null>(null);
  const [errorKb, setErrorKb] = useState<string | null>(null);
  const [subiendoArchivoKb, setSubiendoArchivoKb] = useState(false);
  const inputArchivoKbRef = useRef<HTMLInputElement | null>(null);

  // Clonación real de voz (Instant Voice Cloning) — vive en su propio modal
  // (ModalClonarVoz), branded, con el flujo de varias muestras real de
  // ElevenLabs. Aquí solo se guarda si está abierto y qué hacer cuando
  // termina: agregar la voz nueva al catálogo y seleccionarla.
  const [modalClonarVozAbierto, setModalClonarVozAbierto] = useState(false);
  const [mostrarListaSonidos, setMostrarListaSonidos] = useState(false);
  const OPCIONES_SONIDO_FONDO: { id: string; emoji: string; etiqueta: string }[] = [
    { id: 'restaurant', emoji: '🍽️', etiqueta: 'Restaurante' },
    { id: 'office1', emoji: '🤫', etiqueta: 'Oficina (Tranquila)' },
    { id: 'office2', emoji: '💼', etiqueta: 'Oficina (Con actividad)' },
    { id: 'city', emoji: '🏙️', etiqueta: 'Ciudad' },
    { id: 'typing', emoji: '⌨️', etiqueta: 'Escribiendo' },
    { id: 'elevator1', emoji: '🎵', etiqueta: 'Música de ascensor 1' },
    { id: 'elevator2', emoji: '🎵', etiqueta: 'Música de ascensor 2' },
    { id: 'elevator3', emoji: '🎵', etiqueta: 'Música de ascensor 3' },
    { id: 'elevator4', emoji: '🎵', etiqueta: 'Música de ascensor 4' },
  ];
  const onVozClonada = (voiceId: string, nombre: string) => {
    const nuevaVoz: VozDisponible = { voice_id: voiceId, public_owner_id: '', name: nombre, gender: '—', accent: 'clonada', description: '', preview_url: '' };
    setMisVoces((prev) => [nuevaVoz, ...prev]);
    if (borrador) setBorrador({ ...borrador, voice_id: voiceId, voice_public_owner_id: undefined });
  };
  // "Todas" solo debe traer voces que suenen mexicanas o genéricamente
  // latinoamericanas — nunca acentos de España u otros países/idiomas que
  // ElevenLabs incluya en el catálogo compartido en español. Se filtra por
  // el campo `accent` (el mismo que ya se traduce/muestra en la tarjeta de
  // cada voz), con una lista explícita de países LatAm + "neutral"
  // (el acento "neutral" del catálogo en español de ElevenLabs es el
  // neutro latinoamericano) y una lista de exclusión para acentos de
  // España/Europa que a veces también matchean alguna palabra suelta.
  const ACENTOS_LATAM = [
    'latin', 'mexic', 'colomb', 'argentin', 'chilen', 'peru', 'venezol', 'urugu', 'bolivi',
    'ecuator', 'panam', 'costarric', 'guatemal', 'hondure', 'salvador', 'nicarag', 'paragua',
    'dominican', 'puertorrique', 'centroamerican', 'sudamerican', 'neutral',
  ];
  const ACENTOS_NO_LATAM = ['spain', 'españ', 'castellan', 'castiz', 'castilian', 'iberi', 'european', 'europe'];
  const esAcentoMexicanoOLatam = (acento: string | null) => {
    const a = (acento || '').toLowerCase();
    if (a === 'clonada') return true; // voz propia — no aplica filtro de acento
    if (ACENTOS_NO_LATAM.some((k) => a.includes(k))) return false;
    return ACENTOS_LATAM.some((k) => a.includes(k));
  };
  // "Mis voces" primero, y sin repetir una que ya esté ahí (por si alguna
  // vez se añadió una voz del catálogo compartido a la cuenta). El
  // catálogo compartido (`voces`) se acota aquí a acento mexicano/LatAm —
  // esta es la lista base de la que "Todas" y, por extensión, los filtros
  // de Mujer/Hombre parten.
  const todasLasVoces = [
    ...misVoces,
    ...voces.filter((v) => esAcentoMexicanoOLatam(v.accent) && !misVoces.some((m) => m.voice_id === v.voice_id)),
  ];
  const vocesFiltradas = todasLasVoces.filter((v) => {
    if (filtroGenero === 'mias') return misVoces.some((m) => m.voice_id === v.voice_id);
    if (filtroGenero !== 'todos' && v.gender !== filtroGenero) return false;
    if (busquedaVoz && !v.name.toLowerCase().includes(busquedaVoz.toLowerCase()) && !(v.accent || '').toLowerCase().includes(busquedaVoz.toLowerCase())) return false;
    return true;
  });
  const traducirGenero = (g: string) => (g === 'male' ? 'Hombre' : g === 'female' ? 'Mujer' : g);
  const nombreModelo = (modelo: string) => (({
    'gpt-5.6-luna': 'GPT-5.6 Luna',
    'gpt-5.6-terra': 'GPT-5.6 Terra',
    'gemini-3.6-flash': 'Gemini 3.6 Flash',
    'gemini-3.5-flash-lite': 'Gemini 3.5 Flash-Lite',
  } as Record<string, string>)[modelo] ?? modelo) || 'Sin configurar';
  // `accent` puede venir null/undefined desde ElevenLabs (típico en voces
  // clonadas — IVC — y en algunas entradas del catálogo compartido que no
  // traen ese campo). Sin este guard, `.toLowerCase()` sobre null/undefined
  // tira un TypeError en pleno render de cada tarjeta de voz y congela toda
  // la pestaña "Voces e idiomas".
  const traducirAcento = (a: string | null | undefined) => {
    const t = (a || '').toLowerCase();
    if (!t) return '—';
    if (t.includes('mexic')) return 'mexicano';
    if (t.includes('colomb')) return 'colombiano';
    if (t.includes('argentin')) return 'argentino';
    if (t.includes('latin')) return 'latinoamericano';
    if (t.includes('neutral')) return 'neutral';
    if (t === 'clonada') return 'clonada';
    return a as string;
  };
  // Los nombres del catálogo compartido de ElevenLabs suelen traer un
  // sufijo descriptivo en inglés pegado con " - " (ej. "Daniela - Warm,
  // Professional, Persuasive"). Se separa el nombre real del descriptor, y
  // el descriptor se traduce con un diccionario de los adjetivos que de
  // verdad se repiten en ese catálogo — nunca se muestra texto en inglés
  // sin traducir; si una palabra no está en el diccionario, se omite en
  // vez de dejarla en inglés.
  const DICCIONARIO_DESCRIPTOR: Record<string, string> = {
    warm: 'cálida', professional: 'profesional', persuasive: 'persuasiva', calm: 'calmada',
    friendly: 'amigable', deep: 'profunda', cinematic: 'cinematográfica', storyteller: 'narradora',
    narrator: 'narradora', conversational: 'conversacional', podcast: 'podcast', executive: 'ejecutiva',
    approachable: 'cercana', upbeat: 'animada', positive: 'positiva', energetic: 'enérgica',
    informal: 'informal', tone: 'tono', natural: 'natural', unhurried: 'pausada', confident: 'segura',
    intimate: 'íntima', sophisticated: 'sofisticada', wise: 'sabia', grounded: 'serena',
    handsome: 'atractiva', cheerful: 'alegre', smooth: 'suave', elegant: 'elegante',
    military: 'militar', motivational: 'motivacional', speak: 'discurso', clear: 'clara',
    studio: 'de estudio', grandpa: 'de abuelo', tales: 'relatos', mysteries: 'misterios',
    dramatic: 'dramática', trustworthy: 'confiable', articulated: 'clara al hablar',
    engaging: 'cautivadora', narration: 'narración', spanish: 'en español', drama: 'drama',
    mexican: 'mexicana', latin: 'latina',
  };
  const nombreLimpio = (nombre: string) => nombre.split(' - ')[0].trim();
  const traducirDescriptor = (nombre: string): string => {
    const partes = nombre.split(' - ');
    if (partes.length < 2) return '';
    const palabras = partes.slice(1).join(' - ').toLowerCase().split(/[\s,&]+/).filter(Boolean);
    const traducidas = palabras.map((p) => DICCIONARIO_DESCRIPTOR[p.replace(/[^a-záéíóúñ]/g, '')]).filter(Boolean);
    // Sin repetir la misma palabra traducida dos veces seguidas
    return Array.from(new Set(traducidas)).slice(0, 3).join(' · ');
  };

  useEffect(() => {
    if (canal !== 'voz' || !agentId) return;
    setCargandoConfig(true);
    setErrorConfig(null);
    Promise.all([
      supabase.functions.invoke('agent-config', { body: { action: 'get', agent_id: agentId } }),
      supabase.functions.invoke('agent-config', { body: { action: 'voices', restaurant_id: restaurantId } }),
      supabase.functions.invoke('agent-config', { body: { action: 'mis_voces', restaurant_id: restaurantId } }),
    ]).then(([getRes, vocesRes, misVocesRes]) => {
      if (getRes.error || getRes.data?.error) throw getRes.error ?? new Error(getRes.data.error);
      const c: ConfigAgente = getRes.data;
      setConfig(c);
      setBorrador(c);
      if (!vocesRes.error && !vocesRes.data?.error) setVoces(vocesRes.data.voices ?? []);
      if (!misVocesRes.error && !misVocesRes.data?.error) setMisVoces(misVocesRes.data.voices ?? []);
    }).catch((err) => {
      console.error('No se pudo cargar la configuración real del agente:', err);
      setErrorConfig('No se pudo conectar con ElevenLabs para leer la configuración real.');
    }).finally(() => setCargandoConfig(false));
  }, [canal, agentId, restaurantId]);

  const hayCambios = config && borrador && JSON.stringify(config) !== JSON.stringify(borrador);

  const guardarCambios = async () => {
    if (!agentId || !borrador || !hayCambios) return;
    setGuardando(true);
    setGuardadoOk(false);
    try {
      const { data, error } = await supabase.functions.invoke('agent-config', {
        body: { action: 'update', agent_id: agentId, ...borrador },
      });
      if (error || data?.error) throw error ?? new Error(data.error);
      setConfig(borrador);
      setGuardadoOk(true);
      setTimeout(() => setGuardadoOk(false), 3000);
    } catch (err) {
      console.error('No se pudo guardar la configuración real:', err);
      setErrorConfig('No se pudo guardar — intenta de nuevo en un momento.');
    } finally {
      setGuardando(false);
    }
  };

  // Regenera los documentos [Auto] de la base de conocimiento a partir de
  // los datos reales del restaurante (menú, sucursales, ventas, personal) y
  // los vuelve a subir al agente — reemplaza solo los documentos [Auto] de
  // la vez anterior, nunca los que el admin subió a mano con "Importar
  // documento". Vuelve a leer el agente al final para reflejar la lista
  // real que quedó, en vez de asumir qué se guardó.
  const sincronizarBaseConocimiento = async () => {
    if (!agentId) return;
    setSincronizandoKb(true);
    setErrorKb(null);
    setSincKbOk(null);
    try {
      const { data, error } = await supabase.functions.invoke('agent-config', {
        body: { action: 'sync_knowledge_base', agent_id: agentId },
      });
      if (error || data?.error) throw error ?? new Error(data.error);

      const { data: getData, error: getError } = await supabase.functions.invoke('agent-config', {
        body: { action: 'get', agent_id: agentId },
      });
      if (getError || getData?.error) throw getError ?? new Error(getData.error);
      const kbNueva: DocumentoKB[] = getData.knowledge_base ?? [];
      setConfig((prev) => (prev ? { ...prev, knowledge_base: kbNueva } : prev));
      setBorrador((prev) => (prev ? { ...prev, knowledge_base: kbNueva } : prev));
      setSincKbOk(`Sincronizado — ${data.documentos?.length ?? 0} documentos actualizados.`);
      setTimeout(() => setSincKbOk(null), 5000);
    } catch (err) {
      console.error('No se pudo sincronizar la base de conocimiento real:', err);
      setErrorKb('No se pudo sincronizar — intenta de nuevo en un momento.');
    } finally {
      setSincronizandoKb(false);
    }
  };

  const archivoABase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(((lector.result as string) || '').split(',')[1] ?? '');
      lector.onerror = () => reject(lector.error ?? new Error('No se pudo leer el archivo'));
      lector.readAsDataURL(file);
    });

  // Sube un PDF/imagen real a la base de conocimientos de ElevenLabs
  // (upload_knowledge_base_file, endpoint binario real /v1/convai/knowledge-base/file)
  // y lo adjunta al agente reutilizando set_knowledge_base tal cual ya
  // hace el flujo de texto — un documento subido a mano aquí NUNCA se
  // reemplaza automáticamente por "Sincronizar" (esa acción solo toca los
  // documentos etiquetados [Auto]).
  const importarDocumentoKb = async (file: File) => {
    if (!agentId) return;
    setSubiendoArchivoKb(true);
    setErrorKb(null);
    try {
      const base64 = await archivoABase64(file);
      const { data: subida, error: errorSubida } = await supabase.functions.invoke('agent-config', {
        body: { action: 'upload_knowledge_base_file', restaurant_id: restaurantId, file_base64: base64, file_name: file.name, mime_type: file.type },
      });
      if (errorSubida || subida?.error) throw errorSubida ?? new Error(subida.error);

      const kbActual = borrador?.knowledge_base ?? [];
      const kbNueva: DocumentoKB[] = [...kbActual, { id: subida.id, name: subida.name, type: 'file' }];
      const { data: setData, error: errorSet } = await supabase.functions.invoke('agent-config', {
        body: { action: 'set_knowledge_base', agent_id: agentId, knowledge_base: kbNueva },
      });
      if (errorSet || setData?.error) throw errorSet ?? new Error(setData.error);

      setConfig((prev) => (prev ? { ...prev, knowledge_base: kbNueva } : prev));
      setBorrador((prev) => (prev ? { ...prev, knowledge_base: kbNueva } : prev));
      setSincKbOk(`"${file.name}" agregado a la base de conocimiento.`);
      setTimeout(() => setSincKbOk(null), 5000);
    } catch (err) {
      console.error('No se pudo importar el documento a la base de conocimiento:', err);
      setErrorKb('No se pudo importar el documento — verifica que sea un PDF u otro formato que ElevenLabs acepte, e intenta de nuevo.');
    } finally {
      setSubiendoArchivoKb(false);
      if (inputArchivoKbRef.current) inputArchivoKbRef.current.value = '';
    }
  };

  const reproducirPreview = (voiceId: string, url: string) => {
    audioPreviewRef.current?.pause();
    if (voceandoId === voiceId) { setVoceandoId(null); return; }
    const audio = new Audio(url);
    audio.play();
    audio.onended = () => setVoceandoId(null);
    audioPreviewRef.current = audio;
    setVoceandoId(voiceId);
  };
  const PESTANAS_VOZ = [
    { id: 'general' as const, etiqueta: 'General', icon: LayoutGrid },
    { id: 'audio' as const, etiqueta: 'Audio', icon: Volume2 },
    { id: 'herramientas' as const, etiqueta: 'Herramientas', icon: Wrench },
    { id: 'conocimiento' as const, etiqueta: 'Base de conocimientos', icon: BookOpen },
    { id: 'comportamiento' as const, etiqueta: 'Comportamiento', icon: Settings2 },
    { id: 'voces' as const, etiqueta: 'Voces e idiomas', icon: Mic },
    { id: 'mensaje' as const, etiqueta: 'Mensaje del sistema', icon: FileText },
  ];
  const PESTANAS_WHATSAPP = [
    { id: 'general' as const, etiqueta: 'General', icon: LayoutGrid },
    { id: 'herramientas' as const, etiqueta: 'Herramientas', icon: Wrench },
    { id: 'conocimiento' as const, etiqueta: 'Base de conocimientos', icon: BookOpen },
  ];
  const PESTANAS = canal === 'voz' ? PESTANAS_VOZ : PESTANAS_WHATSAPP;
  const [pestana, setPestana] = useState<'general' | 'audio' | 'herramientas' | 'conocimiento' | 'comportamiento' | 'voces' | 'mensaje'>('general');
  const [mensajeSistemaAbierto, setMensajeSistemaAbierto] = useState(false);

  const datos = canal === 'voz' ? statsAgentes?.voz : statsAgentes?.whatsapp;
  const tasaExito = datos && datos.total > 0 ? (datos.completados / datos.total) * 100 : null;
  const unidad = canal === 'voz' ? 'llamada' : 'conversación';

  const HERRAMIENTAS_REALES = [
    { nombre: 'buscar_cliente', descripcion: 'Busca si un número de teléfono ya es cliente conocido: nombre, direcciones guardadas y su último pedido.' },
    { nombre: 'buscar_producto', descripcion: 'Busca un platillo por nombre en el menú real de la sucursal y devuelve su id, nombre y precio exactos.' },
    { nombre: 'crear_pedido', descripcion: 'Registra el pedido final en el sistema del restaurante — un pedido no existe hasta que esta herramienta responde con éxito.' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-border">
        <div className="min-w-0 relative">
          <button
            onClick={() => setMostrarSelectorEnDashboard((v) => !v)}
            disabled={sucursalesAgente.length === 0}
            className="flex items-center gap-1.5 text-[15px] font-semibold text-foreground truncate disabled:cursor-default"
          >
            {nombreAgente}
            {sucursalesAgente.length > 0 && <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          </button>
          {mostrarSelectorEnDashboard && (
            <div className="absolute left-0 top-9 z-30 w-52 rounded-xl border border-border bg-card shadow-lg p-1">
              <button
                onClick={() => { onCambiarSucursal?.('global'); setMostrarSelectorEnDashboard(false); }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] text-left transition-colors ${sucursalSeleccionada === 'global' ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}
              >
                <Globe className="w-3.5 h-3.5 shrink-0" /> Todas las sucursales
              </button>
              <div className="my-1 border-t border-border" />
              {sucursalesAgente.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { onCambiarSucursal?.(s.id); setMostrarSelectorEnDashboard(false); }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[13px] text-left transition-colors ${sucursalSeleccionada === s.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}
                >
                  <span className="flex items-center gap-2 min-w-0"><Store className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{s.name}</span></span>
                  {canal === 'voz' && !s.elevenlabs_agent_id && <span className="font-mono text-[9px] uppercase text-muted-foreground/60 shrink-0">Sin agente</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {presets.length > 0 && (
            <div className="flex items-center gap-0.5 rounded-full border border-border bg-muted/40 p-0.5">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onCambiarPreset?.(p.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    presetActivo === p.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {p.etiqueta}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={onCerrar}
            className="h-8 px-3.5 rounded-full bg-primary text-primary-foreground text-[12px] font-medium hover:opacity-90 transition-opacity shrink-0"
          >
            Regresar a Agente de {canal === 'voz' ? 'voz' : 'WhatsApp'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 overflow-x-auto">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPestana(p.id)}
            className={`flex items-center gap-1.5 pb-2 text-[13px] font-medium transition-colors shrink-0 border-b-2 ${
              pestana === p.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <p.icon className="w-3.5 h-3.5" /> {p.etiqueta}
          </button>
        ))}
      </div>

      {pestana === 'general' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            <TileDashboardVoz icon={Phone} label="Conversaciones" valor={datos ? <CifraAnimada valor={datos.total} /> : '—'} indice={0} />
            <TileDashboardVoz
              icon={CheckCircle2}
              label="Tasa de éxito"
              valor={tasaExito === null ? 'N/D' : <CifraAnimada valor={tasaExito} formato={(n) => `${n.toFixed(1)}%`} />}
              nota={tasaExito === null ? 'Aún sin conversaciones para calcularla' : undefined}
              indice={1}
            />
            <TileDashboardVoz icon={XCircle} label="Canceladas" valor={datos ? <CifraAnimada valor={datos.cancelados} /> : '—'} indice={2} />
            <TileDashboardVoz icon={ShoppingCart} label="Pedidos completados" valor={datos ? <CifraAnimada valor={datos.completados} /> : '—'} indice={3} />
            <TileDashboardVoz
              icon={DollarSign}
              label="Ingresos generados"
              valor={datos ? <CifraAnimada valor={datos.ingreso} formato={(n) => `$${Math.round(n).toLocaleString('es-MX')}`} /> : '—'}
              indice={4}
            />
            {canal === 'voz' ? (
              <TileDashboardVoz
                icon={Clock}
                label="Duración media"
                valor="N/D"
                nota="Falta guardar la duración de cada llamada"
                indice={5}
              />
            ) : (
              <TileDashboardVoz
                icon={MessageCircle}
                label="Mensajes promedio"
                valor={mensajesPromedioWhatsapp ? mensajesPromedioWhatsapp.toFixed(1) : 'N/D'}
                nota={!mensajesPromedioWhatsapp ? 'Aún sin conversaciones para calcularlo' : 'Por conversación'}
                indice={5}
              />
            )}
          </div>

          {/* Visuales animados con las mismas cifras reales de arriba —
              nada nuevo se inventa, sólo se representa distinto. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
              <DonaTasaExito valor={tasaExito} />
              <div>
                <p className="text-[13px] font-medium text-foreground">Tasa de éxito</p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {tasaExito === null ? 'Aún sin conversaciones para calcularla.' : `${datos?.completados ?? 0} de ${datos?.total ?? 0} terminaron en pedido.`}
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[13px] font-medium text-foreground mb-3">Completados vs. cancelados</p>
              <BarraComparativa completados={datos?.completados ?? 0} cancelados={datos?.cancelados ?? 0} />
            </div>
          </div>
        </div>
      )}

      {pestana === 'audio' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <GraficaFantasma titulo="Tiempo de respuesta del agente" />
          <GraficaFantasma titulo="Latencia en la generación de respuestas" />
          <GraficaFantasma titulo="Latencia en la toma de turnos" />
          <div className="md:col-span-3">
            <VacioDashboardVoz
              icon={Volume2}
              titulo="No se han recopilado datos de audio"
              detalle="Calidad de voz, interrupciones y latencia de respuesta aparecerán aquí cuando conectemos la analítica de llamadas de ElevenLabs."
            />
          </div>
        </div>
      )}

      {pestana === 'herramientas' && (
        canal === 'voz' ? (
          <div className="space-y-2">
            {HERRAMIENTAS_REALES.map((h, i) => (
              <motion.div
                key={h.nombre}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05 }}
                className="rounded-xl border border-border bg-card p-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Wrench className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-[12.5px] text-foreground truncate">{h.nombre}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{h.descripcion}</p>
                  </div>
                </div>
                <span className="font-mono text-[10px] uppercase text-muted-foreground/70 shrink-0">0 ejecuciones</span>
              </motion.div>
            ))}
          </div>
        ) : (
          <VacioDashboardVoz
            icon={Wrench}
            titulo="No se han recopilado datos de herramientas"
            detalle={`Qué tanto usa el agente buscar_producto y crear_pedido en cada ${unidad} aparecerá aquí próximamente.`}
          />
        )
      )}

      {pestana === 'conocimiento' && (
        canal === 'voz' ? (
          <div className="space-y-3">
            <input
              ref={inputArchivoKbRef}
              type="file"
              accept="application/pdf,.pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) importarDocumentoKb(archivo);
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={sincronizarBaseConocimiento}
                disabled={sincronizandoKb || !agentId}
                className="h-8 px-3.5 rounded-full bg-primary text-primary-foreground text-[12px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {sincronizandoKb ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {sincronizandoKb ? 'Sincronizando…' : 'Sincronizar base de conocimiento'}
              </button>
              <button
                onClick={() => inputArchivoKbRef.current?.click()}
                disabled={subiendoArchivoKb || !agentId}
                className="h-8 px-3.5 rounded-full border border-border text-[12px] text-foreground hover:bg-muted transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {subiendoArchivoKb ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {subiendoArchivoKb ? 'Importando…' : 'Importar documento (PDF/imagen)'}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              "Sincronizar" regenera el menú, sucursales, estadísticas de ventas y personal reales desde el
              sistema y los sube como documentos propios. "Importar documento" agrega un PDF o imagen aparte
              (ej. un manual o una promoción) sin tocar los generados automáticamente.
            </p>
            {(sincKbOk || errorKb) && (
              <p className={`text-[12px] ${errorKb ? 'text-destructive' : 'text-primary'}`}>
                {errorKb ?? sincKbOk}
              </p>
            )}

            {!borrador?.knowledge_base || borrador.knowledge_base.length === 0 ? (
              <VacioDashboardVoz
                icon={BookOpen}
                titulo="No se han recopilado datos de la base de conocimientos"
                detalle='Presiona "Sincronizar base de conocimiento" para generarla desde el menú, las sucursales, las ventas y el personal reales del sistema.'
              />
            ) : (
              <div className="space-y-2">
                {borrador.knowledge_base.map((doc, i) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.04 }}
                    className="rounded-xl border border-border bg-card p-3 flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-foreground truncate">{doc.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {doc.name.startsWith('[Auto]') ? 'Generado desde datos reales del sistema' : 'Importado a mano'} · {doc.type}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="rounded-xl border border-border bg-card p-3.5">
              <p className="text-[13px] text-foreground font-medium mb-1">El agente de WhatsApp no usa documentos de base de conocimiento</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                A diferencia del agente de voz (ElevenLabs), el agente de WhatsApp consulta el menú y los datos del
                cliente en vivo con las mismas herramientas reales (buscar_producto, buscar_cliente) en cada
                mensaje — no hay un documento estático que sincronizar aquí. Los datos son los mismos del sistema;
                solo cambia cómo cada canal los consulta.
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground">
              La base de conocimiento con menú, sucursales, ventas y personal generada en la pestaña de voz vive
              en el agente de ElevenLabs y refleja los mismos datos reales que usa este canal.
            </p>
          </div>
        )
      )}

      {(pestana === 'comportamiento' || pestana === 'voces' || pestana === 'mensaje') && (
        cargandoConfig ? (
          <div className="flex items-center justify-center py-16 text-[13px] text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Leyendo la configuración real del agente…
          </div>
        ) : !borrador ? (
          <VacioDashboardVoz
            icon={Settings2}
            titulo={errorConfig ?? 'No se pudo leer la configuración del agente'}
            detalle="Verifica que el agente tenga una API key real de ElevenLabs conectada."
          />
        ) : (
          <div className="space-y-4">
            {pestana === 'comportamiento' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2.5">
                  <TileDashboardVoz icon={Settings2} label="Modelo (LLM)" valor={nombreModelo(borrador.llm)} indice={0} texto />
                  <TileDashboardVoz
                    icon={Settings2}
                    label="Respaldo si falla"
                    valor={(borrador.backup_llms.length ? borrador.backup_llms : [borrador.backup_llm]).filter(Boolean).map(nombreModelo).join(' → ') || 'Sin configurar'}
                    indice={1}
                    texto
                  />
                </div>
                <div className="rounded-xl border border-border bg-card p-3.5">
                  <p className="text-[13px] font-medium text-foreground mb-1">Temperatura</p>
                  <p className="text-[11.5px] text-muted-foreground mb-4 leading-snug">Controla la creatividad y aleatoriedad de las respuestas generadas por el LLM.</p>
                  <div className="relative pt-7">
                    <div
                      className="absolute -top-0.5 -translate-x-1/2 bg-foreground text-background text-[13px] font-semibold font-mono tabular-nums rounded-lg px-2.5 py-1 pointer-events-none"
                      style={{ left: `${borrador.temperature * 100}%` }}
                    >
                      {borrador.temperature.toFixed(2)}
                    </div>
                    <input
                      type="range" min={0} max={1} step={0.05}
                      value={borrador.temperature}
                      onChange={(e) => setBorrador({ ...borrador, temperature: Number(e.target.value) })}
                      className="w-full accent-primary"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-0.5">
                    <span>Más determinista</span><span>Más expresivo</span>
                  </div>
                </div>
              </div>
            )}

            {pestana === 'voces' && (
              <div className="space-y-4">
                <div>
                  <p className="text-[13px] font-medium text-foreground mb-1.5">Idioma</p>
                  <select
                    value={borrador.language}
                    onChange={(e) => setBorrador({ ...borrador, language: e.target.value })}
                    className="w-full h-9 rounded-lg border border-border bg-card px-3 text-[13px] text-foreground"
                  >
                    <option value="es">Español</option>
                    <option value="en">English</option>
                    <option value="pt">Português</option>
                    <option value="fr">Français</option>
                  </select>
                </div>

                <SelectorIdiomasAgente agentId={agentId} />

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-xl border border-border bg-card p-3.5">
                    <span className="text-[13px] font-medium text-foreground">Estabilidad</span>
                    <div className="relative pt-6 mt-1">
                      <div
                        className="absolute -top-0.5 -translate-x-1/2 bg-foreground text-background text-[11.5px] font-semibold font-mono tabular-nums rounded-md px-2 py-0.5 pointer-events-none"
                        style={{ left: `${borrador.stability * 100}%` }}
                      >
                        {borrador.stability.toFixed(2)}
                      </div>
                      <input
                        type="range" min={0} max={1} step={0.05}
                        value={borrador.stability}
                        onChange={(e) => setBorrador({ ...borrador, stability: Number(e.target.value) })}
                        className="w-full accent-primary"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5">
                      <span>Más expresivo</span><span>Más consistente</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3.5">
                    <span className="text-[13px] font-medium text-foreground">Velocidad</span>
                    <div className="relative pt-6 mt-1">
                      <div
                        className="absolute -top-0.5 -translate-x-1/2 bg-foreground text-background text-[11.5px] font-semibold font-mono tabular-nums rounded-md px-2 py-0.5 pointer-events-none"
                        style={{ left: `${((borrador.speed - 0.7) / 0.5) * 100}%` }}
                      >
                        {borrador.speed.toFixed(2)}x
                      </div>
                      <input
                        type="range" min={0.7} max={1.2} step={0.01}
                        value={borrador.speed}
                        onChange={(e) => setBorrador({ ...borrador, speed: Number(e.target.value) })}
                        className="w-full accent-primary"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5">
                      <span>Más lento</span><span>Más rápido</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3.5">
                    <span className="text-[13px] font-medium text-foreground">Similitud</span>
                    <div className="relative pt-6 mt-1">
                      <div
                        className="absolute -top-0.5 -translate-x-1/2 bg-foreground text-background text-[11.5px] font-semibold font-mono tabular-nums rounded-md px-2 py-0.5 pointer-events-none"
                        style={{ left: `${borrador.similarity_boost * 100}%` }}
                      >
                        {borrador.similarity_boost.toFixed(2)}
                      </div>
                      <input
                        type="range" min={0} max={1} step={0.05}
                        value={borrador.similarity_boost}
                        onChange={(e) => setBorrador({ ...borrador, similarity_boost: Number(e.target.value) })}
                        className="w-full accent-primary"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5">
                      <span>Baja</span><span>Alta</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[13px] font-medium text-foreground">Voz — {vocesFiltradas.length}/{todasLasVoces.length || '…'} voces{misVoces.length > 0 ? `, ${misVoces.length} tuyas` : ''}</p>
                    <button
                      onClick={() => setModalClonarVozAbierto(true)}
                      className="flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-primary/40 text-primary hover:bg-primary/5 text-[11px] font-medium transition-colors"
                    >
                      <Mic className="w-3 h-3" /> Clonar mi voz
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="flex-1 flex items-center gap-1.5 h-8 rounded-lg border border-border bg-card px-2.5">
                      <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <input
                        value={busquedaVoz}
                        onChange={(e) => setBusquedaVoz(e.target.value)}
                        placeholder="Buscar por nombre o acento…"
                        className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground"
                      />
                    </div>
                    {(['todos', 'mias', 'female', 'male'] as const).map((g) => (
                      <button
                        key={g}
                        onClick={() => setFiltroGenero(g)}
                        className={`h-8 px-2.5 rounded-lg text-[11px] font-medium border transition-colors shrink-0 ${filtroGenero === g ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}
                      >
                        {g === 'todos' ? 'Todas' : g === 'mias' ? `Mis voces (${misVoces.length})` : g === 'female' ? 'Mujer' : 'Hombre'}
                      </button>
                    ))}
                  </div>
                  <div className="rounded-xl border border-border divide-y divide-border max-h-72 overflow-auto">
                    {vocesFiltradas.map((v) => (
                      <div
                        key={v.voice_id}
                        onClick={() => setBorrador({ ...borrador, voice_id: v.voice_id, voice_public_owner_id: v.public_owner_id })}
                        className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${borrador.voice_id === v.voice_id ? 'bg-primary/10' : 'hover:bg-muted'}`}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); reproducirPreview(v.voice_id, v.preview_url); }}
                          className="relative w-8 h-8 rounded-full shrink-0 overflow-hidden flex items-center justify-center"
                          style={{ background: `conic-gradient(from ${(v.voice_id.charCodeAt(0) * 37) % 360}deg, #1d4ed8, #38bdf8, #1d4ed8)` }}
                        >
                          <motion.div
                            animate={voceandoId === v.voice_id ? { rotate: 360 } : { rotate: 0 }}
                            transition={voceandoId === v.voice_id ? { duration: 2, repeat: Infinity, ease: 'linear' } : { duration: 0.3 }}
                            className="absolute inset-0"
                            style={{ background: `conic-gradient(from ${(v.voice_id.charCodeAt(1) * 53) % 360}deg, transparent, #ffffff30, transparent)` }}
                          />
                          <span className="relative z-10 text-white">
                            {voceandoId === v.voice_id ? <XCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                          </span>
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] text-foreground truncate">{nombreLimpio(v.name)}</p>
                          <p className="text-[10.5px] text-muted-foreground truncate">
                            {traducirGenero(v.gender)} · {traducirAcento(v.accent)}
                            {traducirDescriptor(v.name) && ` · ${traducirDescriptor(v.name)}`}
                          </p>
                        </div>
                        {borrador.voice_id === v.voice_id && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                      </div>
                    ))}
                    {vocesFiltradas.length === 0 && (
                      <p className="text-[12px] text-muted-foreground p-3">
                        {todasLasVoces.length === 0 ? 'No se pudo cargar el catálogo de voces.' : 'Sin resultados para ese filtro.'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-3.5">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="text-[13px] font-medium text-foreground">Sonido de fondo</p>
                      <p className="text-[11px] text-muted-foreground">Un ambiente de fondo real durante la llamada (opcional).</p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={!!borrador.background_sound_id}
                      onClick={() => setBorrador({ ...borrador, background_sound_id: borrador.background_sound_id ? null : 'restaurant' })}
                      className={`w-9 h-5 rounded-full shrink-0 transition-colors relative ${borrador.background_sound_id ? 'bg-primary' : 'bg-muted'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${borrador.background_sound_id ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  {borrador.background_sound_id && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <button
                          type="button"
                          onClick={() => setMostrarListaSonidos((v) => !v)}
                          className="w-full h-9 rounded-lg border border-border bg-background px-3 text-[13px] text-foreground flex items-center justify-between hover:bg-muted/40 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <span>{OPCIONES_SONIDO_FONDO.find((o) => o.id === borrador.background_sound_id)?.emoji}</span>
                            <span>{OPCIONES_SONIDO_FONDO.find((o) => o.id === borrador.background_sound_id)?.etiqueta ?? 'Elegir…'}</span>
                          </span>
                          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${mostrarListaSonidos ? 'rotate-180' : ''}`} />
                        </button>
                        {mostrarListaSonidos && (
                          <div className="mt-1.5 rounded-lg border border-border bg-card p-1">
                            {OPCIONES_SONIDO_FONDO.map((o) => (
                              <button
                                key={o.id}
                                type="button"
                                onClick={() => { setBorrador({ ...borrador, background_sound_id: o.id }); setMostrarListaSonidos(false); }}
                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-[13px] text-left transition-colors ${borrador.background_sound_id === o.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}
                              >
                                <span className="flex items-center gap-2 min-w-0"><span>{o.emoji}</span><span className="truncate">{o.etiqueta}</span></span>
                                {borrador.background_sound_id === o.id && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] text-muted-foreground">Volumen</span>
                          <span className="font-mono tabular-nums text-[11px] text-primary bg-primary/10 rounded-full px-2 py-0.5">{Math.round(borrador.background_sound_volume * 100)}%</span>
                        </div>
                        <input
                          type="range" min={0.01} max={1} step={0.01}
                          value={borrador.background_sound_volume}
                          onChange={(e) => setBorrador({ ...borrador, background_sound_volume: Number(e.target.value) })}
                          className="w-full accent-primary"
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={borrador.background_sound_crossfade} onCheckedChange={(v) => setBorrador({ ...borrador, background_sound_crossfade: v === true })} />
                        <span className="text-[12.5px] text-foreground">Bucle con fundido cruzado (evita chasquidos al repetirse)</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {pestana === 'mensaje' && (
              <div className="space-y-3">
                <div>
                  <p className="text-[13px] font-medium text-foreground mb-1.5">Primer mensaje</p>
                  <textarea
                    value={borrador.first_message}
                    onChange={(e) => setBorrador({ ...borrador, first_message: e.target.value })}
                    rows={2}
                    className="w-full rounded-xl border border-primary/40 p-3 text-[13px] text-foreground bg-transparent resize-none"
                  />
                  <div className="flex items-center justify-end gap-2 mt-1.5 flex-wrap">
                    <button
                      role="switch"
                      aria-checked={borrador.first_message_interruptible}
                      onClick={() => setBorrador({ ...borrador, first_message_interruptible: !borrador.first_message_interruptible })}
                      className={`w-8 h-[18px] rounded-full shrink-0 transition-colors relative ${borrador.first_message_interruptible ? 'bg-primary ring-2 ring-white shadow-[0_0_0_1px_hsl(var(--primary))]' : 'bg-muted'}`}
                    >
                      <span className={`absolute top-0.5 w-[14px] h-[14px] rounded-full bg-white transition-transform ${borrador.first_message_interruptible ? 'translate-x-[17px]' : 'translate-x-0.5'}`} />
                    </button>
                    <span className="flex items-center gap-1 shrink-0">
                      <span className="text-[11.5px] text-muted-foreground whitespace-nowrap">Interrumpible</span>
                      <UiTooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="text-muted-foreground/60 hover:text-foreground transition-colors"
                            aria-label="Qué significa interrumpible"
                          >
                            <Info className="w-3 h-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[260px] text-[12px] whitespace-normal">
                          Permitir a los usuarios interrumpir al agente mientras se entrega el primer mensaje.
                        </TooltipContent>
                      </UiTooltip>
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[13px] font-medium text-foreground">Mensaje del sistema</p>
                    <button
                      onClick={() => setMensajeSistemaAbierto(true)}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    <ModalFormularioLateral
                      open={mensajeSistemaAbierto}
                      onOpenChange={setMensajeSistemaAbierto}
                      icono={FileText}
                      titulo="Mensaje del sistema"
                      subtitulo="El prompt del agente de voz"
                      anchoClase="max-w-5xl"
                      altoMinimoClase="min-h-[70vh]"
                      footer={
                        <div className="w-full flex items-center justify-between gap-3">
                          <span className="text-[12px] text-muted-foreground">Escribe <code className="font-mono">{'{{'}</code> para añadir variables</span>
                          <div className="flex items-center gap-2">
                            <BotonZonaHoraria />
                            <Button
                              variant="outline"
                              className="rounded-full px-6"
                              onClick={() => setMensajeSistemaAbierto(false)}
                            >
                              Cerrar
                            </Button>
                          </div>
                        </div>
                      }
                    >
                      <div className="h-full flex flex-col rounded-xl border border-primary/40 overflow-hidden">
                        <textarea
                          value={borrador.prompt}
                          onChange={(e) => setBorrador({ ...borrador, prompt: e.target.value })}
                          className="flex-1 p-4 text-[13px] text-foreground bg-transparent resize-none leading-relaxed"
                        />
                      </div>
                    </ModalFormularioLateral>
                  </div>
                  <textarea
                    value={borrador.prompt}
                    onChange={(e) => setBorrador({ ...borrador, prompt: e.target.value })}
                    rows={8}
                    className="w-full rounded-xl border border-primary/40 p-3 text-[13px] text-foreground bg-transparent resize-none leading-relaxed"
                  />
                </div>
              </div>
            )}

            <AnimatePresence>
              {(hayCambios || guardadoOk) && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="sticky bottom-0 flex items-center justify-between gap-2 rounded-xl border border-border bg-card shadow-lg px-3.5 py-2.5"
                >
                  <span className="text-[12px] text-muted-foreground">
                    {guardadoOk ? '✓ Guardado — ya está aplicado en el agente real.' : errorConfig ?? 'Tienes cambios sin guardar.'}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {hayCambios && (
                      <button
                        onClick={() => setBorrador(config)}
                        className="h-8 px-3 rounded-full border border-border text-[12px] text-foreground hover:bg-muted transition-colors"
                      >
                        Cancelar
                      </button>
                    )}
                    {hayCambios && (
                      <button
                        onClick={guardarCambios}
                        disabled={guardando}
                        className="h-8 px-3.5 rounded-full bg-primary text-primary-foreground text-[12px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {guardando ? 'Guardando…' : 'Guardar cambios'}
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      )}
      <ModalClonarVoz restaurantId={restaurantId} open={modalClonarVozAbierto} onOpenChange={setModalClonarVozAbierto} onVozClonada={onVozClonada} />
    </div>
  );
}

// Pantalla completa de "Vista previa" del agente de voz — clon del layout
// real de ElevenLabs (orbe a la izquierda sobre el mismo fondo animado de
// "Chatea con tus datos" — CampoPixeles —, panel de conversación a la
// derecha), pero con nuestra tipografía/colores y sin las herramientas
// internas de ElevenLabs (Historial/Configuración de voz/Herramientas
// simuladas son de su dashboard, no algo que el cliente deba ver). El
// orbe es un video real generado con Higgsfield (public/media/orbe-agente.mp4),
// no una recreación en CSS. La transcripción es mejor esfuerzo: se lee el
// DOM real del widget (su shadow root) mientras la llamada está activa —
// conversationStarted/conversationEnded sí son eventos documentados; el
// contenido de los mensajes no lo es, así que puede fallar si ElevenLabs
// cambia su markup interno, y en ese caso simplemente no se llena — nunca
// se inventa una línea. El botón de abajo dispara la llamada REAL
// simulando el click dentro del shadow DOM del widget verdadero.
function VistaPreviaAgentePantallaCompleta({
  onCerrar,
  nombreAgente,
  nombreSucursal,
  agentId,
}: {
  onCerrar: () => void;
  nombreAgente: string;
  nombreSucursal: string;
  agentId: string | null;
}) {
  const [llamadaActiva, setLlamadaActiva] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [mensajes, setMensajes] = useState<{ texto: string; propio: boolean }[]>([]);
  const videoOrbeRef = useRef<HTMLVideoElement>(null);
  const conversacionRef = useRef<{ endSession: () => Promise<void> } | null>(null);
  const proteccionPreviewFallidaRef = useRef(false);

  // El video de 4s generado con Higgsfield no cierra en loop perfecto (se
  // nota el corte al reiniciar) — en vez de eso lo reproducimos como
  // "boomerang" (adelante hasta el final, luego hacia atrás hasta el
  // inicio, repite) manejando currentTime a mano vía rAF: nunca hay un
  // salto brusco porque siempre vuelve por donde ya pasó.
  useEffect(() => {
    const video = videoOrbeRef.current;
    if (!video) return;
    let direccion = 1;
    let raf: number;
    const paso = 1 / 30;
    const tick = () => {
      if (video.duration && !Number.isNaN(video.duration)) {
        let t = video.currentTime + direccion * paso;
        if (t >= video.duration) { direccion = -1; t = video.duration; }
        else if (t <= 0) { direccion = 1; t = 0; }
        video.currentTime = t;
      }
      raf = requestAnimationFrame(tick);
    };
    video.pause();
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Bug real confirmado 4-sep-2026: el agente saludaba con "Buenas tardes"
  // fijo (era el first_message estático del agente en ElevenLabs) sin
  // importar la hora real de la llamada. Ahora first_message usa la
  // plantilla "{{saludo}}, Los Taquitos de PM..." y esta función calcula el
  // saludo real con la hora de Mérida (America/Merida, UTC-6 todo el año)
  // para mandarlo como dynamic variable — mismo cálculo que
  // saludoSegunHoraMerida() en whatsapp-agent-core.ts, para que voz y chat
  // nunca queden desalineados.
  const saludoSegunHoraMerida = (): string => {
    const hora = Number(
      new Intl.DateTimeFormat("es-MX", { timeZone: "America/Merida", hour: "numeric", hourCycle: "h23" }).format(new Date()),
    );
    if (hora >= 5 && hora < 12) return "Buenos días";
    if (hora >= 12 && hora < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  // Llamada real vía el SDK oficial (@elevenlabs/client), no el widget
  // pre-armado — nos da control real de iniciar/terminar y transcripción
  // real por callback (onMessage), en vez de simular un click sobre un
  // botón que cambia de posición/función según el estado de la llamada
  // (eso era lo que se "atontaba" al intentar terminar la llamada).
  const alternarLlamadaReal = async () => {
    if (conversacionRef.current) {
      await conversacionRef.current.endSession();
      conversacionRef.current = null;
      setLlamadaActiva(false);
      return;
    }
    if (!agentId || conectando) return;
    setConectando(true);
    proteccionPreviewFallidaRef.current = false;
    try {
      // El SDK de voz es pesado y solo hace falta cuando el administrador
      // inicia una llamada de prueba; no debe penalizar la carga del panel.
      const { Conversation } = await import("@elevenlabs/client");
      const { data, error } = await supabase.functions.invoke('agent-config', {
        body: { action: 'signed_url', agent_id: agentId },
      });
      if (error || !data?.signed_url) throw error ?? new Error('Sin signed_url');

      const conversacion = await Conversation.startSession({
        signedUrl: data.signed_url,
        // Esta llamada sale del panel interno. La variable guía el diálogo,
        // pero la seguridad no depende de que el LLM la copie: onConnect
        // registra el conversation_id en una tabla service-role-only. Así
        // create-order simula únicamente sesiones autenticadas del panel.
        dynamicVariables: { modo_prueba: 'true', saludo: saludoSegunHoraMerida() },
        onConnect: ({ conversationId }) => {
          void supabase.functions.invoke('agent-config', {
            body: {
              action: 'mark_preview_conversation',
              agent_id: agentId,
              conversation_id: conversationId,
            },
          }).then(({ error: previewError }) => {
            if (previewError) {
              proteccionPreviewFallidaRef.current = true;
              console.error('No se pudo proteger la vista previa:', previewError);
              void conversacionRef.current?.endSession();
              setLlamadaActiva(false);
              return;
            }
            setLlamadaActiva(true);
          });
        },
        onDisconnect: () => { setLlamadaActiva(false); conversacionRef.current = null; },
        onMessage: ({ message, role }) => {
          setMensajes((prev) => [...prev, { texto: message, propio: role === 'user' }]);
        },
        onError: (msg) => console.error('Conversación ElevenLabs:', msg),
      });
      conversacionRef.current = conversacion;
      if (proteccionPreviewFallidaRef.current) {
        await conversacion.endSession();
        conversacionRef.current = null;
        throw new Error('No se pudo autorizar la vista previa de forma segura');
      }
      setMensajes([]);
    } catch (err) {
      console.error('No se pudo iniciar la llamada real:', err);
    } finally {
      setConectando(false);
    }
  };

  // Cuelga la llamada real si el usuario cierra la vista previa a medias.
  useEffect(() => {
    return () => { conversacionRef.current?.endSession(); };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 z-30 bg-background flex flex-col"
    >
      <header className="h-12 shrink-0 border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onCerrar}
            className="text-[13px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            ‹ Atrás
          </button>
          <span className="text-border shrink-0">|</span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground truncate">{nombreAgente}</p>
            <p className="text-[10.5px] text-muted-foreground truncate">{nombreSucursal}</p>
          </div>
        </div>
        <span className={`font-mono text-[10px] uppercase tracking-wide rounded-full px-2.5 py-1 shrink-0 border ${llamadaActiva ? 'text-primary border-primary/30 bg-primary/10' : 'text-muted-foreground border-border'}`}>
          {llamadaActiva ? '● Llamada en curso' : 'Vista previa'}
        </span>
      </header>

      <div className="flex-1 flex min-h-0">
        <div className="flex-[3] relative flex items-center justify-center overflow-hidden">
          <CampoPixeles />
          <button
            onClick={alternarLlamadaReal}
            title={llamadaActiva ? 'Terminar llamada' : 'Iniciar llamada'}
            className="relative w-56 h-56 rounded-full overflow-hidden shadow-[0_0_60px_-10px_rgba(29,78,216,0.5)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <video
              ref={videoOrbeRef}
              src="/media/orbe-agente.mp4"
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          </button>
        </div>

        <div className="flex-[2] border-l border-border flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-auto px-5 py-6">
            {mensajes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Mic className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
                </div>
                <p className="text-[13px] font-medium text-foreground mb-1">
                  {llamadaActiva ? 'Llamada iniciada' : 'Aún no hay una llamada activa'}
                </p>
                <p className="text-[11.5px] text-muted-foreground max-w-[220px] leading-snug">
                  {llamadaActiva ? 'Esperando el primer mensaje…' : 'Toca el orbe o el botón de abajo para iniciar una llamada real de prueba.'}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {mensajes.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-start gap-2.5 ${m.propio ? 'justify-end' : ''}`}
                  >
                    {!m.propio && <AtiendeMark className="w-5 h-5 shrink-0 mt-0.5" />}
                    <p className={`text-[14px] leading-relaxed max-w-[85%] ${m.propio ? 'text-right text-foreground' : 'text-foreground'}`}>
                      {i === mensajes.length - 1 ? <TextoEscribiendose texto={m.texto} /> : m.texto}
                    </p>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
          <div className="p-4 border-t border-border">
            <button
              onClick={alternarLlamadaReal}
              disabled={conectando || !agentId}
              className={`w-full flex items-center justify-center gap-2 h-10 rounded-full text-[13px] font-medium transition-colors disabled:opacity-50 ${
                llamadaActiva ? 'bg-destructive text-destructive-foreground hover:opacity-90' : 'bg-primary text-primary-foreground hover:opacity-90'
              }`}
            >
              {llamadaActiva ? <XCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
              {conectando ? 'Conectando…' : llamadaActiva ? 'Terminar llamada' : 'Iniciar llamada de prueba'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const AdminDashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [repartidores, setRepartidores] = useState<Repartidor[]>([]);
  const [callbackRequests, setCallbackRequests] = useState<CallbackRequest[]>([]);
  const [stats, setStats] = useState({
    revenue: 0,
    customers: 0,
    orders: 0,
    products: 0,
    users: 0
  });
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [cuentaModalOpen, setCuentaModalOpen] = useState(false);
  const [modalRepartidorAbierto, setModalRepartidorAbierto] = useState(false);
  const [categoriaExpandida, setCategoriaExpandida] = useState<string | null>(null);
  const [promoDialogOpen, setPromoDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promo | null>(null);
  const [promoForm, setPromoForm] = useState({
    title: "",
    description: "",
    image_url: "",
    discount_text: "",
    is_active: true
  });
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [selectedStat, setSelectedStat] = useState<'revenue' | 'customers' | 'orders' | 'products' | 'users' | null>(null);
  const [timePeriod, setTimePeriod] = useState<'day' | 'week' | 'month' | 'year'>('week');
  const [activeSection, setActiveSection] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<'today' | '7' | '30' | '90' | '180' | '365' | 'historico'>('today');
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  // La campana y las siete pestañas comparten el mismo contador persistente
  // en Postgres. Abrir la sección ya no borra todo por timestamp: únicamente
  // baja lo que el usuario abrió o marcó explícitamente como leído.
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const refrescarContadorNotificaciones = useCallback(async () => {
    if (!restaurantId || !user?.id) {
      setNotificationUnreadCount(0);
      return;
    }
    const sb: any = supabase;
    const { data, error } = await sb.rpc("notification_unread_count", { p_restaurant_id: restaurantId });
    if (error) {
      console.error("No se pudo actualizar la campana de notificaciones:", error);
      return;
    }
    setNotificationUnreadCount(Number(data) || 0);
  }, [restaurantId, user?.id]);

  useEffect(() => {
    void refrescarContadorNotificaciones();
    if (!restaurantId || !user?.id) return;

    const alLeer = () => { void refrescarContadorNotificaciones(); };
    window.addEventListener("atiende:notifications-read", alLeer);
    window.addEventListener("atiende:notifications-changed", alLeer);

    const canal = supabase
      .channel(`notification-bell-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` }, alLeer)
      .on("postgres_changes", { event: "*", schema: "public", table: "callback_requests", filter: `restaurant_id=eq.${restaurantId}` }, alLeer)
      .on("postgres_changes", { event: "*", schema: "public", table: "notification_reads", filter: `restaurant_id=eq.${restaurantId}` }, alLeer)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "restaurant_staff", filter: `user_id=eq.${user.id}` }, alLeer)
      .subscribe();

    return () => {
      window.removeEventListener("atiende:notifications-read", alLeer);
      window.removeEventListener("atiende:notifications-changed", alLeer);
      void supabase.removeChannel(canal);
    };
  }, [restaurantId, user?.id, refrescarContadorNotificaciones]);

  // Toast real de "Pedido nuevo": bug real reportado por Javier el 3-sep-2026
  // ("se hizo todo bien en la llamada, únicamente no me llegó la
  // notificación cuando se hizo el pedido en el dashboard inicial, pero sí
  // salía en la página de notificaciones") — esta suscripción vivía SOLO
  // dentro de PedidosSection (ver ese archivo), que solo está montado
  // cuando activeSection === 'orders'. Si el admin estaba en cualquier otra
  // sección (el dashboard inicial, en este caso) cuando llegó el pedido real
  // de la llamada, no había ningún componente montado escuchando el INSERT,
  // así que el toast nunca se disparaba — aunque el pedido sí quedaba
  // guardado y por eso sí aparecía al entrar a Notificaciones (esa sección
  // hace su propio fetch, no depende de este toast). Se sube aquí, al
  // componente raíz que está montado sin importar la sección activa.
  useEffect(() => {
    const canal = supabase
      .channel(`pedido-nuevo-toast-${restaurantId ?? "todos"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          ...(restaurantId ? { filter: `restaurant_id=eq.${restaurantId}` } : {}),
        },
        (payload) => {
          const nuevo = payload.new as { customer_name: string; total: number; source: string; customer_phone?: string };
          if (String(nuevo.customer_phone ?? "").startsWith("widget-")) return;
          toast({
            title: "Pedido nuevo",
            description: `${nuevo.customer_name} — $${Number(nuevo.total).toFixed(0)} (${nuevo.source === "voice" ? "llamada" : nuevo.source === "whatsapp" ? "WhatsApp" : nuevo.source})`,
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  // Campanita en vivo: bug real reportado por Javier el 4-sep-2026 ("que
  // este se actualice conforme salen las notificaciones y se acumulan, y
  // conforme se leen se borren") — `callbackRequests` (lo que cuenta el
  // badge de la campanita) solo se traía una vez dentro de fetchData(), sin
  // ninguna suscripción real: una notificación nueva no aparecía en el
  // badge hasta el siguiente refresh completo, y marcar una como atendida
  // desde Notificaciones (que tiene su PROPIO fetch/estado local, separado
  // de este) tampoco se reflejaba aquí hasta ese mismo refresh. Suscripción
  // real a INSERT/UPDATE de `callback_requests`: el badge sube solo al
  // llegar una nueva, y baja solo en cuanto se marca resuelta desde
  // cualquier lado (el filtro `!c.resolved` que ya arma el badge hace el
  // resto).
  useEffect(() => {
    const canal = supabase
      .channel(`callback-requests-live-${restaurantId ?? "todos"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "callback_requests",
          ...(restaurantId ? { filter: `restaurant_id=eq.${restaurantId}` } : {}),
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const eliminado = payload.old as { id: string };
            setCallbackRequests((prev) => prev.filter((c) => c.id !== eliminado.id));
            return;
          }
          const fila = payload.new as CallbackRequest;
          setCallbackRequests((prev) => {
            const existe = prev.some((c) => c.id === fila.id);
            if (existe) return prev.map((c) => (c.id === fila.id ? fila : c));
            return [fila, ...prev];
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  // filteredStats/salesTrendData ("Tus ventas" y "Tendencias" de
  // Estadísticas) — antes eran useMemo derivados de `orders` completo, pero
  // `orders` viene de un fetch con `.limit(50000)` que en la práctica NUNCA
  // trae más de 1000 filas: el proyecto de Supabase topa cada respuesta de
  // la API de datos en 1000 filas sin importar el `.limit()` que pida el
  // cliente (confirmado en vivo — ver migración
  // orders_bucketed_stats_rpc.sql). Con ~1000 pedidos/día de volumen real
  // de demo, cualquier ventana de más de un día llegaba truncada a los
  // pedidos más recientes, y casi todos los tramos de la gráfica (y el
  // periodo completo de "Tus ventas" para 7/30/90/180/365/histórico)
  // sumaban sobre filas que nunca llegaron — de ahí el $0/0 en casi todos
  // los puntos aunque sí había pedidos reales. Ahora se agregan en
  // Postgres vía RPC (orders_bucketed_stats): se manda un puñado de tramos
  // de fecha y se recibe un renglón sumado por tramo, muy por debajo del
  // límite de 1000 sin importar cuántos pedidos reales haya. Se recalculan
  // dentro de fetchData (mismo disparador que ya refresca `orders`), no
  // con un useMemo sincrónico.
  const [filteredStats, setFilteredStats] = useState({
    revenue: 0,
    orders: 0,
    customers: 0,
    averageOrder: 0,
    revenueChange: 0,
    ordersChange: 0,
    customersChange: 0,
    avgOrderChange: 0,
  });
  const [salesTrendData, setSalesTrendData] = useState<{ name: string; ventas: number; ordenes: number }[]>([]);

  // Datos reales de los agentes (voz/WhatsApp) — se cargan aparte de
  // fetchData() porque necesitan conteos exactos (no el límite de 50 filas
  // que usa el `orders` del dashboard) y, para WhatsApp, la tabla
  // `whatsapp_conversations`, que no tiene restaurant_id directo (se
  // resuelve vía las sucursales del restaurante).
  const [cargandoAgentes, setCargandoAgentes] = useState(false);
  const [statsAgentes, setStatsAgentes] = useState<{
    totalOrdenes: number;
    ingresoTotal: number;
    voz: { total: number; completados: number; cancelados: number; ingreso: number };
    whatsapp: { total: number; completados: number; cancelados: number; ingreso: number };
  } | null>(null);
  const [ordenesVoz, setOrdenesVoz] = useState<Order[]>([]);
  const [ordenesWhatsapp, setOrdenesWhatsapp] = useState<Order[]>([]);
  const [conversacionesWhatsapp, setConversacionesWhatsapp] = useState<{
    total: number;
    conPedido: number;
    promedioMensajes: number;
  } | null>(null);

  // Selector de sucursal del encabezado de Agente de voz/WhatsApp — "global"
  // ve todo el restaurante, o se puede acotar a una sucursal puntual. El
  // agente de voz real (ElevenLabs) vive por sucursal, no por restaurante:
  // solo la sucursal que de verdad tiene uno configurado
  // (branches.elevenlabs_agent_id) muestra el globo del widget.
  const [sucursalesAgente, setSucursalesAgente] = useState<{ id: string; name: string; elevenlabs_agent_id: string | null }[]>([]);
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState<string>('global');
  const [mostrarSelectorSucursal, setMostrarSelectorSucursal] = useState(false);
  // Mismo selector, pero para el encabezado de Agente de WhatsApp — filtro
  // independiente del de voz, reutilizando la misma lista de sucursales
  // (branches del restaurante, no específica de un canal).
  const [sucursalSeleccionadaWhatsapp, setSucursalSeleccionadaWhatsapp] = useState<string>('global');
  const [mostrarSelectorSucursalWhatsapp, setMostrarSelectorSucursalWhatsapp] = useState(false);
  // "Vista previa" sólo se ve azul/activo mientras la pantalla completa
  // propia está abierta — el resto del tiempo es un botón neutro más.
  const [vistaPreviaActiva, setVistaPreviaActiva] = useState(false);

  // Rango de fecha del "Llamadas recientes" de Agente de voz — presets +
  // rango personalizado con calendario real, mismo esqueleto que el
  // selector de ElevenLabs. Filtra la lista ya cargada (client-side); no
  // vuelve a pedir a Supabase, así que no depende de la función de borde
  // pendiente de ElevenLabs para ser real y funcional.
  const PRESETS_RANGO_AGENTE = [
    { id: '24h', etiqueta: 'Últimas 24 horas', dias: 1 },
    { id: '7d', etiqueta: 'Últimos 7 días', dias: 7 },
    { id: '30d', etiqueta: 'Últimos 30 días', dias: 30 },
    { id: '90d', etiqueta: 'Últimos 90 días', dias: 90 },
  ] as const;
  const [presetRangoAgente, setPresetRangoAgente] = useState<string>('7d');
  const [rangoAgenteBorrador, setRangoAgenteBorrador] = useState<DateRange | undefined>(undefined);
  const [rangoAgenteAplicado, setRangoAgenteAplicado] = useState<DateRange | undefined>(undefined);
  const [mostrarSelectorRango, setMostrarSelectorRango] = useState(false);

  const rangoAgenteActivo: DateRange = rangoAgenteAplicado ?? (() => {
    const preset = PRESETS_RANGO_AGENTE.find((p) => p.id === presetRangoAgente) ?? PRESETS_RANGO_AGENTE[1];
    const hasta = new Date();
    const desde = subDays(hasta, preset.dias);
    return { from: desde, to: hasta };
  })();
  const etiquetaRangoAgente = rangoAgenteAplicado
    ? `${format(rangoAgenteAplicado.from ?? new Date(), 'd MMM', { locale: es })} – ${format(rangoAgenteAplicado.to ?? new Date(), 'd MMM yyyy', { locale: es })}`
    : (PRESETS_RANGO_AGENTE.find((p) => p.id === presetRangoAgente)?.etiqueta ?? 'Últimos 7 días');

  // Sucursal con agente real: la seleccionada si tiene uno, o la primera
  // que sí tenga cuando el filtro está en "global".
  const sucursalConAgente = sucursalSeleccionada === 'global'
    ? sucursalesAgente.find((s) => s.elevenlabs_agent_id)
    : sucursalesAgente.find((s) => s.id === sucursalSeleccionada);
  const agentIdActivo = sucursalConAgente?.elevenlabs_agent_id ?? null;

  // El widget REAL de ElevenLabs (el mismo componente que usan ellos, no
  // una recreación) — su propio globo flotante siempre está ahí en la
  // página del agente, sin que haya que apretar un botón aparte; al
  // apretarlo, ellos mismos abren su panel lateral con la animación del
  // orbe y el botón de pantalla completa nativos.
  useEffect(() => {
    if (activeSection !== 'agente-voz' || !agentIdActivo) return;
    if (document.getElementById('elevenlabs-convai-script')) return;
    const script = document.createElement('script');
    script.id = 'elevenlabs-convai-script';
    script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
    script.async = true;
    document.body.appendChild(script);
  }, [activeSection, agentIdActivo]);

  // El color del botón ("Iniciar llamada") del widget real sólo se puede
  // fijar desde el dashboard de ElevenLabs (Agente → Widget) o su API —
  // no hay atributo HTML para eso (verificado en su documentación).
  // Mientras Javier no lo cambie ahí, lo forzamos aquí pintando directo el
  // botón real dentro del shadow DOM del widget (no una recreación: es el
  // mismo <button> que ellos renderizan). Un MutationObserver lo re-aplica
  // cada vez que el widget re-renderiza su propio DOM interno.
  useEffect(() => {
    if (activeSection !== 'agente-voz' || !agentIdActivo) return;
    let observer: MutationObserver | null = null;
    let cancelado = false;
    const pintarBotonNegro = (root: ShadowRoot) => {
      root.querySelectorAll('button').forEach((btn) => {
        const el = btn as HTMLElement;
        const bg = getComputedStyle(el).backgroundColor;
        const canal = bg.match(/\d+/g)?.map(Number);
        if (canal && canal[0] < 40 && canal[1] < 40 && canal[2] < 40) {
          el.style.setProperty('background-color', '#1d4ed8', 'important');
        }
      });
    };
    const intentar = (reintento = 0) => {
      if (cancelado) return;
      const widget = document.querySelector('elevenlabs-convai') as (HTMLElement & { shadowRoot?: ShadowRoot | null }) | null;
      const root = widget?.shadowRoot;
      if (!root) {
        if (reintento < 20) setTimeout(() => intentar(reintento + 1), 300);
        return;
      }
      pintarBotonNegro(root);
      observer = new MutationObserver(() => pintarBotonNegro(root));
      observer.observe(root, { childList: true, subtree: true });
    };
    intentar();
    return () => {
      cancelado = true;
      observer?.disconnect();
    };
  }, [activeSection, agentIdActivo]);

  const cargarDatosAgentes = async (branchId?: string, branchIdWhatsapp?: string) => {
    if (!restaurantId) return;
    setCargandoAgentes(true);
    // try/finally: sin esto, cualquier falla real de red en el Promise.all
    // de abajo (no un error devuelto por Supabase, sino la promesa
    // rechazándose) dejaba `cargandoAgentes` en true para siempre — las
    // pantallas de Agente de voz/WhatsApp se quedaban pasmadas en el
    // spinner, incluso con el refresco automático de 45s corriendo (una
    // llamada fallida deja el flag en true; las siguientes vuelven a
    // ponerlo en true al iniciar, así que nunca se despega).
    try {
      const sb: any = supabase;
      const filtroSucursal = branchId && branchId !== 'global' ? { branch_id: branchId } : null;
      const conFiltro = (q: any) => (filtroSucursal ? q.eq('branch_id', filtroSucursal.branch_id) : q);
      // Filtro independiente para el encabezado de Agente de WhatsApp — su
      // propio selector de sucursal, sin depender del de voz.
      const filtroSucursalWhatsapp = branchIdWhatsapp && branchIdWhatsapp !== 'global' ? { branch_id: branchIdWhatsapp } : null;
      const conFiltroWhatsapp = (q: any) => (filtroSucursalWhatsapp ? q.eq('branch_id', filtroSucursalWhatsapp.branch_id) : q);

      const voiceBranchId = filtroSucursal?.branch_id ?? null;
      const whatsappBranchId = filtroSucursalWhatsapp?.branch_id ?? null;
      const [
        { data: voiceStatsRows, error: voiceStatsError },
        { data: whatsappStatsRows, error: whatsappStatsError },
        { data: conversationStatsRows, error: conversationStatsError },
        { data: vozRecientes },
        { data: waRecientes },
        { data: sucursales },
      ] = await Promise.all([
        sb.rpc("orders_channel_stats", { p_restaurant_id: restaurantId, p_branch_id: voiceBranchId }),
        sb.rpc("orders_channel_stats", { p_restaurant_id: restaurantId, p_branch_id: whatsappBranchId }),
        sb.rpc("whatsapp_conversation_stats", { p_restaurant_id: restaurantId, p_branch_id: whatsappBranchId }),
        conFiltro(sb.from("orders").select("*").eq("restaurant_id", restaurantId).eq("source", "voice").order("created_at", { ascending: false }).limit(8)),
        conFiltroWhatsapp(sb.from("orders").select("*").eq("restaurant_id", restaurantId).eq("source", "whatsapp").order("created_at", { ascending: false }).limit(8)),
        sb.from("branches").select("id, name, elevenlabs_agent_id").eq("restaurant_id", restaurantId).order("display_order"),
      ]);

      if (voiceStatsError || whatsappStatsError || conversationStatsError) {
        throw voiceStatsError ?? whatsappStatsError ?? conversationStatsError;
      }

      setSucursalesAgente(sucursales ?? []);
      const voiceStats = voiceStatsRows?.[0];
      const whatsappStats = whatsappStatsRows?.[0];
      const conversationStats = conversationStatsRows?.[0];

      setStatsAgentes({
        totalOrdenes: Number(voiceStats?.total_orders ?? 0),
        ingresoTotal: Number(voiceStats?.total_revenue ?? 0),
        voz: {
          total: Number(voiceStats?.voice_orders ?? 0),
          completados: Number(voiceStats?.voice_completed ?? 0),
          cancelados: Number(voiceStats?.voice_cancelled ?? 0),
          ingreso: Number(voiceStats?.voice_revenue ?? 0),
        },
        whatsapp: {
          total: Number(whatsappStats?.whatsapp_orders ?? 0),
          completados: Number(whatsappStats?.whatsapp_completed ?? 0),
          cancelados: Number(whatsappStats?.whatsapp_cancelled ?? 0),
          ingreso: Number(whatsappStats?.whatsapp_revenue ?? 0),
        },
      });
      setOrdenesVoz(vozRecientes ?? []);
      setOrdenesWhatsapp(waRecientes ?? []);
      setConversacionesWhatsapp({
        total: Number(conversationStats?.total ?? 0),
        conPedido: Number(conversationStats?.with_order ?? 0),
        promedioMensajes: Number(conversationStats?.average_messages ?? 0),
      });
    } catch (err) {
      console.error("No se pudieron cargar los datos de agentes:", err);
    } finally {
      setCargandoAgentes(false);
    }
  };

  // "Vista previa" abre nuestra propia pantalla completa (clon del layout
  // de ElevenLabs, con nuestro diseño) — el widget real sigue viviendo
  // aparte como su burbuja flotante nativa, sin tocarla desde aquí.
  const abrirVistaPreviaAgente = () => {
    setVistaPreviaActiva(true);
  };

  // Se refresca sola cada 45s mientras el usuario está en cualquier página
  // de agentes — sin botón "Actualizar" manual (pedido explícito de Javier).
  useEffect(() => {
    if (activeSection !== 'agente-voz') setVistaPreviaActiva(false);
  }, [activeSection]);

  useEffect(() => {
    const seccionesConAgentes = ['agente-voz', 'agente-whatsapp', 'agente-voz-dashboard', 'agente-whatsapp-dashboard', 'dashboard'];
    if (!seccionesConAgentes.includes(activeSection) || !restaurantId) return;
    cargarDatosAgentes(sucursalSeleccionada, sucursalSeleccionadaWhatsapp);
    const intervalo = setInterval(() => cargarDatosAgentes(sucursalSeleccionada, sucursalSeleccionadaWhatsapp), 45000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, restaurantId, sucursalSeleccionada, sucursalSeleccionadaWhatsapp]);
  const [pregunta, setPregunta] = useState("");
  const [nombreAdmin, setNombreAdmin] = useState('');
  const [refrescando, setRefrescando] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date>(new Date());
  const [mensajesChat, setMensajesChat] = useState<{ rol: 'usuario' | 'asistente'; texto: string; pedidos?: Order[]; mostrarGrafica?: boolean }[]>([]);
  const [pensando, setPensando] = useState(false);
  const [fasePensando, setFasePensando] = useState('');
  const [historialPreguntas, setHistorialPreguntas] = useState<string[]>([]);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [busquedaHistorial, setBusquedaHistorial] = useState('');
  const [archivoAdjunto, setArchivoAdjunto] = useState<File | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const {
    toast
  } = useToast();

  // Handle navigation state to open specific section/dialog
  useEffect(() => {
    const state = location.state as { openSection?: string; openDialog?: boolean } | null;
    if (state?.openSection && !loading) {
      setActiveSection(state.openSection);
      if (state.openDialog) {
        if (state.openSection === 'products') {
          setEditingProduct(null);
          setProductDialogOpen(true);
        } else if (state.openSection === 'promos') {
          setEditingPromo(null);
          setPromoForm({ title: '', description: '', image_url: '', discount_text: '', is_active: true });
          setPromoDialogOpen(true);
        }
      }
      // Clear the state to prevent re-opening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state, loading]);
  useEffect(() => {
    const checkAuth = async () => {
      // try/finally alrededor de todo lo que sigue al chequeo de sesión: sin
      // esto, cualquier falla real de red en cualquiera de estos awaits (no
      // un error devuelto por Supabase, sino la promesa rechazándose) dejaba
      // `loading` en true para siempre — el panel entero se quedaba pasmado
      // en el spinner de pantalla completa (`if (loading) { ... }` más abajo)
      // sin importar cuántas veces se recargara. Mismo patrón de bug que
      // Sucursales/Voces e idiomas, aquí a escala de todo el dashboard.
      try {
        const {
          data: {
            session
          }
        } = await supabase.auth.getSession();
        if (!session) {
          navigate("/admin/login");
          return;
        }

        const [{ data: platformRoles, error: rolesError }, {
          data: memberships,
          error: membershipsError,
        }] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", session.user.id),
          supabase.from("restaurant_staff").select("restaurant_id, role").eq("user_id", session.user.id),
        ]);
        if (rolesError || membershipsError) throw rolesError ?? membershipsError;
        const isSuperadmin = (platformRoles ?? []).some((row) => row.role === "superadmin");
        const managedMembership = (memberships ?? []).find((row) =>
          row.role === "owner" || row.role === "admin" || row.role === "staff"
        );
        if (!isSuperadmin && !managedMembership) {
          navigate("/admin/login");
          return;
        }
        setUser(session.user);
        supabase.from("profiles").select("nombre").eq("user_id", session.user.id).maybeSingle()
          .then(({ data: profile }) => {
            setNombreAdmin(profile?.nombre || (session.user.email ?? "").split("@")[0]);
          }, (err: unknown) => console.error("No se pudo leer el nombre del admin:", err));

        // Un superadmin llega aquí con "?restaurante=<id>" desde "Ver cuenta"
        // en su panel — ve esa cuenta puntual. Sin ese parámetro, se resuelve
        // el restaurante propio desde restaurant_staff (dueño/staff normal).
        const paramRestaurantId = isSuperadmin
          ? searchParams.get("restaurante")
          : null;
        const effectiveRestaurantId = paramRestaurantId ??
          managedMembership?.restaurant_id ?? null;
        setRestaurantId(effectiveRestaurantId);
        if (effectiveRestaurantId) {
          const { data: r } = await supabase.from("restaurants").select("name").eq("id", effectiveRestaurantId).maybeSingle();
          setRestaurantName(r?.name ?? null);
        }

        await fetchData(effectiveRestaurantId);
      } catch (err) {
        console.error("No se pudo cargar el panel de administración:", err);
        toast({
          title: "No se pudo cargar el panel",
          description: "Ocurrió un problema de conexión. Intenta recargar la página.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/admin/login");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Se refresca cada 60s mientras se ve el dashboard, además del refresco
  // manual — el botón bajo "Actualizado" refleja el estado real de la
  // recarga (no es decorativo).
  //
  // Bug real confirmado 4-sep-2026: Javier hizo unas llamadas de prueba
  // reales desde "Agente de voz" (3 pedidos reales, $1,441) y al volver a
  // "dashboard" seguía viendo $0/0 órdenes — el efecto de abajo SOLO
  // arrancaba el temporizador de 60s al entrar a la sección, nunca refrescaba
  // de inmediato, así que si no se quedaba parado en "dashboard" un minuto
  // completo sin cambiar de sección, nunca veía datos nuevos. Ahora refresca
  // YA al entrar a la sección (o al resolverse restaurantId), y de ahí en
  // adelante cada 60s como antes.
  useEffect(() => {
    if (activeSection !== 'dashboard' || !restaurantId) return;
    refrescarDatos();
    const intervalo = setInterval(() => {
      refrescarDatos();
    }, 60000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, restaurantId]);

  // Vuelve a pedir `orders` con la ventana de fecha correcta cada vez que
  // Javier cambia el pill de periodo en Estadísticas (Hoy/7 días/1 mes/...) —
  // fetchData ya arma el WHERE created_at real según dateFilter (ver
  // ordersQuery más abajo), así que solo hace falta dispararlo de nuevo.
  useEffect(() => {
    if (!loading) fetchData(restaurantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  const refrescarDatos = async () => {
    setRefrescando(true);
    // try/finally: si fetchData truena de verdad (red), sin esto
    // `refrescando` se quedaba en true para siempre — el botón de refresco
    // bajo "Actualizado" se quedaba girando sin parar.
    try {
      await fetchData(restaurantId);
      setUltimaActualizacion(new Date());
    } catch (err) {
      console.error("No se pudo refrescar el dashboard:", err);
    } finally {
      setRefrescando(false);
    }
  };

  const saludoHorario = () => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Buenos días';
    if (hora < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };
  const nombreSaludo = nombreAdmin.split(' ').slice(0, 2).join(' ');

  // Tramos [inicio, fin) de cada barra de "Tendencias" para el dateFilter
  // activo — mismos periodos que antes (24 horas / 7-30 días / 13-26
  // semanas / 12 meses), pero como límites reales de fecha en vez de un
  // predicado que se evaluaba pedido por pedido en el navegador. `fin`
  // exclusivo en todos los casos (equivalente a la igualdad de
  // hora/día/mes de antes salvo por una diferencia de microsegundos en el
  // borde, que nunca importa con timestamps reales).
  const construirTramosTendencia = (
    filtro: typeof dateFilter,
    ahora: Date,
    primerPedidoEn: Date | null
  ): { inicio: Date; fin: Date; etiqueta: string }[] => {
    const tramos: { inicio: Date; fin: Date; etiqueta: string }[] = [];
    switch (filtro) {
      case 'today': {
        // Solo horas abiertas (no las 24) — de lo contrario medianoche-6am
        // sale siempre en cero y aplasta la gráfica real de mediodía/noche.
        // Ventana amplia que cubre comida (13-16h) y cena (19-22h) con
        // margen real de antes/después del servicio: 11:00 a 23:00.
        const HORA_APERTURA = 11;
        const HORA_CIERRE = 23;
        for (let h = HORA_APERTURA; h <= HORA_CIERRE; h++) {
          const inicio = startOfDay(ahora);
          inicio.setHours(h, 0, 0, 0);
          const fin = new Date(inicio.getTime() + 60 * 60 * 1000);
          tramos.push({ inicio, fin, etiqueta: format(inicio, 'HH:00', { locale: es }) });
        }
        break;
      }
      case '7': {
        for (let i = 6; i >= 0; i--) {
          const inicio = startOfDay(subDays(ahora, i));
          const fin = subDays(inicio, -1);
          tramos.push({ inicio, fin, etiqueta: format(inicio, 'EEE', { locale: es }) });
        }
        break;
      }
      case '30': {
        // Un punto cada 3 días (10 tramos) en vez de uno por día — como
        // antes, para que la gráfica del mes no quede saturada de puntos.
        for (let i = 27; i >= 0; i -= 3) {
          const inicio = startOfDay(subDays(ahora, i));
          const fin = subDays(inicio, -3);
          tramos.push({ inicio, fin, etiqueta: format(inicio, 'dd MMM', { locale: es }) });
        }
        break;
      }
      case '90':
      case '180': {
        if (filtro === '90') {
          for (let i = 89; i >= 0; i -= 7) {
            const inicio = startOfDay(subDays(ahora, i));
            const fin = subDays(inicio, -7);
            tramos.push({ inicio, fin, etiqueta: format(inicio, 'dd MMM', { locale: es }) });
          }
        } else {
          for (let i = 25; i >= 0; i--) {
            const inicio = startOfDay(subDays(ahora, i * 7));
            const fin = subDays(inicio, -7);
            tramos.push({ inicio, fin, etiqueta: format(inicio, 'dd MMM', { locale: es }) });
          }
        }
        break;
      }
      case '365': {
        for (let i = 11; i >= 0; i--) {
          const inicio = startOfMonth(subMonths(ahora, i));
          const fin = subMonths(inicio, -1);
          tramos.push({ inicio, fin, etiqueta: format(inicio, 'MMM yy', { locale: es }) });
        }
        break;
      }
      case 'historico':
      default: {
        // Granularidad adaptable según cuánta historia real hay —
        // `primerPedidoEn` viene de una consulta aparte que solo pide
        // MIN(created_at) (a diferencia de antes, que lo sacaba del propio
        // array `orders` ya truncado a 1000 filas). Poco histórico (≤12
        // meses) → un punto por mes, para no dejar la gráfica con 2-3
        // puntos nada más. Histórico medio (12-36 meses) → un punto cada 3
        // meses. Histórico largo (>36 meses, varios años operando) → un
        // punto por año, sin tope — a diferencia de antes, que cortaba
        // duro en 36 meses y perdía historia real más vieja.
        const inicioReal = primerPedidoEn ?? ahora;
        const mesesDesdeInicio = Math.max(
          0,
          (ahora.getFullYear() - inicioReal.getFullYear()) * 12 + (ahora.getMonth() - inicioReal.getMonth())
        );
        if (mesesDesdeInicio <= 12) {
          for (let i = mesesDesdeInicio; i >= 0; i--) {
            const inicio = startOfMonth(subMonths(ahora, i));
            const fin = subMonths(inicio, -1);
            tramos.push({ inicio, fin, etiqueta: format(inicio, 'MMM yy', { locale: es }) });
          }
        } else if (mesesDesdeInicio <= 36) {
          for (let i = mesesDesdeInicio; i >= 0; i -= 3) {
            const inicio = startOfMonth(subMonths(ahora, i));
            const fin = subMonths(inicio, -3);
            tramos.push({ inicio, fin, etiqueta: format(inicio, 'MMM yy', { locale: es }) });
          }
        } else {
          const añosDesdeInicio = Math.ceil(mesesDesdeInicio / 12);
          for (let i = añosDesdeInicio; i >= 0; i--) {
            const inicio = startOfMonth(subMonths(ahora, i * 12));
            const fin = subMonths(inicio, -12);
            tramos.push({ inicio, fin, etiqueta: format(inicio, 'yyyy', { locale: es }) });
          }
        }
        break;
      }
    }
    return tramos;
  };

  // Periodo actual y periodo anterior (para las notas "+X% vs ayer/7 días
  // anteriores/…" de las tarjetas de "Tus ventas") — mismos rangos que
  // antes. `fin` muy en el futuro para el periodo actual: cubre cualquier
  // pedido real, incluidos los que el sembrado de demo dejó con
  // created_at unos minutos/horas adelantado por el desfase de zona
  // horaria (se guardó hora local de Mérida como si ya fuera UTC).
  // Postgres timestamptz no acepta el año +275760 del máximo Date de JS.
  // Año 9999 cubre holgadamente cualquier pedido y es portable en la RPC.
  const MUY_FUTURO = new Date("9999-12-31T23:59:59.999Z");
  const EPOCA = new Date(0);
  const construirPeriodosComparacion = (filtro: typeof dateFilter, ahora: Date) => {
    switch (filtro) {
      case 'today': {
        const hoy = startOfDay(ahora);
        return { actual: { inicio: hoy, fin: MUY_FUTURO }, previo: { inicio: subDays(hoy, 1), fin: hoy } };
      }
      case '7':
        return { actual: { inicio: subDays(ahora, 7), fin: MUY_FUTURO }, previo: { inicio: subDays(ahora, 14), fin: subDays(ahora, 7) } };
      case '30':
        return { actual: { inicio: subDays(ahora, 30), fin: MUY_FUTURO }, previo: { inicio: subDays(ahora, 60), fin: subDays(ahora, 30) } };
      case '90':
        return { actual: { inicio: subDays(ahora, 90), fin: MUY_FUTURO }, previo: { inicio: subDays(ahora, 180), fin: subDays(ahora, 90) } };
      case '180':
        return { actual: { inicio: subDays(ahora, 180), fin: MUY_FUTURO }, previo: { inicio: subDays(ahora, 360), fin: subDays(ahora, 180) } };
      case '365':
        return { actual: { inicio: subDays(ahora, 365), fin: MUY_FUTURO }, previo: { inicio: subDays(ahora, 730), fin: subDays(ahora, 365) } };
      case 'historico':
      default:
        // Histórico es un total, no una ventana con antes/después.
        return { actual: { inicio: EPOCA, fin: MUY_FUTURO }, previo: null as { inicio: Date; fin: Date } | null };
    }
  };

  // Pide a Postgres (orders_bucketed_stats) la suma/conteo por tramo de
  // fecha para "Tus ventas" y "Tendencias" — reemplaza sumar en el
  // navegador sobre `orders`, que llega truncado a 1000 filas por el
  // límite real de la API (ver comentario junto al useState de
  // filteredStats/salesTrendData). Se llama desde fetchData, con el mismo
  // disparador (carga inicial, refresco de 60s, cambio de dateFilter,
  // refresco manual) que ya traía `orders`.
  const actualizarEstadisticasYTendencia = async (scopedRestaurantId: string | null, filtro: typeof dateFilter) => {
    const sb: any = supabase;
    const ahora = new Date();

    let primerPedidoEn: Date | null = null;
    if (filtro === 'historico') {
      const q = scopedRestaurantId
        ? sb.from("orders").select("created_at").eq("restaurant_id", scopedRestaurantId).order("created_at", { ascending: true }).limit(1)
        : sb.from("orders").select("created_at").order("created_at", { ascending: true }).limit(1);
      const { data } = await q;
      primerPedidoEn = data?.[0]?.created_at ? new Date(data[0].created_at) : null;
    }

    const tramos = construirTramosTendencia(filtro, ahora, primerPedidoEn);
    const periodos = construirPeriodosComparacion(filtro, ahora);

    const bucketInicios = [...tramos.map((t) => t.inicio), periodos.actual.inicio, ...(periodos.previo ? [periodos.previo.inicio] : [])];
    const bucketFines = [...tramos.map((t) => t.fin), periodos.actual.fin, ...(periodos.previo ? [periodos.previo.fin] : [])];

    const { data: filasRaw, error } = await sb.rpc('orders_bucketed_stats', {
      p_restaurant_id: scopedRestaurantId,
      p_bucket_starts: bucketInicios.map((d) => d.toISOString()),
      p_bucket_ends: bucketFines.map((d) => d.toISOString()),
    });
    if (error) {
      console.error("No se pudo calcular Tus ventas/Tendencias (orders_bucketed_stats):", error);
      return;
    }

    const porIdx = new Map<number, { revenue: number; order_count: number; customer_count: number }>();
    (filasRaw ?? []).forEach((f: any) => porIdx.set(f.idx, { revenue: Number(f.revenue), order_count: Number(f.order_count), customer_count: Number(f.customer_count) }));

    setSalesTrendData(tramos.map((t, i) => {
      const fila = porIdx.get(i + 1);
      return { name: t.etiqueta, ventas: fila?.revenue ?? 0, ordenes: fila?.order_count ?? 0 };
    }));

    const filaActual = porIdx.get(tramos.length + 1);
    const filaPrevia = periodos.previo ? porIdx.get(tramos.length + 2) : null;
    const totalRevenue = filaActual?.revenue ?? 0;
    const totalOrders = filaActual?.order_count ?? 0;
    const uniqueCustomers = filaActual?.customer_count ?? 0;
    const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const prevRevenue = filaPrevia?.revenue ?? 0;
    const prevOrdersCount = filaPrevia?.order_count ?? 0;
    const prevUniqueCustomers = filaPrevia?.customer_count ?? 0;
    const prevAvgOrder = prevOrdersCount > 0 ? prevRevenue / prevOrdersCount : 0;
    const calcChange = (current: number, prev: number) => {
      if (prev === 0) return current > 0 ? 100 : 0;
      return ((current - prev) / prev) * 100;
    };
    setFilteredStats({
      revenue: totalRevenue,
      orders: totalOrders,
      customers: uniqueCustomers,
      averageOrder: avgOrder,
      revenueChange: calcChange(totalRevenue, prevRevenue),
      ordersChange: calcChange(totalOrders, prevOrdersCount),
      customersChange: calcChange(uniqueCustomers, prevUniqueCustomers),
      avgOrderChange: calcChange(avgOrder, prevAvgOrder),
    });
  };

  const fetchData = async (scopedRestaurantId: string | null) => {
    // Nota: no reasignar estas queries con `let x = x.eq(...)` — el builder de
    // Supabase tiene tipos genéricos encadenados tan profundos que TypeScript
    // truena con "Type instantiation is excessively deep" al reinferir el
    // tipo a través de una reasignación. Construirlas en una sola expresión
    // (ternario) evita el problema por completo.
    // products/categories: el resultado de encadenar .eq() aquí es tan
    // profundo que TS truena incluso sin reasignación — se corta la
    // inferencia con `as any` justo en ese punto (el runtime de Supabase no
    // se ve afectado, es puramente un límite de profundidad del compilador).
    // `supabase as any` corta la inferencia justo al inicio de la cadena —
    // con el cliente tipado, encadenar .select().order().eq() en un
    // ternario hace que TS truene con "Type instantiation is excessively
    // deep" (límite del compilador, no un error real; el runtime de
    // Supabase no se ve afectado).
    const sb: any = supabase;
    const productsQuery = scopedRestaurantId
      ? sb.from("products").select("*").order("display_order").eq("restaurant_id", scopedRestaurantId)
      : sb.from("products").select("*").order("display_order");
    const categoriesQuery = scopedRestaurantId
      ? sb.from("categories").select("*").order("display_order").eq("restaurant_id", scopedRestaurantId)
      : sb.from("categories").select("*").order("display_order");
    // Ventana real según el periodo seleccionado en Estadísticas — un
    // `.limit(50)` fijo se quedaba invisible con pocos pedidos de prueba,
    // pero con volumen real (90,000 pedidos de demo repartidos en 90 días)
    // los 50 más recientes de TODA la tabla casi nunca caen dentro de "Hoy"
    // (son solo ~1000 de 90,000 filas), así que Estadísticas mostraba $0
    // aunque sí había pedidos reales ese día. Se acota por fecha real en vez
    // de por cantidad de filas.
    const inicioVentanaOrders = (() => {
      const ahora = new Date();
      switch (dateFilter) {
        case 'today': return startOfDay(ahora);
        case '7': return subDays(ahora, 7);
        case '30': return subDays(ahora, 30);
        case '90': return subDays(ahora, 90);
        case '180': return subDays(ahora, 180);
        case '365': return subDays(ahora, 365);
        default: return null; // 'historico' — sin cota inferior
      }
    })();
    const ordersQueryBase = sb.from("orders").select("id, customer_name, customer_phone, branch, total, status, source, created_at, restaurant_id").order("created_at", { ascending: false }).limit(50000);
    const ordersQuery = (() => {
      let q = ordersQueryBase;
      if (scopedRestaurantId) q = q.eq("restaurant_id", scopedRestaurantId);
      if (inicioVentanaOrders) q = q.gte("created_at", inicioVentanaOrders.toISOString());
      // El widget de WhatsApp de prueba (WidgetWhatsApp.tsx) crea pedidos
      // reales con customer_phone = "widget-<uuid>" para que la conversación
      // se pueda probar de punta a punta — pero esos NO son pedidos de demo
      // intencionales (is_demo se queda como está, sí cuenta para las
      // cifras reales de "restaurante con volumen"), son basura de pruebas
      // manuales y no deben mezclarse con nada visible en el admin.
      q = q.not("customer_phone", "ilike", "widget-%");
      return q;
    })();
    const {
      data: productsData
    } = await productsQuery;
    setProducts(productsData || []);
    const {
      data: categoriesData
    } = await categoriesQuery;
    setCategories(categoriesData || []);
    const {
      data: ordersData
    } = await ordersQuery;
    setOrders(ordersData || []);
    // "Tus ventas"/"Tendencias" ya NO se calculan sobre `ordersData` (ver
    // comentario junto al useState de filteredStats/salesTrendData): se
    // agregan en Postgres vía RPC, sin el tope de 1000 filas de la API de
    // datos. Se espera (no fire-and-forget) para que no destelle $0 al
    // cargar — pero envuelto en try/catch para que, si el RPC falla, el
    // resto de fetchData (productos, categorías, perfiles…) siga cargando
    // igual; el error ya se loguea dentro de la propia función.
    try {
      await actualizarEstadisticasYTendencia(scopedRestaurantId, dateFilter);
    } catch (err) {
      console.error("No se pudo calcular Tus ventas/Tendencias:", err);
    }
    const {
      data: profilesData
    } = await supabase.from("profiles").select("*").order("created_at", {
      ascending: false
    });
    setProfiles(profilesData || []);
    const {
      data: promosData
    } = await supabase.from("promos").select("*").order("display_order");
    setPromos(promosData || []);
    
    // Fetch repartidores
    const { data: repartidoresData } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "repartidor");
    
    if (repartidoresData && repartidoresData.length > 0) {
      const userIds = repartidoresData.map(r => r.user_id);
      const { data: repartidorProfiles } = await supabase
        .from("profiles")
        .select("user_id, email, nombre, telefono, created_at")
        .in("user_id", userIds);
      setRepartidores(repartidorProfiles || []);
    } else {
      setRepartidores([]);
    }

    const callbackRequestsQuery = scopedRestaurantId
      ? sb.from("callback_requests").select("*").order("created_at", { ascending: false }).limit(100).eq("restaurant_id", scopedRestaurantId)
      : sb.from("callback_requests").select("*").order("created_at", { ascending: false }).limit(100);
    const { data: callbackRequestsData } = await callbackRequestsQuery;
    setCallbackRequests(callbackRequestsData || []);

    setStats({
      revenue: 0,
      customers: 0,
      orders: 0,
      products: (productsData || []).length,
      users: (profilesData || []).length
    });
  };
  // filteredStats se calcula ahora en actualizarEstadisticasYTendencia
  // (llamada desde fetchData) — ver comentario junto a su useState.

  // Get period label for comparison
  const getPeriodLabel = () => {
    switch (dateFilter) {
      case 'today': return 'vs ayer';
      case '7': return 'vs 7 días anteriores';
      case '30': return 'vs 30 días anteriores';
      case '90': return 'vs 90 días anteriores';
      case '180': return 'vs 180 días anteriores';
      case '365': return 'vs el año anterior';
      case 'historico': return 'todo el tiempo registrado';
      default: return 'vs período anterior';
    }
  };

  // salesTrendData ("Tendencias") se calcula ahora en
  // actualizarEstadisticasYTendencia (llamada desde fetchData) — ver
  // comentario junto a su useState y a construirTramosTendencia.

  const getChartData = useMemo(() => {
    if (!selectedStat) return [];
    const now = new Date();
    let startDate: Date;
    let groupFormat: string;
    const intervals: Date[] = [];
    switch (timePeriod) {
      case 'day':
        startDate = subDays(now, 24);
        for (let i = 0; i < 24; i++) {
          intervals.push(new Date(now.getTime() - (23 - i) * 60 * 60 * 1000));
        }
        groupFormat = 'HH:00';
        break;
      case 'week':
        startDate = subWeeks(now, 1);
        for (let i = 6; i >= 0; i--) {
          intervals.push(subDays(now, i));
        }
        groupFormat = 'EEE';
        break;
      case 'month':
        startDate = subMonths(now, 1);
        for (let i = 29; i >= 0; i--) {
          intervals.push(subDays(now, i));
        }
        groupFormat = 'dd';
        break;
      case 'year':
        startDate = subYears(now, 1);
        for (let i = 11; i >= 0; i--) {
          intervals.push(subMonths(now, i));
        }
        groupFormat = 'MMM';
        break;
    }
    if (selectedStat === 'revenue' || selectedStat === 'orders' || selectedStat === 'customers') {
      const filteredOrders = orders.filter(o => isAfter(new Date(o.created_at), startDate));
      return intervals.map(date => {
        const label = format(date, groupFormat, {
          locale: es
        });
        let value = 0;
        filteredOrders.forEach(order => {
          const orderDate = new Date(order.created_at);
          let matches = false;
          if (timePeriod === 'day') {
            matches = format(orderDate, 'HH') === format(date, 'HH') && format(orderDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
          } else if (timePeriod === 'week' || timePeriod === 'month') {
            matches = format(orderDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
          } else {
            matches = format(orderDate, 'yyyy-MM') === format(date, 'yyyy-MM');
          }
          if (matches) {
            if (selectedStat === 'revenue') value += Number(order.total);else if (selectedStat === 'orders') value += 1;else if (selectedStat === 'customers') value += 1;
          }
        });
        return {
          name: label,
          value
        };
      });
    }
    if (selectedStat === 'users') {
      const filteredProfiles = profiles.filter(p => isAfter(new Date(p.created_at), startDate));
      return intervals.map(date => {
        const label = format(date, groupFormat, {
          locale: es
        });
        let value = 0;
        filteredProfiles.forEach(profile => {
          const profileDate = new Date(profile.created_at);
          let matches = false;
          if (timePeriod === 'day') {
            matches = format(profileDate, 'HH') === format(date, 'HH') && format(profileDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
          } else if (timePeriod === 'week' || timePeriod === 'month') {
            matches = format(profileDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
          } else {
            matches = format(profileDate, 'yyyy-MM') === format(date, 'yyyy-MM');
          }
          if (matches) value += 1;
        });
        return {
          name: label,
          value
        };
      });
    }
    if (selectedStat === 'products') {
      return [{
        name: 'Total',
        value: products.length
      }];
    }
    return [];
  }, [selectedStat, timePeriod, orders, profiles, products]);
  const openStatsDialog = (stat: typeof selectedStat) => {
    setSelectedStat(stat);
    setStatsDialogOpen(true);
  };
  const getStatTitle = () => {
    switch (selectedStat) {
      case 'revenue':
        return 'Ingresos';
      case 'customers':
        return 'Clientes';
      case 'orders':
        return 'Pedidos';
      case 'products':
        return 'Productos';
      case 'users':
        return 'Usuarios';
      default:
        return '';
    }
  };
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };
  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductDialogOpen(true);
  };
  const handleDeleteProduct = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este producto?")) return;
    const {
      error
    } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      return;
    }
    toast({
      title: "Eliminado",
      description: "Producto eliminado correctamente"
    });
    await fetchData(restaurantId);
  };
  // Reordena categorías con las flechas y persiste el nuevo orden completo
  // (normaliza display_order a la posición del arreglo en cada movimiento,
  // así no depende de que los valores previos ya estuvieran bien seteados).
  const moverCategoria = async (index: number, direccion: -1 | 1) => {
    const destino = index + direccion;
    if (destino < 0 || destino >= categories.length) return;
    const reordenadas = [...categories];
    [reordenadas[index], reordenadas[destino]] = [reordenadas[destino], reordenadas[index]];
    setCategories(reordenadas);
    const { error } = await (await Promise.all(
      reordenadas.map((cat, i) => supabase.from("categories").update({ display_order: i }).eq("id", cat.id))
    )).find((r) => r.error) ?? { error: null };
    if (error) {
      toast({ title: "No se pudo guardar el orden", description: error.message, variant: "destructive" });
      await fetchData(restaurantId);
    }
  };
  const handlePromoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const promoData = {
      title: promoForm.title,
      description: promoForm.description || null,
      image_url: promoForm.image_url || null,
      discount_text: promoForm.discount_text || null,
      is_active: promoForm.is_active
    };
    if (editingPromo) {
      const {
        error
      } = await supabase.from("promos").update(promoData).eq("id", editingPromo.id);
      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
        return;
      }
      toast({
        title: "¡Actualizado!",
        description: "Promoción actualizada correctamente"
      });
    } else {
      const {
        error
      } = await supabase.from("promos").insert(promoData);
      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
        return;
      }
      toast({
        title: "¡Agregada!",
        description: "Promoción agregada correctamente"
      });
    }
    setPromoDialogOpen(false);
    setEditingPromo(null);
    resetPromoForm();
    await fetchData(restaurantId);
  };
  const handleEditPromo = (promo: Promo) => {
    setEditingPromo(promo);
    setPromoForm({
      title: promo.title,
      description: promo.description || "",
      image_url: promo.image_url || "",
      discount_text: promo.discount_text || "",
      is_active: promo.is_active ?? true
    });
    setPromoDialogOpen(true);
  };
  const handleDeletePromo = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta promoción?")) return;
    const {
      error
    } = await supabase.from("promos").delete().eq("id", id);
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      return;
    }
    toast({
      title: "Eliminada",
      description: "Promoción eliminada correctamente"
    });
    await fetchData(restaurantId);
  };
  const resetPromoForm = () => {
    setPromoForm({
      title: "",
      description: "",
      image_url: "",
      discount_text: "",
      is_active: true
    });
  };
  // Búsqueda simple y determinista sobre los datos ya cargados de este
  // restaurante — no es un motor de lenguaje natural real todavía, mismo
  // criterio honesto que "Pregunta a tus datos" de superadmin. Las fases de
  // "pensando" son solo estado de carga (la búsqueda es instantánea), no una
  // llamada real a un LLM.
  const FASES_PENSANDO = ['Leyendo tus pedidos…', 'Calculando cifras…', 'Preparando la respuesta…'];

  const responderPreguntaLocal = async (qInput: string) => {
    const q = qInput.trim();
    if (!q || pensando) return;
    setHistorialPreguntas((h) => [q, ...h.filter((x) => x !== q)].slice(0, 20));
    setMostrarHistorial(false);
    setMostrarSugerencias(false);
    setMensajesChat((m) => [...m, { rol: 'usuario', texto: q }]);
    setPregunta('');
    setPensando(true);
    for (const fase of FASES_PENSANDO) {
      setFasePensando(fase);
      await new Promise((r) => setTimeout(r, 260));
    }

    const needle = q.toLowerCase();
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    let pedidos: Order[] | undefined;
    let mostrarGrafica = false;
    let texto: string;

    if (needle.includes('grafica') || needle.includes('gráfica') || needle.includes('tendencia') || needle.includes('cómo van') || needle.includes('como van')) {
      mostrarGrafica = true;
      texto = `Así van tus ventas ${getPeriodLabel()}.`;
    } else if (needle.includes('pendiente')) {
      pedidos = orders.filter((o) => o.status !== 'completado' && o.status !== 'entregado');
      const total = pedidos.reduce((s, o) => s + Number(o.total), 0);
      texto = pedidos.length > 0
        ? `Tienes ${pedidos.length} pedido${pedidos.length === 1 ? '' : 's'} pendiente${pedidos.length === 1 ? '' : 's'} por $${total.toLocaleString('es-MX')}.`
        : 'No tienes pedidos pendientes en este momento.';
    } else if (needle.includes('entregado') || needle.includes('completado')) {
      pedidos = orders.filter((o) => o.status === 'completado' || o.status === 'entregado');
      texto = `${pedidos.length} pedido${pedidos.length === 1 ? '' : 's'} entregado${pedidos.length === 1 ? '' : 's'}.`;
    } else if (needle.includes('hoy') || needle.includes('vendido') || needle.includes('entraron')) {
      pedidos = orders.filter((o) => new Date(o.created_at) >= hoy);
      const total = pedidos.reduce((s, o) => s + Number(o.total), 0);
      texto = `Hoy entraron ${pedidos.length} pedido${pedidos.length === 1 ? '' : 's'} por $${total.toLocaleString('es-MX')}.`;
    } else if (needle.includes('producto')) {
      const activos = products.filter((p) => p.is_available !== false).length;
      texto = `Tienes ${products.length} producto${products.length === 1 ? '' : 's'} en el menú, ${activos} activo${activos === 1 ? '' : 's'}.`;
    } else if (needle.includes('usuario') || needle.includes('registrado')) {
      texto = `Tienes ${profiles.length} usuario${profiles.length === 1 ? '' : 's'} registrado${profiles.length === 1 ? '' : 's'}.`;
    } else {
      pedidos = orders.filter((o) => o.customer_name.toLowerCase().includes(needle));
      texto = pedidos.length > 0
        ? `Encontré ${pedidos.length} pedido${pedidos.length === 1 ? '' : 's'} de "${q}".`
        : `No encontré pedidos que coincidan con "${q}". Pregúntame por pendientes, entregados, lo de hoy, tus ventas, o el nombre de un cliente.`;
    }

    setMensajesChat((m) => [...m, { rol: 'asistente', texto, pedidos, mostrarGrafica }]);
    setPensando(false);
  };

  const descargarPdfRespuesta = (preguntaTexto: string, texto: string, pedidos?: Order[]) => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Atiende — Reporte', 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(restaurantName ?? 'Tu restaurante', 14, 25);
    doc.text(new Date().toLocaleString('es-MX'), 14, 30);
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.text(`Pregunta: ${preguntaTexto}`, 14, 40);
    const textoLineas = doc.splitTextToSize(texto, 180);
    doc.text(textoLineas, 14, 48);
    if (pedidos && pedidos.length > 0) {
      autoTable(doc, {
        startY: 48 + textoLineas.length * 6 + 6,
        head: [['Cliente', 'Fecha', 'Total']],
        body: pedidos.map((o) => [o.customer_name, new Date(o.created_at).toLocaleString('es-MX'), `$${Number(o.total).toLocaleString('es-MX')}`]),
        headStyles: { fillColor: [37, 99, 235] },
      });
    }
    doc.save(`atiende-reporte-${Date.now()}.pdf`);
  };

  const categoriasPreguntasRestaurante = [
    {
      titulo: 'PEDIDOS Y VENTAS',
      preguntas: ['¿Qué pedidos entraron hoy?', '¿Cómo van mis ventas?', '¿Cuántos pedidos están pendientes?'],
    },
    {
      titulo: 'OPERACIÓN',
      preguntas: ['¿Cuántos pedidos están entregados?', '¿Cuántos productos tengo activos?'],
    },
    {
      titulo: 'CLIENTES',
      preguntas: ['¿Cuántos usuarios tengo registrados?', 'Busca los pedidos de un cliente'],
    },
  ];
  const preguntasSugeridasPlano = categoriasPreguntasRestaurante.flatMap((c) => c.preguntas);

  const historialFiltrado = historialPreguntas.filter((h) => h.toLowerCase().includes(busquedaHistorial.toLowerCase()));

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-label="Cargando">
        <AtiendeMark className="h-9 w-auto atiende-respira" />
      </div>;
  }
  return <div className="min-h-screen bg-muted/30 flex md:gap-3 md:p-3">
      {/* Desktop Sidebar — panel flotante, separado del resto */}
      <AdminSidebar user={user} activeSection={activeSection} onSectionChange={setActiveSection} onLogout={handleLogout} />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col md:gap-3">
        {/* Mobile Header */}
        <header className="md:hidden bg-primary text-primary-foreground p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <AtiendeMark className="h-8 w-auto brightness-0 invert" />
            <Button onClick={handleLogout} variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Barra de "viendo como" — tarjeta PROPIA, separada del panel
            principal por el mismo gap que separa sidebar/panel (no es la
            franja superior de un panel más grande: es su propia pieza). */}
        {searchParams.get("restaurante") && (
          <div className="hidden md:flex items-center justify-between px-4 py-2.5 rounded-2xl border border-border bg-primary/5 text-[13px] shadow-sm shrink-0">
            <span className="flex items-center gap-1.5 text-foreground">
              <Eye className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={1.75} />
              Estás viendo el panel de <strong className="font-semibold">{restaurantName ?? "este restaurante"}</strong> como superadmin.
            </span>
            <button
              onClick={() => navigate("/admin/superadmin")}
              className="text-primary underline underline-offset-2 hover:opacity-70 transition-opacity shrink-0"
            >
              ← Volver a superadmin
            </button>
          </div>
        )}

        {/* Un solo panel grande (como la consola real de Likida): encabezado
            blanco arriba, cuerpo gris abajo con las tarjetas encima. */}
        <div className="hidden md:flex flex-1 min-w-0 rounded-2xl border border-border bg-card overflow-hidden flex-col relative">
          {activeSection !== 'pregunta' && (
            <header className="flex items-center justify-between h-12 px-4 shrink-0 border-b border-border bg-card">
              <h1 className="flex items-center gap-2 text-sm font-medium text-foreground">
                {activeSection === 'dashboard' && (<><LayoutGrid className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Estadísticas</>)}
                {activeSection === 'products' && (<><Package className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Productos</>)}
                {activeSection === 'categories' && (<><Tag className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Categorías</>)}
                {activeSection === 'promos' && (<><Percent className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Promociones</>)}
                {activeSection === 'orders' && (<><ShoppingCart className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Pedidos</>)}
                {activeSection === 'users' && (<><Contact className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Clientes</>)}
                {activeSection === 'repartidores' && (<><Bike className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Repartidores</>)}
                {activeSection === 'notificaciones' && (<><Bell className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Notificaciones</>)}
                {activeSection === 'sucursales' && (<><Store className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Sucursales</>)}
                {activeSection === 'historial-ordenes' && (<><History className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Historial de Órdenes</>)}
                {activeSection === 'cuentas-accesos' && (<><Users className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Cuentas & Accesos</>)}
                {activeSection === 'help' && (<><HelpCircle className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Centro de Ayuda</>)}
                {activeSection === 'agente-voz' && (<><Mic className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Agente de voz</>)}
                {activeSection === 'agente-whatsapp' && (<><MessageCircle className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Agente de WhatsApp</>)}
                {activeSection === 'agente-voz-dashboard' && (<><LayoutGrid className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Dashboard — Agente de voz</>)}
                {activeSection === 'agente-whatsapp-dashboard' && (<><LayoutGrid className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Dashboard — Agente de WhatsApp</>)}
              </h1>
              {activeSection === 'agente-voz' && (
                <div className="flex items-center gap-2 shrink-0">
                  {/* Selector de sucursal — Global o una puntual, para ver las
                      cifras acotadas a esa sucursal. Contenedor `relative`
                      propio para que el menú cuelgue justo debajo de ESTE
                      botón, no del extremo derecho de todo el renglón. */}
                  <div className="relative">
                    <button
                      onClick={() => setMostrarSelectorSucursal((v) => !v)}
                      className="flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-border text-[11px] text-foreground hover:bg-muted transition-colors"
                    >
                      {sucursalSeleccionada === 'global' ? <Globe className="w-3 h-3 text-muted-foreground" /> : <Store className="w-3 h-3 text-muted-foreground" />}
                      {sucursalSeleccionada === 'global' ? 'Todas las sucursales' : (sucursalesAgente.find((s) => s.id === sucursalSeleccionada)?.name ?? 'Sucursal')}
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    </button>
                    {mostrarSelectorSucursal && (
                      <div className="absolute left-0 top-9 z-30 w-52 rounded-xl border border-border bg-card shadow-lg p-1">
                        <button
                          onClick={() => { setSucursalSeleccionada('global'); setMostrarSelectorSucursal(false); }}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] text-left transition-colors ${sucursalSeleccionada === 'global' ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}
                        >
                          <Globe className="w-3.5 h-3.5 shrink-0" /> Todas las sucursales
                        </button>
                        <div className="my-1 border-t border-border" />
                        {sucursalesAgente.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => { setSucursalSeleccionada(s.id); setMostrarSelectorSucursal(false); }}
                            className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[13px] text-left transition-colors ${sucursalSeleccionada === s.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}
                          >
                            <span className="flex items-center gap-2 min-w-0"><Store className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{s.name}</span></span>
                            {!s.elevenlabs_agent_id && <span className="font-mono text-[9px] uppercase text-muted-foreground/60 shrink-0">Sin agente</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={abrirVistaPreviaAgente}
                    disabled={!agentIdActivo}
                    title={agentIdActivo ? 'El globo del agente ya está abajo a la derecha — abre la conversación de prueba real de ElevenLabs' : 'Esta sucursal todavía no tiene un agente de voz configurado'}
                    className={`flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      vistaPreviaActiva
                        ? 'bg-primary text-primary-foreground hover:opacity-90'
                        : 'border border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    <PlayCircle className="w-3 h-3" /> Vista previa
                  </button>
                  <button
                    onClick={() => setActiveSection('agente-voz-dashboard')}
                    className="flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-border text-[11px] text-foreground hover:bg-muted transition-colors"
                  >
                    <LayoutGrid className="w-3 h-3 text-muted-foreground" /> Dashboards
                  </button>
                  {cargandoAgentes && <RefreshCw className="w-3 h-3 text-muted-foreground animate-spin" />}
                </div>
              )}
              {activeSection === 'agente-whatsapp' && (
                <div className="flex items-center gap-2 shrink-0">
                  {/* Mismo selector de sucursal / "Todas las sucursales" que
                      Agente de voz, con su propio estado independiente. */}
                  <div className="relative">
                    <button
                      onClick={() => setMostrarSelectorSucursalWhatsapp((v) => !v)}
                      className="flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-border text-[11px] text-foreground hover:bg-muted transition-colors"
                    >
                      {sucursalSeleccionadaWhatsapp === 'global' ? <Globe className="w-3 h-3 text-muted-foreground" /> : <Store className="w-3 h-3 text-muted-foreground" />}
                      {sucursalSeleccionadaWhatsapp === 'global' ? 'Todas las sucursales' : (sucursalesAgente.find((s) => s.id === sucursalSeleccionadaWhatsapp)?.name ?? 'Sucursal')}
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    </button>
                    {mostrarSelectorSucursalWhatsapp && (
                      <div className="absolute left-0 top-9 z-30 w-52 rounded-xl border border-border bg-card shadow-lg p-1">
                        <button
                          onClick={() => { setSucursalSeleccionadaWhatsapp('global'); setMostrarSelectorSucursalWhatsapp(false); }}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] text-left transition-colors ${sucursalSeleccionadaWhatsapp === 'global' ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}
                        >
                          <Globe className="w-3.5 h-3.5 shrink-0" /> Todas las sucursales
                        </button>
                        <div className="my-1 border-t border-border" />
                        {sucursalesAgente.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => { setSucursalSeleccionadaWhatsapp(s.id); setMostrarSelectorSucursalWhatsapp(false); }}
                            className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[13px] text-left transition-colors ${sucursalSeleccionadaWhatsapp === s.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}
                          >
                            <span className="flex items-center gap-2 min-w-0"><Store className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{s.name}</span></span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setActiveSection('agente-whatsapp-dashboard')}
                    className="flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-border text-[11px] text-foreground hover:bg-muted transition-colors"
                  >
                    <LayoutGrid className="w-3 h-3 text-muted-foreground" /> Dashboards
                  </button>
                  {cargandoAgentes && <RefreshCw className="w-3 h-3 text-muted-foreground animate-spin" />}
                </div>
              )}
              {activeSection === 'dashboard' && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveSection('pregunta')}
                    className="h-8 rounded-full text-[13px] shrink-0"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Chatea con tus datos
                  </Button>
                  <button
                    onClick={() => setActiveSection('notificaciones')}
                    aria-label={`Notificaciones: ${notificationUnreadCount} sin leer`}
                    className="relative w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
                  >
                    <Bell className="w-4 h-4" strokeWidth={1.75} />
                    {notificationUnreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-mono font-medium leading-4 text-center animate-pulse">
                        {notificationUnreadCount > 999 ? "999+" : notificationUnreadCount}
                      </span>
                    )}
                  </button>
                  <span className="font-mono text-xs text-muted-foreground border border-border rounded-full px-3 py-1.5 shrink-0">
                    {format(new Date(), "d MMM yyyy", { locale: es })}
                  </span>
                </div>
              )}
            </header>
          )}

          <main className="flex-1 p-4 space-y-6 overflow-auto bg-muted/30">

        {/* Dashboard Stats - Only show on dashboard section */}
        {activeSection === 'dashboard' && (
          <>
            {/* Saludo (izquierda) + filtro de fecha y actualizar (derecha),
                un solo renglón nivelado, sin altura extra. */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  {saludoHorario()}, {nombreSaludo || 'de vuelta'} 👋
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Todo listo para que sigas administrando tu restaurante.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                <div className="flex items-center gap-0.5 rounded-full border border-border bg-muted/40 p-0.5">
                  {([
                    ['today', 'Hoy'],
                    ['7', '7 días'],
                    ['30', '1 mes'],
                    ['90', '3 meses'],
                    ['180', '6 meses'],
                    ['365', '1 año'],
                    ['historico', 'Histórico'],
                  ] as const).map(([valor, etiqueta]) => (
                    <button
                      key={valor}
                      onClick={() => setDateFilter(valor)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                        dateFilter === valor
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {etiqueta}
                    </button>
                  ))}
                </div>
                <button
                  onClick={refrescarDatos}
                  disabled={refrescando}
                  className="flex items-center gap-1.5 h-7 px-3 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-70"
                >
                  <RefreshCw className={`w-3 h-3 ${refrescando ? 'animate-spin' : ''}`} />
                  {refrescando ? 'Actualizando…' : 'Actualizar'}
                </button>
              </div>
            </div>

            {/* Tus ventas Section — el título vive como caption mono/uppercase
                dentro del mismo recuadro que las tarjetas, igual que "TU MOTOR
                FISCAL — EJERCICIO 2026" en Likida. Anatomía de cada tarjeta:
                chip de ícono sólido, cifra grande, pie con hairline punteado
                (sin píldora de color ni "Ver más" — la tarjeta completa es
                el link, como en el dashboard real de Likida). */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Tus ventas</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button onClick={() => openStatsDialog('revenue')} className="w-full text-left">
                  <StatCard
                    icon={DollarSign}
                    label="Ventas netas"
                    value={`$${filteredStats.revenue.toLocaleString()}`}
                    nota={dateFilter === 'historico' ? getPeriodLabel() : `${filteredStats.revenueChange >= 0 ? '+' : ''}${filteredStats.revenueChange.toFixed(1)}% ${getPeriodLabel()}`}
                  />
                </button>
                <button onClick={() => openStatsDialog('orders')} className="w-full text-left">
                  <StatCard
                    icon={ShoppingCart}
                    label="Número de órdenes"
                    value={String(filteredStats.orders)}
                    nota={dateFilter === 'historico' ? getPeriodLabel() : `${filteredStats.ordersChange >= 0 ? '+' : ''}${filteredStats.ordersChange.toFixed(1)}% ${getPeriodLabel()}`}
                  />
                </button>
                <button onClick={() => openStatsDialog('customers')} className="w-full text-left">
                  <StatCard
                    icon={DollarSign}
                    label="Valor promedio"
                    value={`$${filteredStats.averageOrder.toFixed(2)}`}
                    nota={dateFilter === 'historico' ? getPeriodLabel() : `${filteredStats.avgOrderChange >= 0 ? '+' : ''}${filteredStats.avgOrderChange.toFixed(1)}% ${getPeriodLabel()}`}
                  />
                </button>
              </div>
            </div>

            {/* Sales & Orders Trend Charts — sigue el mismo FECHA de arriba */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Tendencias</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Ventas Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary"></div>
                      <span className="text-sm font-medium text-foreground">Ventas ($)</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={salesTrendData}>
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 10, fontFamily: "IBM Plex Mono, ui-monospace, monospace", fill: "hsl(var(--muted-foreground))" }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 10, fontFamily: "IBM Plex Mono, ui-monospace, monospace", fill: "hsl(var(--muted-foreground))" }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `$${value}`}
                          />
                          <Tooltip
                            {...tooltipEstiloCompartido}
                            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Ventas']}
                          />
                          <Line
                            type="monotone"
                            dataKey="ventas"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 3 }}
                            activeDot={{ r: 5, fill: 'hsl(var(--primary))' }}
                            isAnimationActive
                            animationDuration={450}
                            animationEasing="ease-out"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Órdenes Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-secondary"></div>
                      <span className="text-sm font-medium text-foreground">Órdenes</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={salesTrendData}>
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 10, fontFamily: "IBM Plex Mono, ui-monospace, monospace", fill: "hsl(var(--muted-foreground))" }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 10, fontFamily: "IBM Plex Mono, ui-monospace, monospace", fill: "hsl(var(--muted-foreground))" }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip
                            {...tooltipEstiloCompartido}
                            formatter={(value: number) => [value, 'Órdenes']}
                          />
                          <Line
                            type="monotone"
                            dataKey="ordenes"
                            stroke="hsl(var(--secondary))"
                            strokeWidth={2}
                            dot={{ fill: 'hsl(var(--secondary))', strokeWidth: 2, r: 3 }}
                            activeDot={{ r: 5, fill: 'hsl(var(--secondary))' }}
                            isAnimationActive
                            animationDuration={450}
                            animationEasing="ease-out"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Impacto de tus agentes — arriba de "Tu operación" a propósito:
                es el resumen de ROI que un dueño de restaurante quiere ver
                primero (¿están funcionando los agentes?), antes que conteos
                de catálogo. KPIs elegidos contra lo que de verdad usan
                Slang.ai/ConverseNow/Presto (voz para restaurantes) e
                Intercom/Ada (bots de chat) en sus propios dashboards:
                adopción de canal (% pedidos/% ingresos vía IA — prueba que
                se está usando), horas de atención humana ahorradas (el
                argumento de ROI que un dueño entiende de inmediato, con el
                supuesto declarado a la vista), y el desglose real por canal.
                Reusa statsAgentes (conteos exactos, no el `orders` capado a
                50 filas del dashboard). */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Impacto de tus agentes</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <TileKpiAgente
                  indice={0}
                  label="Pedidos por agentes IA"
                  valor={statsAgentes && statsAgentes.totalOrdenes > 0 ? ((statsAgentes.voz.total + statsAgentes.whatsapp.total) / statsAgentes.totalOrdenes) * 100 : null}
                  meta="50%"
                />
                <TileKpiAgente
                  indice={1}
                  label="Ingresos por agentes IA"
                  valor={statsAgentes && statsAgentes.ingresoTotal > 0 ? ((statsAgentes.voz.ingreso + statsAgentes.whatsapp.ingreso) / statsAgentes.ingresoTotal) * 100 : null}
                  meta="50%"
                />
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1 min-w-0">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
                      <span className="text-[13px] font-medium text-foreground truncate">Horas de atención ahorradas</span>
                    </div>
                  </div>
                  <p className="font-display text-xl font-semibold tabular-nums text-foreground mb-0.5">
                    {statsAgentes ? `${(((statsAgentes.voz.completados + statsAgentes.whatsapp.completados) * 5) / 60).toFixed(1)} h` : '—'}
                  </p>
                  <p className="text-[10.5px] text-muted-foreground leading-snug">
                    Estimado: ≈5 min de atención humana por pedido resuelto por un agente. Supuesto ajustable, no es una medición real.
                  </p>
                </div>
                <button className="text-left transition-transform hover:-translate-y-0.5" onClick={() => setActiveSection('agente-voz')}>
                  <StatCard icon={Mic} label="Pedidos por voz" value={String(statsAgentes?.voz.total ?? '—')} verMas />
                </button>
                <button className="text-left transition-transform hover:-translate-y-0.5" onClick={() => setActiveSection('agente-whatsapp')}>
                  <StatCard icon={MessageCircle} label="Pedidos por WhatsApp" value={String(statsAgentes?.whatsapp.total ?? '—')} verMas />
                </button>
                <StatCard
                  icon={DollarSign}
                  label="Ingresos generados por IA"
                  value={statsAgentes ? `$${(statsAgentes.voz.ingreso + statsAgentes.whatsapp.ingreso).toLocaleString('es-MX')}` : '—'}
                />
              </div>
            </div>

            {/* Tu Operación Section */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Tu operación</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button className="text-left transition-transform hover:-translate-y-0.5" onClick={() => setActiveSection('products')}>
                  <StatCard icon={Package} label="Total de productos" value={String(stats.products)} verMas />
                </button>
                <button className="text-left transition-transform hover:-translate-y-0.5" onClick={() => setActiveSection('users')}>
                  <StatCard icon={Users} label="Usuarios registrados" value={String(stats.users)} verMas />
                </button>
                <StatCard icon={Users} label="Clientes únicos" value={String(filteredStats.customers)} />
                <button className="text-left transition-transform hover:-translate-y-0.5" onClick={() => setActiveSection('categories')}>
                  <StatCard icon={Tag} label="Categorías" value={String(categories.length)} verMas />
                </button>
              </div>
            </div>
          </>
        )}

        {/* Products Section */}
        {activeSection === 'products' && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{products.length} en total</p>
              <Button onClick={() => { setEditingProduct(null); setProductDialogOpen(true); }} size="sm" className="h-8 px-3 rounded-full text-[12.5px]">
                <Plus className="w-3.5 h-3.5" /> Agregar
              </Button>
              <ModalProducto
                open={productDialogOpen}
                onOpenChange={setProductDialogOpen}
                editingProduct={editingProduct}
                categories={categories}
                restaurantId={restaurantId}
                onGuardado={() => fetchData(restaurantId)}
              />
            </div>
            
            {products.length === 0 ? (
              <div className="py-12 text-center">
                <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" strokeWidth={1.5} />
                <p className="text-[13px] text-muted-foreground">No hay productos registrados</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="p-3 flex items-center justify-between border-b border-dashed border-border last:border-0 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5 text-primary" strokeWidth={1.75} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{product.name}</p>
                        <p className="font-display text-[13px] font-semibold tabular-nums text-foreground">${product.price}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${product.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {product.is_available ? 'Disponible' : 'No disponible'}
                      </span>
                      <Button variant="ghost" size="icon" onClick={() => handleEditProduct(product)} className="hover:bg-blue-50 h-7 w-7">
                        <Edit className="w-3.5 h-3.5 text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(product.id)} className="hover:bg-red-50 h-7 w-7">
                        <Trash2 className="w-3.5 h-3.5 stroke-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Categories Section */}
        {activeSection === 'categories' && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{categories.length} en total</p>
              <Button onClick={() => setCategoryDialogOpen(true)} size="sm" className="h-8 px-3 rounded-full text-[12.5px]">
                <Plus className="w-3.5 h-3.5" /> Agregar
              </Button>
              <ModalCategoria
                open={categoryDialogOpen}
                onOpenChange={setCategoryDialogOpen}
                restaurantId={restaurantId}
                onGuardado={() => fetchData(restaurantId)}
              />
            </div>
            
            {categories.length === 0 ? (
              <div className="py-12 text-center">
                <Tag className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" strokeWidth={1.5} />
                <p className="text-[13px] text-muted-foreground">No hay categorías registradas</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                {categories.map((category, index) => {
                  const productosCategoria = products.filter((p) => p.category_id === category.id);
                  const expandida = categoriaExpandida === category.id;
                  return (
                    <div key={category.id} className="border-b border-dashed border-border last:border-0">
                      <div className="p-3 flex items-center justify-between transition-colors hover:bg-muted/40">
                        <button
                          onClick={() => setCategoriaExpandida(expandida ? null : category.id)}
                          className="flex items-center gap-3 text-left flex-1 min-w-0"
                        >
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Tag className="w-5 h-5 text-primary" strokeWidth={1.75} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-foreground truncate">{category.name}</p>
                            <p className="text-[12px] text-muted-foreground truncate">{category.slug} · {productosCategoria.length} producto{productosCategoria.length === 1 ? '' : 's'}</p>
                          </div>
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex flex-col rounded-lg border border-border overflow-hidden shrink-0">
                            <button
                              onClick={() => moverCategoria(index, -1)}
                              disabled={index === 0}
                              className="p-1 text-muted-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none border-b border-border"
                              aria-label="Subir categoría"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => moverCategoria(index, 1)}
                              disabled={index === categories.length - 1}
                              className="p-1 text-muted-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
                              aria-label="Bajar categoría"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-[11px] font-medium">
                            Activa
                          </span>
                          <button
                            onClick={() => setCategoriaExpandida(expandida ? null : category.id)}
                            className="w-7 h-7 rounded-full border border-border/60 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                            aria-label={expandida ? "Ocultar productos" : "Ver productos"}
                          >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandida ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                      </div>
                      {expandida && (
                        <div className="px-3 pb-3 pl-[3.75rem]">
                          {productosCategoria.length === 0 ? (
                            <p className="text-[12px] text-muted-foreground py-2">Esta categoría no tiene productos todavía.</p>
                          ) : (
                            <div className="rounded-xl border border-border overflow-hidden">
                              {productosCategoria.map((p) => (
                                <div key={p.id} className="flex items-center justify-between px-3 py-2 border-b border-dashed border-border last:border-0 text-[12px]">
                                  <span className="text-foreground">{p.name}</span>
                                  <span className="font-mono tabular-nums text-muted-foreground">${Number(p.price).toLocaleString('es-MX')}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Orders Section */}
        {activeSection === 'orders' && (
          <PedidosSection restaurantId={restaurantId} />
        )}

        {/* Users Section */}
        {activeSection === 'users' && (
          restaurantId
            ? <ClientesSection restaurantId={restaurantId} />
            : <div className="rounded-2xl border border-border bg-card p-8 text-center text-[13px] text-muted-foreground">Cargando restaurante…</div>
        )}

        {/* Cuentas & Accesos — cuentas de staff/admin (antes vivía en "Usuarios",
            movido aquí cuando esa página pasó a ser el CRM real de "Clientes") */}
        {activeSection === 'cuentas-accesos' && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{profiles.length} en total</p>
              <Button onClick={() => setCuentaModalOpen(true)} size="sm" className="h-8 px-3 rounded-full text-[12.5px]">
                <Plus className="w-3.5 h-3.5" /> Agregar cuenta
              </Button>
            </div>

            {profiles.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" strokeWidth={1.5} />
                <p className="text-[13px] text-muted-foreground">No hay cuentas registradas</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="p-3 flex items-center justify-between border-b border-dashed border-border last:border-0 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-primary" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{profile.nombre || 'Sin nombre'}</p>
                        <p className="text-[12px] text-muted-foreground truncate">{profile.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {profile.telefono && (
                        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                          <Phone className="w-3.5 h-3.5" strokeWidth={1.75} />
                          {profile.telefono}
                        </div>
                      )}
                      <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-[11px] font-medium">
                        Activo
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <ModalCuenta
              open={cuentaModalOpen}
              onOpenChange={setCuentaModalOpen}
              restaurantId={restaurantId}
              onCuentaCreada={() => fetchData(restaurantId)}
            />
          </div>
        )}

        {/* Promos Section */}
        {activeSection === 'promos' && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{promos.length} en total</p>
              <Button onClick={() => { setEditingPromo(null); setPromoForm({ title: '', description: '', image_url: '', discount_text: '', is_active: true }); setPromoDialogOpen(true); }} size="sm" className="h-8 px-3 rounded-full text-[12.5px]">
                <Plus className="w-3.5 h-3.5" /> Agregar
              </Button>
              <ModalFormularioLateral
                open={promoDialogOpen}
                onOpenChange={setPromoDialogOpen}
                icono={Percent}
                titulo={editingPromo ? 'Editar promoción' : 'Agregar promoción'}
                anchoClase="max-w-4xl"
                footer={
                  <Button type="submit" form="promo-form" className="rounded-full px-6">
                    {editingPromo ? 'Guardar cambios' : 'Agregar promoción'}
                  </Button>
                }
              >
                <form id="promo-form" onSubmit={handlePromoSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="promo-title">Título</Label>
                    <Input id="promo-title" required value={promoForm.title} onChange={(e) => setPromoForm({ ...promoForm, title: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="promo-desc">Descripción</Label>
                    <Textarea id="promo-desc" value={promoForm.description} onChange={(e) => setPromoForm({ ...promoForm, description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="promo-discount">Texto del descuento</Label>
                      <Input id="promo-discount" placeholder="Ej. 2x1, 20% off" value={promoForm.discount_text} onChange={(e) => setPromoForm({ ...promoForm, discount_text: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="promo-image">URL de imagen</Label>
                      <Input id="promo-image" placeholder="https://…" value={promoForm.image_url} onChange={(e) => setPromoForm({ ...promoForm, image_url: e.target.value })} />
                      {promoForm.image_url && <img src={promoForm.image_url} alt="" className="w-16 h-16 rounded-lg object-cover mt-1" />}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="promo-active">Activa</Label>
                    <Switch id="promo-active" checked={promoForm.is_active} onCheckedChange={(v) => setPromoForm({ ...promoForm, is_active: v })} />
                  </div>
                </form>
              </ModalFormularioLateral>
            </div>
            
            {promos.length === 0 ? (
              <div className="py-12 text-center">
                <Percent className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" strokeWidth={1.5} />
                <p className="text-[13px] text-muted-foreground">No hay promociones registradas</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                {promos.map((promo) => (
                  <div
                    key={promo.id}
                    className="p-3 flex items-center justify-between border-b border-dashed border-border last:border-0 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {promo.image_url ? (
                        <img src={promo.image_url} alt={promo.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Percent className="w-5 h-5 text-primary" strokeWidth={1.75} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{promo.title}</p>
                        {promo.discount_text && <p className="text-[12px] text-muted-foreground">{promo.discount_text}</p>}
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0 ${promo.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {promo.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Dialog open={statsDialogOpen} onOpenChange={setStatsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Estadísticas de {getStatTitle()}</DialogTitle>
            </DialogHeader>
            <Tabs value={timePeriod} onValueChange={v => setTimePeriod(v as typeof timePeriod)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="day">Día</TabsTrigger>
                <TabsTrigger value="week">Semana</TabsTrigger>
                <TabsTrigger value="month">Mes</TabsTrigger>
                <TabsTrigger value="year">Año</TabsTrigger>
              </TabsList>
              <TabsContent value={timePeriod} className="mt-4">
                <div className="h-[300px] w-full">
                  {selectedStat === 'products' ? <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <p className="text-4xl font-bold text-primary">{products.length}</p>
                        <p className="text-muted-foreground">Productos en el menú</p>
                      </div>
                    </div> : <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getChartData}>
                        <XAxis dataKey="name" tick={{
                        fontSize: 10, fontFamily: "IBM Plex Mono, ui-monospace, monospace", fill: "hsl(var(--muted-foreground))"
                      }} tickLine={false} axisLine={false} />
                        <YAxis tick={{
                        fontSize: 10, fontFamily: "IBM Plex Mono, ui-monospace, monospace", fill: "hsl(var(--muted-foreground))"
                      }} tickLine={false} axisLine={false} />
                        <Tooltip
                          {...tooltipEstiloCompartido}
                          formatter={(value: number) => [selectedStat === 'revenue' ? `$${value.toLocaleString()}` : value, getStatTitle()]} />
                        <Bar dataKey="value" fill={selectedStat === 'revenue' ? 'hsl(142 71% 45%)' : selectedStat === 'customers' ? 'hsl(var(--primary))' : selectedStat === 'orders' ? 'hsl(var(--secondary))' : 'hsl(142 71% 45%)'} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={450} animationEasing="ease-out" />
                      </BarChart>
                    </ResponsiveContainer>}
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* Repartidores Section */}
        {activeSection === 'repartidores' && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Repartidores ({repartidores.length})</p>
              <Button onClick={() => setModalRepartidorAbierto(true)} size="sm" className="h-8 px-3 rounded-full text-[12.5px]">
                <Plus className="w-3.5 h-3.5" /> Agregar repartidor
              </Button>
            </div>

            {repartidores.length === 0 ? (
              <div className="py-12 text-center">
                <Bike className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" strokeWidth={1.5} />
                <p className="text-[13px] text-muted-foreground">No hay repartidores registrados</p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Los usuarios pueden registrarse como repartidores desde la página de registro
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                {repartidores.map((repartidor) => (
                  <div
                    key={repartidor.user_id}
                    className="p-3 flex items-center justify-between border-b border-dashed border-border last:border-0 cursor-pointer transition-all hover:bg-muted/40 hover:-translate-y-0.5"
                    onClick={() => navigate(`/admin/repartidor/${repartidor.user_id}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bike className="w-5 h-5 text-primary" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">
                          {repartidor.nombre || 'Sin nombre'}
                        </p>
                        <p className="text-[12px] text-muted-foreground truncate">{repartidor.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {repartidor.telefono && (
                        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                          <Phone className="w-3.5 h-3.5" strokeWidth={1.75} />
                          {repartidor.telefono}
                        </div>
                      )}
                      <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-[11px] font-medium">
                        Activo
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <ModalRepartidor
              open={modalRepartidorAbierto}
              onOpenChange={setModalRepartidorAbierto}
              onGuardado={() => fetchData(restaurantId)}
            />
          </div>
        )}

        {activeSection === 'pregunta' && (
          <div className="relative min-h-[calc(100vh-8rem)] -m-4 pt-4 px-4 overflow-hidden">
            <CampoPixeles />
            <div className="flex justify-end mb-6">
              <button
                onClick={() => setMostrarHistorial((v) => !v)}
                className="relative flex items-center gap-1.5 text-xs border border-border rounded-full pl-3 pr-2.5 py-1.5 bg-card text-muted-foreground hover:bg-muted transition-colors"
              >
                <History className="w-3.5 h-3.5" />
                Historial
                <span className="font-mono text-[10px] bg-muted rounded-full px-1.5 py-0.5 text-foreground">{historialPreguntas.length}</span>
              </button>
            </div>

            {/* Panel de historial — idéntico al de Likida: "Nuevo chat",
                buscador, etiqueta "RECIENTES", lista o estado vacío. */}
            <div className={`flex flex-col items-center px-4 pb-8 ${mensajesChat.length > 0 ? 'min-h-[calc(100vh-8rem)] justify-end' : 'pt-16 md:pt-24'}`}>
              {mensajesChat.length === 0 && (
                <>
                  <AtiendeWordmark className="mb-6" markClassName="h-9 w-auto" animado />
                  <h1 className="text-2xl font-semibold text-foreground mb-2">Pregunta a tus datos</h1>
                  <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
                    Tu operación, con la cifra que ya calculó el sistema — pregunta por pedidos de {restaurantName ?? "tu restaurante"}.
                  </p>
                </>
              )}

              {/* Hilo de conversación — burbuja del usuario a la derecha,
                  respuesta del asistente como texto plano + resultado
                  (tabla de pedidos con hairline punteado, o gráfica),
                  igual al estilo de respuesta de Likida. */}
              {mensajesChat.length > 0 && (
                <div className="w-full max-w-2xl space-y-5 mb-6">
                  {mensajesChat.map((m, i) => (
                    m.rol === 'usuario' ? (
                      <div key={i} className="flex justify-end">
                        <div className="max-w-[80%] bg-card border border-border rounded-2xl px-4 py-2 text-sm text-foreground shadow-sm">
                          {m.texto}
                        </div>
                      </div>
                    ) : (
                      <div key={i} className="space-y-3">
                        <div className="flex items-start gap-2">
                          <AtiendeMark className="h-4 w-auto shrink-0 mt-0.5" />
                          <p className="text-sm text-foreground leading-relaxed">{m.texto}</p>
                        </div>

                        {m.mostrarGrafica && (
                          <Card>
                            <CardContent className="pt-4">
                              <div className="h-[180px]">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={salesTrendData}>
                                    <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: "IBM Plex Mono, ui-monospace, monospace", fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                                    <YAxis tick={{ fontSize: 10, fontFamily: "IBM Plex Mono, ui-monospace, monospace", fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                                    <Tooltip
                                      {...tooltipEstiloCompartido}
                                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Ventas']}
                                    />
                                    <Line type="monotone" dataKey="ventas" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 3 }} activeDot={{ r: 5, fill: 'hsl(var(--primary))' }} isAnimationActive animationDuration={450} animationEasing="ease-out" />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {m.pedidos && m.pedidos.length > 0 && (
                          <Card>
                            <CardContent className="pt-4">
                              <ul className="space-y-2 text-sm">
                                {m.pedidos.slice(0, 10).map((o) => (
                                  <li key={o.id} className="flex justify-between border-b border-dashed border-border last:border-0 pb-2">
                                    <span>{o.customer_name} · {new Date(o.created_at).toLocaleString("es-MX")}</span>
                                    <span className="font-mono tabular-nums text-muted-foreground">${Number(o.total).toLocaleString("es-MX")}</span>
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        )}

                        {(m.mostrarGrafica || (m.pedidos && m.pedidos.length > 0)) && (
                          <button
                            onClick={() => descargarPdfRespuesta(mensajesChat[i - 1]?.texto ?? '', m.texto, m.pedidos)}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-6"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                            Descargar PDF
                          </button>
                        )}
                      </div>
                    )
                  ))}

                  {pensando && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AtiendeMark className="h-4 w-auto atiende-respira shrink-0" />
                      <span>{fasePensando}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Vista por categoría — sólo cuando se aprieta Consulta con
                  el campo vacío (en reposo o a mitad de un chat). Va ARRIBA
                  del input; si hay conversación, el hilo se recorre hacia
                  arriba solo, por el layout justify-end, para hacerle lugar. */}
              <AnimatePresence>
                {mostrarSugerencias && (
                  <motion.div
                    key="categorias"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl mb-5"
                  >
                    {categoriasPreguntasRestaurante.map((cat) => (
                      <div key={cat.titulo} className="rounded-xl border border-border bg-card p-3">
                        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground mb-2">{cat.titulo}</p>
                        <div className="space-y-1">
                          {cat.preguntas.map((p) => (
                            <button
                              key={p}
                              onClick={() => responderPreguntaLocal(p)}
                              className="w-full text-left text-sm text-foreground rounded-lg px-2 py-1.5 hover:bg-muted transition-colors"
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!pregunta.trim()) { setMostrarSugerencias((v) => !v); return; }
                  responderPreguntaLocal(pregunta);
                }}
                className="w-full max-w-xl bg-card border border-border rounded-3xl shadow-sm p-3 shrink-0"
              >
                <input
                  value={pregunta}
                  onChange={(e) => setPregunta(e.target.value)}
                  placeholder="Pregunta sobre tu operación…"
                  className="w-full bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
                />
                {archivoAdjunto && (
                  <div className="flex items-center gap-1.5 mt-1 mb-2 px-2">
                    <span className="text-xs bg-muted rounded-full px-2.5 py-1 text-muted-foreground truncate max-w-[200px]">
                      {archivoAdjunto.name}
                    </span>
                    <button type="button" onClick={() => setArchivoAdjunto(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between mt-1">
                  <button
                    type="submit"
                    disabled={pensando}
                    className="flex items-center gap-1.5 rounded-full bg-foreground text-background text-xs font-medium pl-3 pr-3.5 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Search className="w-3.5 h-3.5" />
                    Consulta
                  </button>
                  <div className="flex items-center gap-1">
                    <label className="p-2 rounded-full text-muted-foreground hover:bg-muted transition-colors cursor-pointer">
                      <Paperclip className="w-4 h-4" />
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => setArchivoAdjunto(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    <Button type="submit" size="icon" disabled={pensando} className="rounded-full shrink-0 w-8 h-8">
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </form>

              {/* Sugerencias sueltas — sólo en reposo, DEBAJO del input,
                  como el estado inicial real de Likida. */}
              {mensajesChat.length === 0 && !mostrarSugerencias && (
                <div className="flex flex-wrap gap-1.5 justify-center mt-4 max-w-xl">
                  {preguntasSugeridasPlano.map((p) => (
                    <button
                      key={p}
                      onClick={() => responderPreguntaLocal(p)}
                      className="text-xs rounded-full px-3 py-1 bg-secondary/10 text-secondary border border-secondary/20 hover:bg-secondary/20 transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {mensajesChat.length === 0 && (
                <p className="text-xs text-muted-foreground text-center mt-8 max-w-lg">
                  Responde con cifras ya calculadas en el servidor — búsqueda simple por ahora, no un motor de
                  lenguaje natural completo. Adjuntar un archivo lo guarda con tu pregunta; todavía no lo leemos
                  ni lo analizamos automáticamente.
                </p>
              )}
            </div>
          </div>
        )}

        {activeSection === 'notificaciones' && (
          <NotificacionesSection userId={user?.id} />
        )}

        {activeSection === 'sucursales' && (
          <SucursalesSection restaurantId={restaurantId} />
        )}

        {activeSection === 'historial-ordenes' && (
          <HistorialOrdenesSection restaurantId={restaurantId} />
        )}

        {activeSection === 'agente-voz' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              {/* Selector de rango — mismo esqueleto que el de ElevenLabs
                  (presets + calendario real), en azul. Filtra la lista de
                  "Llamadas recientes" ya cargada. */}
              <Popover open={mostrarSelectorRango} onOpenChange={(v) => { setMostrarSelectorRango(v); if (v) setRangoAgenteBorrador(rangoAgenteAplicado); }}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 h-7 pl-1 pr-2.5 rounded-full border border-border bg-card text-[11px] text-foreground hover:bg-muted transition-colors">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground">‹</span>
                    <History className="w-3 h-3 text-primary" />
                    <span className="font-medium">{etiquetaRangoAgente}</span>
                    <span className="font-mono text-[9px] text-muted-foreground">· UTC-6</span>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground">›</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0 overflow-hidden">
                  <div className="flex">
                    <div className="w-40 border-r border-border p-1.5 space-y-0.5">
                      {PRESETS_RANGO_AGENTE.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => { setPresetRangoAgente(p.id); setRangoAgenteAplicado(undefined); setMostrarSelectorRango(false); }}
                          className={`w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] text-left transition-colors ${!rangoAgenteAplicado && presetRangoAgente === p.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}
                        >
                          {p.etiqueta}
                          {!rangoAgenteAplicado && presetRangoAgente === p.id && <span className="text-primary">✓</span>}
                        </button>
                      ))}
                    </div>
                    <div className="p-2">
                      <Calendar
                        mode="range"
                        selected={rangoAgenteBorrador}
                        onSelect={setRangoAgenteBorrador}
                        numberOfMonths={1}
                        locale={es}
                      />
                      <div className="flex items-center justify-between px-2 pb-2">
                        <span className="font-mono text-[10px] text-muted-foreground">America/Merida (UTC-6)</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setMostrarSelectorRango(false)}
                            className="h-7 px-3 rounded-full border border-border text-[11px] text-foreground hover:bg-muted transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => { if (rangoAgenteBorrador?.from && rangoAgenteBorrador?.to) setRangoAgenteAplicado(rangoAgenteBorrador); setMostrarSelectorRango(false); }}
                            disabled={!rangoAgenteBorrador?.from || !rangoAgenteBorrador?.to}
                            className="h-7 px-3 rounded-full bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                          >
                            Aplicar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* El widget REAL de ElevenLabs vive montado siempre en la
                página (ver el useEffect de arriba) — trae su propio globo
                flotante abajo a la derecha, y al apretarlo abre su panel
                lateral con el orbe animado y pantalla completa nativos, sin
                que nosotros construyamos nada de eso. "Vista previa" en el
                encabezado solo baja la vista hasta él. */}
            {agentIdActivo && (() => {
              const ConvaiWidget = 'elevenlabs-convai' as any;
              return (
                <ConvaiWidget
                  agent-id={agentIdActivo}
                  avatar-orb-color-1="#1d4ed8"
                  avatar-orb-color-2="#0ea5e9"
                  disable-banner="true"
                  style={vistaPreviaActiva ? { display: 'none' } : undefined}
                />
              );
            })()}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <TileKpiAgente
                indice={0}
                label="Pedidos completados por voz"
                valor={statsAgentes && statsAgentes.voz.total > 0 ? (statsAgentes.voz.completados / statsAgentes.voz.total) * 100 : null}
                meta="90%"
              />
              <TileKpiAgente
                indice={1}
                label="Participación del canal de voz"
                valor={statsAgentes && statsAgentes.totalOrdenes > 0 ? (statsAgentes.voz.total / statsAgentes.totalOrdenes) * 100 : null}
                meta="25%"
              />
              <TileKpiAgente
                indice={2}
                label="Tasa de cancelación (voz)"
                valor={statsAgentes && statsAgentes.voz.total > 0 ? (statsAgentes.voz.cancelados / statsAgentes.voz.total) * 100 : null}
                meta="menos de 5%"
              />
              <TileKpiAgente
                indice={3}
                label="Llamadas contestadas"
                valor={null}
                meta=""
                notaGap="Falta bitácora de llamadas — el agente de voz aún no manda ese evento a Supabase, solo los pedidos que sí se completaron."
              />
              <TileKpiAgente
                indice={4}
                label="Escalación a humano"
                valor={null}
                meta=""
                notaGap="El esquema no tiene una bandera de escalación todavía."
              />
              <TileKpiAgente
                indice={5}
                label="Uso de concurrencia"
                valor={null}
                meta=""
                notaGap="ElevenLabs no manda esto por webhook — se revisa directo en su panel."
              />
            </div>

            <div className="rounded-xl border border-border bg-card p-3 space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Llamadas recientes</p>
              {cargandoAgentes ? (
                <p className="text-[13px] text-muted-foreground py-4 text-center">Cargando…</p>
              ) : ordenesVoz.length === 0 ? (
                <div className="py-6 text-center">
                  <Mic className="w-6 h-6 mx-auto mb-2 text-muted-foreground/30" strokeWidth={1.5} />
                  <p className="text-[13px] text-muted-foreground">Sin llamadas todavía — en cuanto el agente reciba la primera, aparece aquí.</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  {ordenesVoz.map((o) => (
                    <div key={o.id} className="px-3 py-2 flex items-center justify-between border-b border-dashed border-border last:border-0">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{o.customer_name}</p>
                        <p className="text-[11px] text-muted-foreground">{format(new Date(o.created_at), "d MMM yyyy, HH:mm", { locale: es })}</p>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="font-mono tabular-nums text-[13px] text-foreground">${Number(o.total).toLocaleString('es-MX')}</span>
                        {o.call_recording_url ? (
                          <a href={o.call_recording_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-primary hover:underline underline-offset-2">
                            <PlayCircle className="w-3 h-3" /> Grabación
                          </a>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/60">Sin grabación</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === 'agente-whatsapp' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-[13px] text-muted-foreground">
                Desempeño real del bot de WhatsApp — se llena solo con la actividad real, sin datos de ejemplo. Se actualiza sola.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <TileKpiAgente
                indice={0}
                label="Conversaciones que llegaron a pedido"
                valor={conversacionesWhatsapp && conversacionesWhatsapp.total > 0 ? (conversacionesWhatsapp.conPedido / conversacionesWhatsapp.total) * 100 : null}
                meta="40%"
              />
              <TileKpiAgente
                indice={1}
                label="Participación del canal de WhatsApp"
                valor={statsAgentes && statsAgentes.totalOrdenes > 0 ? (statsAgentes.whatsapp.total / statsAgentes.totalOrdenes) * 100 : null}
                meta="35%"
              />
              <TileKpiAgente
                indice={2}
                label="Tasa de cancelación (WhatsApp)"
                valor={statsAgentes && statsAgentes.whatsapp.total > 0 ? (statsAgentes.whatsapp.cancelados / statsAgentes.whatsapp.total) * 100 : null}
                meta="menos de 5%"
              />
              <TileKpiAgente
                indice={3}
                label="Mensajes promedio por conversación"
                valor={conversacionesWhatsapp && conversacionesWhatsapp.total > 0 ? conversacionesWhatsapp.promedioMensajes : null}
                meta="8 mensajes"
                sufijo=""
              />
              <TileKpiAgente
                indice={4}
                label="Tiempo de primera respuesta"
                valor={null}
                meta=""
                notaGap="El esquema guarda el arreglo de mensajes, no cuándo respondió el bot a cada uno."
              />
              <TileKpiAgente
                indice={5}
                label="Escalación a humano"
                valor={null}
                meta=""
                notaGap="El esquema no tiene una bandera de escalación todavía."
              />
            </div>

            <div className="rounded-xl border border-border bg-card p-3 space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Pedidos recientes por WhatsApp</p>
              {cargandoAgentes ? (
                <p className="text-[13px] text-muted-foreground py-4 text-center">Cargando…</p>
              ) : ordenesWhatsapp.length === 0 ? (
                <div className="py-6 text-center">
                  <MessageCircle className="w-6 h-6 mx-auto mb-2 text-muted-foreground/30" strokeWidth={1.5} />
                  <p className="text-[13px] text-muted-foreground">Sin pedidos por WhatsApp todavía — en cuanto entre el primero, aparece aquí.</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  {ordenesWhatsapp.map((o) => (
                    <div key={o.id} className="px-3 py-2 flex items-center justify-between border-b border-dashed border-border last:border-0">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{o.customer_name}</p>
                        <p className="text-[11px] text-muted-foreground">{format(new Date(o.created_at), "d MMM yyyy, HH:mm", { locale: es })}</p>
                      </div>
                      <span className="font-mono tabular-nums text-[13px] text-foreground shrink-0">${Number(o.total).toLocaleString('es-MX')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <WhatsAppAgenteConfigSection restaurantId={restaurantId} />

            <WidgetWhatsApp restaurantName={restaurantName ?? 'Los Taquitos de PM'} />
          </div>
        )}

        {activeSection === 'agente-voz-dashboard' && (
          <DashboardAgente
            restaurantId={restaurantId}
            canal="voz"
            onCerrar={() => setActiveSection('agente-voz')}
            nombreAgente={sucursalSeleccionada === 'global' ? 'Todas las sucursales' : (sucursalConAgente?.name ?? 'tu sucursal')}
            statsAgentes={statsAgentes}
            sucursalesAgente={sucursalesAgente}
            sucursalSeleccionada={sucursalSeleccionada}
            onCambiarSucursal={setSucursalSeleccionada}
            presets={PRESETS_RANGO_AGENTE}
            presetActivo={presetRangoAgente}
            onCambiarPreset={(id) => { setPresetRangoAgente(id); setRangoAgenteAplicado(undefined); }}
            agentId={agentIdActivo}
          />
        )}

        {activeSection === 'agente-whatsapp-dashboard' && (
          <DashboardAgente
            restaurantId={restaurantId}
            canal="whatsapp"
            onCerrar={() => setActiveSection('agente-whatsapp')}
            nombreAgente={sucursalSeleccionadaWhatsapp === 'global' ? (restaurantName ?? 'Todas las sucursales') : (sucursalesAgente.find((s) => s.id === sucursalSeleccionadaWhatsapp)?.name ?? 'tu sucursal')}
            statsAgentes={statsAgentes}
            mensajesPromedioWhatsapp={conversacionesWhatsapp?.promedioMensajes ?? null}
            sucursalesAgente={sucursalesAgente}
            sucursalSeleccionada={sucursalSeleccionadaWhatsapp}
            onCambiarSucursal={setSucursalSeleccionadaWhatsapp}
            presets={PRESETS_RANGO_AGENTE}
            presetActivo={presetRangoAgente}
            onCambiarPreset={(id) => { setPresetRangoAgente(id); setRangoAgenteAplicado(undefined); }}
          />
        )}

          </main>

          {/* Panel de historial de "Pregunta a tus datos" — vive fuera de
              <main> y se posiciona contra ESTE wrapper (header+main juntos,
              overflow-hidden + rounded-2xl ya probado con Vista previa)
              en vez de contra el div interno de la sección, cuya altura
              real depende del contenido del chat y se quedaba corto. */}
          {activeSection === 'pregunta' && mostrarHistorial && (
            <div className="absolute right-3 inset-y-3 z-20 w-72 max-w-[85vw] bg-card border border-border rounded-2xl shadow-xl flex flex-col overflow-hidden">
              <div className="p-3 flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { setMensajesChat([]); setMostrarHistorial(false); setMostrarSugerencias(false); }}
                  className="flex-1 flex items-center gap-2 px-3 py-2 rounded-full border border-border/60 hover:bg-muted transition-colors text-sm font-medium text-foreground"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Nuevo chat
                </button>
                <button
                  onClick={() => setMostrarHistorial(false)}
                  className="w-8 h-8 rounded-md border border-border/60 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>
              <div className="px-3 pb-3 shrink-0">
                <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-2">
                  <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <input
                    value={busquedaHistorial}
                    onChange={(e) => setBusquedaHistorial(e.target.value)}
                    placeholder="Buscar chats"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              <p className="px-4 pb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground shrink-0">
                Recientes
              </p>
              <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
                {historialFiltrado.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-2 py-2">
                    {historialPreguntas.length === 0 ? 'Sin chats recientes.' : 'Sin resultados.'}
                  </p>
                ) : (
                  historialFiltrado.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => { setMostrarHistorial(false); responderPreguntaLocal(h); }}
                      className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-muted transition-colors truncate text-foreground"
                    >
                      {h}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {vistaPreviaActiva && (
            <VistaPreviaAgentePantallaCompleta
              onCerrar={() => setVistaPreviaActiva(false)}
              nombreAgente="Agente de voz"
              nombreSucursal={sucursalConAgente?.name ?? 'Sucursal'}
              agentId={agentIdActivo}
            />
          )}
        </div>
      </div>
    </div>;
};
export default AdminDashboard;
