import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Package, DollarSign, Users, ShoppingCart, Plus, Edit, Trash2, Tag, Upload, Loader2, Menu, X, Truck, Phone, MapPin, Percent, TrendingUp, TrendingDown, Eye, MessageCircle, Bell, Search, Paperclip, History, ArrowUp, FileDown, RefreshCw, ChevronUp, ChevronDown, PanelRightClose, LayoutGrid, HelpCircle, Info, ChevronRight, Mic, PlayCircle, Clock, Store, Globe } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { format, subDays, subWeeks, subMonths, subYears, startOfDay, startOfWeek, startOfMonth, startOfYear, isAfter } from "date-fns";
import { es } from "date-fns/locale";
import AdminSidebar from "@/components/admin/AdminSidebar";
import NotificacionesSection from "@/components/admin/NotificacionesSection";
import { StatCard } from "@/components/admin/ui/StatCard";
import { AtiendeMark, AtiendeWordmark } from "@/components/AtiendeLogo";
import { CampoPixeles } from "@/components/CampoPixeles";
const ADMIN_EMAIL = "javiercamaraportepetit@gmail.com";
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

const AdminDashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [repartidores, setRepartidores] = useState<Repartidor[]>([]);
  const [stats, setStats] = useState({
    revenue: 0,
    customers: 0,
    orders: 0,
    products: 0,
    users: 0
  });
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: "",
    image_url: "",
    category_id: "",
    is_popular: false,
    is_available: true
  });
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    slug: ""
  });
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
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<'today' | '7' | '30' | '90' | '180' | '365' | 'historico'>('today');
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);

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
  // solo la sucursal que de verdad tiene uno configurado (branches.elevenlabs_agent_id)
  // puede abrir la Vista previa.
  const [sucursalesAgente, setSucursalesAgente] = useState<{ id: string; name: string; elevenlabs_agent_id: string | null }[]>([]);
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState<string>('global');
  const [mostrarSelectorSucursal, setMostrarSelectorSucursal] = useState(false);
  const [mostrarVistaPrevia, setMostrarVistaPrevia] = useState(false);

  // Sucursal con agente real para la Vista previa: la seleccionada si tiene
  // uno, o la primera que sí tenga cuando el filtro está en "global".
  const sucursalConAgente = sucursalSeleccionada === 'global'
    ? sucursalesAgente.find((s) => s.elevenlabs_agent_id)
    : sucursalesAgente.find((s) => s.id === sucursalSeleccionada);
  const agentIdActivo = sucursalConAgente?.elevenlabs_agent_id ?? null;

  // El widget real de ElevenLabs (mismo componente que usan ellos mismos,
  // no una recreación) — se carga una sola vez cuando se abre la Vista
  // previa por primera vez.
  useEffect(() => {
    if (!mostrarVistaPrevia) return;
    if (document.getElementById('elevenlabs-convai-script')) return;
    const script = document.createElement('script');
    script.id = 'elevenlabs-convai-script';
    script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
    script.async = true;
    document.body.appendChild(script);
  }, [mostrarVistaPrevia]);

  const cargarDatosAgentes = async (branchId?: string) => {
    if (!restaurantId) return;
    setCargandoAgentes(true);
    const sb: any = supabase;
    const filtroSucursal = branchId && branchId !== 'global' ? { branch_id: branchId } : null;
    const conFiltro = (q: any) => (filtroSucursal ? q.eq('branch_id', filtroSucursal.branch_id) : q);

    const [{ count: totalOrdenes }, { count: vozTotal }, { count: vozCompletados }, { count: vozCancelados },
      { count: waTotal }, { count: waCompletados }, { count: waCancelados },
      { data: vozRecientes }, { data: waRecientes }, { data: sucursales },
      { data: todasLasOrdenes }] = await Promise.all([
      conFiltro(sb.from("orders").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId)),
      conFiltro(sb.from("orders").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).eq("source", "voice")),
      conFiltro(sb.from("orders").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).eq("source", "voice").in("status", ["completado", "entregado"])),
      conFiltro(sb.from("orders").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).eq("source", "voice").eq("status", "cancelado")),
      conFiltro(sb.from("orders").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).eq("source", "whatsapp")),
      conFiltro(sb.from("orders").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).eq("source", "whatsapp").in("status", ["completado", "entregado"])),
      conFiltro(sb.from("orders").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).eq("source", "whatsapp").eq("status", "cancelado")),
      conFiltro(sb.from("orders").select("*").eq("restaurant_id", restaurantId).eq("source", "voice").order("created_at", { ascending: false }).limit(8)),
      conFiltro(sb.from("orders").select("*").eq("restaurant_id", restaurantId).eq("source", "whatsapp").order("created_at", { ascending: false }).limit(8)),
      sb.from("branches").select("id, name, elevenlabs_agent_id").eq("restaurant_id", restaurantId).order("display_order"),
      // Ingreso real por canal — se necesita el total de cada pedido, no solo
      // el conteo, así que aquí sí se trae `total` y `source` de todas las
      // filas (a diferencia de los counts de arriba, que no bajan datos).
      conFiltro(sb.from("orders").select("total, source").eq("restaurant_id", restaurantId)),
    ]);

    setSucursalesAgente(sucursales ?? []);

    const filasIngreso: { total: number; source: string | null }[] = todasLasOrdenes ?? [];
    const ingresoTotal = filasIngreso.reduce((s, o) => s + Number(o.total), 0);
    const ingresoVoz = filasIngreso.filter((o) => o.source === 'voice').reduce((s, o) => s + Number(o.total), 0);
    const ingresoWhatsapp = filasIngreso.filter((o) => o.source === 'whatsapp').reduce((s, o) => s + Number(o.total), 0);

    setStatsAgentes({
      totalOrdenes: totalOrdenes ?? 0,
      ingresoTotal,
      voz: { total: vozTotal ?? 0, completados: vozCompletados ?? 0, cancelados: vozCancelados ?? 0, ingreso: ingresoVoz },
      whatsapp: { total: waTotal ?? 0, completados: waCompletados ?? 0, cancelados: waCancelados ?? 0, ingreso: ingresoWhatsapp },
    });
    setOrdenesVoz(vozRecientes ?? []);
    setOrdenesWhatsapp(waRecientes ?? []);

    const idsSucursales = filtroSucursal
      ? [filtroSucursal.branch_id]
      : (sucursales ?? []).map((s: { id: string }) => s.id);
    if (idsSucursales.length > 0) {
      const { data: conversaciones } = await sb
        .from("whatsapp_conversations")
        .select("id, messages, order_id")
        .in("branch_id", idsSucursales);
      const lista = conversaciones ?? [];
      const conPedido = lista.filter((c: { order_id: string | null }) => c.order_id).length;
      const totalMensajes = lista.reduce((suma: number, c: { messages: unknown }) => suma + (Array.isArray(c.messages) ? c.messages.length : 0), 0);
      setConversacionesWhatsapp({
        total: lista.length,
        conPedido,
        promedioMensajes: lista.length > 0 ? totalMensajes / lista.length : 0,
      });
    } else {
      setConversacionesWhatsapp({ total: 0, conPedido: 0, promedioMensajes: 0 });
    }

    setCargandoAgentes(false);
  };

  useEffect(() => {
    if ((activeSection === 'agente-voz' || activeSection === 'agente-whatsapp' || activeSection === 'dashboard') && restaurantId) {
      cargarDatosAgentes(sucursalSeleccionada);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, restaurantId, sucursalSeleccionada]);
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
          setProductForm({
            name: "",
            description: "",
            price: "",
            image_url: "",
            category_id: "",
            is_popular: false,
            is_available: true
          });
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
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Solo se permiten imágenes",
        variant: "destructive"
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "La imagen no puede superar 5MB",
        variant: "destructive"
      });
      return;
    }
    setUploadingImage(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const {
      data,
      error
    } = await supabase.storage.from('product-images').upload(fileName, file);
    if (error) {
      toast({
        title: "Error al subir imagen",
        description: error.message,
        variant: "destructive"
      });
      setUploadingImage(false);
      return;
    }
    const {
      data: {
        publicUrl
      }
    } = supabase.storage.from('product-images').getPublicUrl(fileName);
    setProductForm({
      ...productForm,
      image_url: publicUrl
    });
    toast({
      title: "¡Imagen subida!",
      description: "La imagen se subió correctamente"
    });
    setUploadingImage(false);
  };
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (!session || session.user.email !== ADMIN_EMAIL) {
        navigate("/admin/login");
        return;
      }
      setUser(session.user);
      supabase.from("profiles").select("nombre").eq("user_id", session.user.id).maybeSingle()
        .then(({ data: profile }) => {
          setNombreAdmin(profile?.nombre || (session.user.email ?? "").split("@")[0]);
        });

      // Un superadmin llega aquí con "?restaurante=<id>" desde "Ver cuenta"
      // en su panel — ve esa cuenta puntual. Sin ese parámetro, se resuelve
      // el restaurante propio desde restaurant_staff (dueño/staff normal).
      const paramRestaurantId = searchParams.get("restaurante");
      let effectiveRestaurantId = paramRestaurantId;
      if (!effectiveRestaurantId) {
        const { data: staffRow } = await supabase
          .from("restaurant_staff")
          .select("restaurant_id")
          .eq("user_id", session.user.id)
          .maybeSingle();
        effectiveRestaurantId = staffRow?.restaurant_id ?? null;
      }
      setRestaurantId(effectiveRestaurantId);
      if (effectiveRestaurantId) {
        const { data: r } = await supabase.from("restaurants").select("name").eq("id", effectiveRestaurantId).maybeSingle();
        setRestaurantName(r?.name ?? null);
      }

      await fetchData(effectiveRestaurantId);
      setLoading(false);
    };
    checkAuth();
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session || session.user?.email !== ADMIN_EMAIL) {
        navigate("/admin/login");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Se refresca solo cada 60s mientras se ve el dashboard, además del
  // refresco manual — el botón bajo "Actualizado" refleja el estado real de
  // la recarga (no es decorativo).
  useEffect(() => {
    if (activeSection !== 'dashboard' || !restaurantId) return;
    const intervalo = setInterval(() => {
      refrescarDatos();
    }, 60000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, restaurantId]);

  const refrescarDatos = async () => {
    setRefrescando(true);
    await fetchData(restaurantId);
    setUltimaActualizacion(new Date());
    setRefrescando(false);
  };

  const saludoHorario = () => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Buenos días';
    if (hora < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };
  const nombreSaludo = nombreAdmin.split(' ').slice(0, 2).join(' ');

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
    const ordersQuery = scopedRestaurantId
      ? sb.from("orders").select("*").order("created_at", { ascending: false }).limit(50).eq("restaurant_id", scopedRestaurantId)
      : sb.from("orders").select("*").order("created_at", { ascending: false }).limit(50);
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
    setStats({
      revenue: 0,
      customers: 0,
      orders: 0,
      products: (productsData || []).length,
      users: (profilesData || []).length
    });
  };
  // Filter orders based on date filter
  const filteredStats = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let prevStartDate: Date;
    let prevEndDate: Date;

    switch (dateFilter) {
      case 'today':
        startDate = startOfDay(now);
        prevEndDate = startOfDay(now);
        prevStartDate = subDays(prevEndDate, 1);
        break;
      case '7':
        startDate = subDays(now, 7);
        prevEndDate = subDays(now, 7);
        prevStartDate = subDays(now, 14);
        break;
      case '30':
        startDate = subDays(now, 30);
        prevEndDate = subDays(now, 30);
        prevStartDate = subDays(now, 60);
        break;
      case '90':
        startDate = subDays(now, 90);
        prevEndDate = subDays(now, 90);
        prevStartDate = subDays(now, 180);
        break;
      case '180':
        startDate = subDays(now, 180);
        prevEndDate = subDays(now, 180);
        prevStartDate = subDays(now, 360);
        break;
      case '365':
        startDate = subDays(now, 365);
        prevEndDate = subDays(now, 365);
        prevStartDate = subDays(now, 730);
        break;
      case 'historico':
        // Sin límite inferior real y sin periodo anterior con el que
        // comparar — "histórico" es un total, no una ventana con antes/después.
        startDate = new Date(0);
        prevEndDate = new Date(0);
        prevStartDate = new Date(0);
        break;
      default:
        startDate = startOfDay(now);
        prevEndDate = startOfDay(now);
        prevStartDate = subDays(prevEndDate, 1);
    }

    // Current period
    const filteredOrders = orders.filter(order =>
      isAfter(new Date(order.created_at), startDate)
    );

    // Previous period
    const prevOrders = dateFilter === 'historico' ? [] : orders.filter(order => {
      const orderDate = new Date(order.created_at);
      return isAfter(orderDate, prevStartDate) && !isAfter(orderDate, prevEndDate);
    });

    const totalRevenue = filteredOrders.reduce((sum, order) => sum + Number(order.total), 0);
    const uniqueCustomers = new Set(filteredOrders.map(o => o.customer_name)).size;
    const avgOrder = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0;

    const prevRevenue = prevOrders.reduce((sum, order) => sum + Number(order.total), 0);
    const prevUniqueCustomers = new Set(prevOrders.map(o => o.customer_name)).size;
    const prevAvgOrder = prevOrders.length > 0 ? prevRevenue / prevOrders.length : 0;

    // Calculate percentage changes
    const calcChange = (current: number, prev: number) => {
      if (prev === 0) return current > 0 ? 100 : 0;
      return ((current - prev) / prev) * 100;
    };

    return {
      revenue: totalRevenue,
      orders: filteredOrders.length,
      customers: uniqueCustomers,
      averageOrder: avgOrder,
      revenueChange: calcChange(totalRevenue, prevRevenue),
      ordersChange: calcChange(filteredOrders.length, prevOrders.length),
      customersChange: calcChange(uniqueCustomers, prevUniqueCustomers),
      avgOrderChange: calcChange(avgOrder, prevAvgOrder)
    };
  }, [orders, dateFilter]);

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

  // Sales trend chart data — un solo control de fecha (dateFilter) maneja
  // "Tus ventas" (filteredStats, arriba) y "Tendencias" (esta gráfica).
  const salesTrendData = useMemo(() => {
    const now = new Date();
    let intervals: Date[] = [];
    let groupFormat: string;
    let esHora = false;
    let esMes = false;
    let esSemanal90 = false;

    switch (dateFilter) {
      case 'today':
        for (let i = 23; i >= 0; i--) intervals.push(new Date(now.getTime() - i * 60 * 60 * 1000));
        groupFormat = 'HH:00';
        esHora = true;
        break;
      case '7':
        for (let i = 6; i >= 0; i--) intervals.push(subDays(now, i));
        groupFormat = 'EEE';
        break;
      case '30':
        for (let i = 29; i >= 0; i--) intervals.push(subDays(now, i));
        groupFormat = 'dd MMM';
        break;
      case '90':
        for (let i = 89; i >= 0; i -= 7) intervals.push(subDays(now, i));
        groupFormat = 'dd MMM';
        esSemanal90 = true;
        break;
      case '180':
        for (let i = 25; i >= 0; i--) intervals.push(subDays(now, i * 7));
        groupFormat = 'dd MMM';
        esSemanal90 = true;
        break;
      case '365':
        for (let i = 11; i >= 0; i--) intervals.push(subMonths(now, i));
        groupFormat = 'MMM yy';
        esMes = true;
        break;
      case 'historico':
      default: {
        // Histórico: un punto por mes desde el pedido más antiguo (tope de
        // 36 meses para no dibujar de más si hay años de datos).
        const fechas = orders.map((o) => new Date(o.created_at).getTime());
        const inicio = fechas.length > 0 ? new Date(Math.min(...fechas)) : now;
        const mesesDesdeInicio = Math.min(
          36,
          Math.max(0, (now.getFullYear() - inicio.getFullYear()) * 12 + (now.getMonth() - inicio.getMonth()))
        );
        for (let i = mesesDesdeInicio; i >= 0; i--) intervals.push(subMonths(now, i));
        groupFormat = 'MMM yy';
        esMes = true;
      }
    }

    return intervals.map(date => {
      const label = format(date, groupFormat, { locale: es });
      let revenue = 0;
      let orderCount = 0;

      orders.forEach(order => {
        const orderDate = new Date(order.created_at);
        let matches = false;

        if (esHora) {
          matches = format(orderDate, 'yyyy-MM-dd HH') === format(date, 'yyyy-MM-dd HH');
        } else if (esMes) {
          matches = format(orderDate, 'yyyy-MM') === format(date, 'yyyy-MM');
        } else if (esSemanal90) {
          const weekStart = startOfDay(date);
          const weekEnd = subDays(weekStart, -7);
          matches = isAfter(orderDate, weekStart) && !isAfter(orderDate, weekEnd);
        } else {
          matches = format(orderDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
        }

        if (matches) {
          revenue += Number(order.total);
          orderCount += 1;
        }
      });

      return { name: label, ventas: revenue, ordenes: orderCount };
    });
  }, [orders, dateFilter]);

  const getChartData = useMemo(() => {
    if (!selectedStat) return [];
    const now = new Date();
    let startDate: Date;
    let groupFormat: string;
    let intervals: Date[] = [];
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
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const productData = {
      name: productForm.name,
      description: productForm.description || null,
      price: parseFloat(productForm.price),
      image_url: productForm.image_url || null,
      category_id: productForm.category_id || null,
      is_popular: productForm.is_popular,
      is_available: productForm.is_available
    };
    if (editingProduct) {
      const {
        error
      } = await supabase.from("products").update(productData).eq("id", editingProduct.id);
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
        description: "Producto actualizado correctamente"
      });
    } else {
      const {
        error
      } = await supabase.from("products").insert(restaurantId ? { ...productData, restaurant_id: restaurantId } : productData);
      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
        return;
      }
      toast({
        title: "¡Agregado!",
        description: "Producto agregado correctamente"
      });
    }
    setProductDialogOpen(false);
    setEditingProduct(null);
    resetProductForm();
    await fetchData(restaurantId);
  };
  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || "",
      price: product.price.toString(),
      image_url: product.image_url || "",
      category_id: product.category_id || "",
      is_popular: product.is_popular || false,
      is_available: product.is_available ?? true
    });
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
  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const {
      error
    } = await supabase.from("categories").insert({
      name: categoryForm.name,
      slug: categoryForm.slug.toLowerCase().replace(/\s+/g, "-"),
      ...(restaurantId ? { restaurant_id: restaurantId } : {}),
    });
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
      description: "Categoría agregada correctamente"
    });
    setCategoryDialogOpen(false);
    setCategoryForm({
      name: "",
      slug: ""
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
  const resetProductForm = () => {
    setProductForm({
      name: "",
      description: "",
      price: "",
      image_url: "",
      category_id: "",
      is_popular: false,
      is_available: true
    });
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
        <div className="hidden md:flex flex-1 min-w-0 rounded-2xl border border-border bg-card overflow-hidden flex-col">
          {activeSection !== 'pregunta' && (
            <header className="flex items-center justify-between h-12 px-4 shrink-0 border-b border-border bg-card">
              <h1 className="flex items-center gap-2 text-sm font-medium text-foreground">
                {activeSection === 'dashboard' && (<><LayoutGrid className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Estadísticas</>)}
                {activeSection === 'products' && (<><Package className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Productos</>)}
                {activeSection === 'categories' && (<><Tag className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Categorías</>)}
                {activeSection === 'promos' && (<><Percent className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Promociones</>)}
                {activeSection === 'orders' && (<><ShoppingCart className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Pedidos</>)}
                {activeSection === 'users' && (<><Users className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Usuarios</>)}
                {activeSection === 'repartidores' && (<><Truck className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Repartidores</>)}
                {activeSection === 'notificaciones' && (<><Bell className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Notificaciones</>)}
                {activeSection === 'help' && (<><HelpCircle className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Centro de Ayuda</>)}
                {activeSection === 'agente-voz' && (<><Mic className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Agente de voz</>)}
                {activeSection === 'agente-whatsapp' && (<><MessageCircle className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} /> Agente de WhatsApp</>)}
              </h1>
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
                  <button className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0">
                    <Bell className="w-4 h-4" strokeWidth={1.75} />
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Lista de Productos ({products.length})
              </h2>
              <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingProduct(null); resetProductForm(); }} className="bg-primary hover:bg-primary/90">
                    <Plus className="w-4 h-4 mr-2" /> Agregar
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
            
            {products.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No hay productos registrados</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="p-4 flex items-center justify-between border-b border-dashed border-border last:border-0 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-4">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Package className="w-6 h-6 text-primary" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-foreground">{product.name}</p>
                        <p className="text-sm text-foreground">${product.price}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${product.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {product.is_available ? 'Disponible' : 'No disponible'}
                      </span>
                      <Button variant="ghost" size="icon" onClick={() => handleEditProduct(product)} className="hover:bg-blue-50">
                        <Edit className="w-4 h-4 text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(product.id)} className="hover:bg-red-50">
                        <Trash2 className="w-4 h-4 stroke-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}

        {/* Categories Section */}
        {activeSection === 'categories' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Tag className="w-5 h-5 text-primary" />
                Lista de Categorías ({categories.length})
              </h2>
              <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90">
                    <Plus className="w-4 h-4 mr-2" /> Agregar
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
            
            {categories.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Tag className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No hay categorías registradas</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                {categories.map((category, index) => {
                  const productosCategoria = products.filter((p) => p.category_id === category.id);
                  const expandida = categoriaExpandida === category.id;
                  return (
                    <div key={category.id} className="border-b border-dashed border-border last:border-0">
                      <div className="p-4 flex items-center justify-between transition-colors hover:bg-muted/40">
                        <button
                          onClick={() => setCategoriaExpandida(expandida ? null : category.id)}
                          className="flex items-center gap-4 text-left flex-1 min-w-0"
                        >
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Tag className="w-6 h-6 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-base font-semibold text-foreground truncate">{category.name}</p>
                            <p className="text-sm text-muted-foreground truncate">{category.slug} · {productosCategoria.length} producto{productosCategoria.length === 1 ? '' : 's'}</p>
                          </div>
                        </button>
                        <div className="flex items-center gap-3 shrink-0">
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
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
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
                        <div className="px-4 pb-4 pl-[4.5rem]">
                          {productosCategoria.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">Esta categoría no tiene productos todavía.</p>
                          ) : (
                            <div className="rounded-xl border border-border overflow-hidden">
                              {productosCategoria.map((p) => (
                                <div key={p.id} className="flex items-center justify-between px-3 py-2 border-b border-dashed border-border last:border-0 text-sm">
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
              </Card>
            )}
          </div>
        )}

        {/* Orders Section */}
        {activeSection === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                Lista de Pedidos ({orders.length})
              </h2>
            </div>
            
            {orders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No hay pedidos registrados</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="p-4 flex items-center justify-between border-b border-dashed border-border last:border-0 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <ShoppingCart className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{order.customer_name}</p>
                        <p className="text-sm text-foreground">
                          {format(new Date(order.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-bold text-foreground">${order.total.toLocaleString()}</p>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        order.status === 'completado' || order.status === 'entregado'
                          ? 'bg-green-100 text-green-700'
                          : order.status === 'en_camino'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {order.status === 'completado' || order.status === 'entregado' ? 'Entregado' : order.status === 'en_camino' ? 'En camino' : 'Pendiente'}
                      </span>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}

        {/* Users Section */}
        {activeSection === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Lista de Usuarios ({profiles.length})
              </h2>
            </div>
            
            {profiles.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No hay usuarios registrados</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="p-4 flex items-center justify-between border-b border-dashed border-border last:border-0 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{profile.nombre || 'Sin nombre'}</p>
                        <p className="text-sm text-foreground">{profile.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {profile.telefono && (
                        <div className="flex items-center gap-2 text-sm text-foreground">
                          <Phone className="w-4 h-4" />
                          {profile.telefono}
                        </div>
                      )}
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        Activo
                      </span>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}

        {/* Promos Section */}
        {activeSection === 'promos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Percent className="w-5 h-5 text-primary" />
                Lista de Promociones ({promos.length})
              </h2>
              <Dialog open={promoDialogOpen} onOpenChange={setPromoDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingPromo(null); setPromoForm({ title: '', description: '', image_url: '', discount_text: '', is_active: true }); }} className="bg-primary hover:bg-primary/90">
                    <Plus className="w-4 h-4 mr-2" /> Agregar
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
            
            {promos.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Percent className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No hay promociones registradas</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                {promos.map((promo) => (
                  <div
                    key={promo.id}
                    className="p-4 flex items-center justify-between border-b border-dashed border-border last:border-0 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-4">
                      {promo.image_url ? (
                        <img src={promo.image_url} alt={promo.title} className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Percent className="w-6 h-6 text-primary" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-foreground">{promo.title}</p>
                        {promo.discount_text && <p className="text-sm text-foreground">{promo.discount_text}</p>}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${promo.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {promo.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                ))}
              </Card>
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" />
                Lista de Repartidores ({repartidores.length})
              </h2>
            </div>
            
            {repartidores.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Truck className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No hay repartidores registrados</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Los usuarios pueden registrarse como repartidores desde la página de registro
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                {repartidores.map((repartidor) => (
                  <div
                    key={repartidor.user_id}
                    className="p-4 flex items-center justify-between border-b border-dashed border-border last:border-0 cursor-pointer transition-all hover:bg-muted/40 hover:-translate-y-0.5"
                    onClick={() => navigate(`/admin/repartidor/${repartidor.user_id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Truck className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          {repartidor.nombre || 'Sin nombre'}
                        </p>
                        <p className="text-sm text-foreground">{repartidor.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {repartidor.telefono && (
                        <div className="flex items-center gap-2 text-sm text-foreground">
                          <Phone className="w-4 h-4" />
                          {repartidor.telefono}
                        </div>
                      )}
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        Activo
                      </span>
                    </div>
                  </div>
                ))}
              </Card>
            )}
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
            {mostrarHistorial && (
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
          <div className="max-w-xl">
            <NotificacionesSection userId={user?.id} />
          </div>
        )}

        {activeSection === 'agente-voz' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-[13px] text-muted-foreground truncate">
                  Desempeño real de tu agente de voz — se llena solo con la actividad real, sin datos de ejemplo.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 relative">
                {/* Selector de sucursal — Global o una puntual, para ver las
                    cifras acotadas a esa sucursal. */}
                <button
                  onClick={() => setMostrarSelectorSucursal((v) => !v)}
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-border text-[11px] text-foreground hover:bg-muted transition-colors"
                >
                  {sucursalSeleccionada === 'global' ? <Globe className="w-3 h-3 text-muted-foreground" /> : <Store className="w-3 h-3 text-muted-foreground" />}
                  {sucursalSeleccionada === 'global' ? 'Global' : (sucursalesAgente.find((s) => s.id === sucursalSeleccionada)?.name ?? 'Sucursal')}
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </button>
                {mostrarSelectorSucursal && (
                  <div className="absolute right-0 top-9 z-30 w-52 rounded-xl border border-border bg-card shadow-lg p-1">
                    <button
                      onClick={() => { setSucursalSeleccionada('global'); setMostrarSelectorSucursal(false); }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] text-left transition-colors ${sucursalSeleccionada === 'global' ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}
                    >
                      <Globe className="w-3.5 h-3.5 shrink-0" /> Global (todas)
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
                <button
                  onClick={() => setMostrarVistaPrevia(true)}
                  disabled={!agentIdActivo}
                  title={agentIdActivo ? undefined : 'Esta sucursal todavía no tiene un agente de voz configurado'}
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-foreground text-background text-[11px] font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <PlayCircle className="w-3 h-3" /> Vista previa
                </button>
                <button
                  onClick={() => cargarDatosAgentes(sucursalSeleccionada)}
                  disabled={cargandoAgentes}
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-border text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-70"
                >
                  <RefreshCw className={`w-3 h-3 ${cargandoAgentes ? 'animate-spin' : ''}`} />
                  {cargandoAgentes ? 'Actualizando…' : 'Actualizar'}
                </button>
              </div>
            </div>

            {/* Vista previa real — el widget embebible oficial de ElevenLabs
                (el mismo componente que usan ellos, no una recreación): trae
                su propio globo flotante, animación del orbe, y botón de
                pantalla completa nativos. */}
            {mostrarVistaPrevia && agentIdActivo && (
              <div className="fixed inset-0 z-40 bg-foreground/20 flex items-end justify-end p-4" onClick={() => setMostrarVistaPrevia(false)}>
                <div onClick={(e) => e.stopPropagation()} className="relative">
                  <button
                    onClick={() => setMostrarVistaPrevia(false)}
                    className="absolute -top-3 -left-3 z-50 w-7 h-7 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {(() => {
                    const ConvaiWidget = 'elevenlabs-convai' as any;
                    return <ConvaiWidget agent-id={agentIdActivo} />;
                  })()}
                </div>
              </div>
            )}

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
                Desempeño real del bot de WhatsApp — se llena solo con la actividad real, sin datos de ejemplo.
              </p>
              <button
                onClick={() => cargarDatosAgentes(sucursalSeleccionada)}
                disabled={cargandoAgentes}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-border text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-70 shrink-0"
              >
                <RefreshCw className={`w-3 h-3 ${cargandoAgentes ? 'animate-spin' : ''}`} />
                {cargandoAgentes ? 'Actualizando…' : 'Actualizar'}
              </button>
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
          </div>
        )}

          </main>
        </div>
      </div>
    </div>;
};
export default AdminDashboard;