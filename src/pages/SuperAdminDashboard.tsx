import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeSelector } from "@/components/ThemeSelector";
import { AtiendeMark, AtiendeWordmark } from "@/components/AtiendeLogo";
import { StatCard } from "@/components/admin/ui/StatCard";
import {
  LayoutGrid, Store, Users, LogOut, TrendingUp, Receipt, MessageCircle,
  LifeBuoy, Bell, UserRound, CreditCard, Settings, Send, Search, Paperclip,
  History, X, ArrowUp, PanelLeftClose, PanelLeftOpen, Edit, PanelRightClose,
  FileDown,
} from "lucide-react";
import { CampoPixeles } from "@/components/CampoPixeles";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

interface OrderRow {
  restaurant_id: string;
  total: number;
  status: string | null;
  created_at: string;
}

interface CustomerRow {
  restaurant_id: string;
  name: string | null;
  phone: string;
  order_count: number;
  last_order_at: string | null;
}

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [nombreSaludo, setNombreSaludo] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<"resumen" | "restaurantes" | "clientes" | "pregunta">("resumen");
  const [pregunta, setPregunta] = useState("");
  const [mensajesChat, setMensajesChat] = useState<{ rol: 'usuario' | 'asistente'; texto: string; filas?: (CustomerRow | OrderRow)[] }[]>([]);
  const [pensando, setPensando] = useState(false);
  const [fasePensando, setFasePensando] = useState('');
  const [historial, setHistorial] = useState<string[]>([]);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [busquedaHistorial, setBusquedaHistorial] = useState('');
  const [archivoAdjunto, setArchivoAdjunto] = useState<File | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/admin/login");
        return;
      }
      setUserEmail(session.user.email ?? "");

      const [{ data: r }, { data: o }, { data: c }, { data: profile }] = await Promise.all([
        supabase.from("restaurants").select("id, name, slug, is_active").order("created_at"),
        supabase.from("orders").select("restaurant_id, total, status, created_at"),
        supabase.from("customers").select("restaurant_id, name, phone, order_count, last_order_at").order("last_order_at", { ascending: false }),
        supabase.from("profiles").select("nombre").eq("user_id", session.user.id).maybeSingle(),
      ]);
      const nombreCompleto = profile?.nombre || (session.user.email ?? "").split("@")[0];
      setUserName(nombreCompleto.split(" ")[0]);
      setNombreSaludo(nombreCompleto.split(" ").slice(0, 2).join(" "));
      setRestaurants(r ?? []);
      setOrders(o ?? []);
      setCustomers(c ?? []);
      setLoading(false);
    };
    load();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const saludoHorario = () => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Buenos días';
    if (hora < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const ordersToday = orders.filter((o) => isToday(o.created_at));
  const revenueToday = ordersToday.reduce((sum, o) => sum + Number(o.total), 0);

  const statsByRestaurant = (id: string) => {
    const rOrders = orders.filter((o) => o.restaurant_id === id);
    const rCustomers = customers.filter((c) => c.restaurant_id === id);
    return {
      orders: rOrders.length,
      revenue: rOrders.reduce((s, o) => s + Number(o.total), 0),
      customers: rCustomers.length,
      pending: rOrders.filter((o) => o.status === "pending" || o.status === "preparando").length,
    };
  };

  // Búsqueda simple y determinista sobre los datos ya cargados de TODA la
  // plataforma (no es un motor de lenguaje natural real todavía — mismo
  // criterio honesto que el panel de tenant). Las fases de "pensando" son
  // solo estado de carga, la búsqueda es instantánea.
  const FASES_PENSANDO_SA = ['Leyendo la plataforma…', 'Calculando cifras…', 'Preparando la respuesta…'];

  const responderPregunta = async (qInput: string) => {
    const q = qInput.trim();
    if (!q || pensando) return;
    setHistorial((h) => [q, ...h.filter((x) => x !== q)].slice(0, 20));
    setMostrarHistorial(false);
    setMostrarSugerencias(false);
    setMensajesChat((m) => [...m, { rol: 'usuario', texto: q }]);
    setPregunta('');
    setPensando(true);
    for (const fase of FASES_PENSANDO_SA) {
      setFasePensando(fase);
      await new Promise((r) => setTimeout(r, 260));
    }

    const needle = q.toLowerCase();
    let filas: (CustomerRow | OrderRow)[] | undefined;
    let texto: string;

    if (needle.includes('mrr') || needle.includes('ingreso mensual') || needle.includes('gasto') || needle.includes('costo de ia') || needle.includes('costos')) {
      texto = 'Todavía no rastreamos MRR, gastos ni costo de IA en este panel — sólo pedidos, restaurantes y clientes. En cuanto haya una fuente real (facturación, uso de LLM), se agrega aquí.';
    } else if (needle.includes('pendiente')) {
      filas = orders.filter((o) => o.status === 'pending' || o.status === 'preparando');
      const total = filas.reduce((s, o) => s + Number((o as OrderRow).total), 0);
      texto = filas.length > 0
        ? `Hay ${filas.length} pedido${filas.length === 1 ? '' : 's'} pendiente${filas.length === 1 ? '' : 's'} en toda la plataforma, por $${total.toLocaleString('es-MX')}.`
        : 'No hay pedidos pendientes en ningún restaurante en este momento.';
    } else if (needle.includes('hoy') || needle.includes('vendido') || needle.includes('ingreso')) {
      filas = orders.filter((o) => isToday(o.created_at));
      const total = filas.reduce((s, o) => s + Number((o as OrderRow).total), 0);
      texto = `Hoy entraron ${filas.length} pedido${filas.length === 1 ? '' : 's'} en toda la plataforma, por $${total.toLocaleString('es-MX')}.`;
    } else if (needle.includes('restaurante') || needle.includes('activo')) {
      const activos = restaurants.filter((r) => r.is_active).length;
      texto = `Tienes ${restaurants.length} restaurante${restaurants.length === 1 ? '' : 's'} dado${restaurants.length === 1 ? '' : 's'} de alta, ${activos} activo${activos === 1 ? '' : 's'}.`;
    } else if (needle.includes('recurrente') || (needle.includes('cliente') && needle.includes('mas'))) {
      filas = [...customers].sort((a, b) => b.order_count - a.order_count).slice(0, 10);
      texto = `Estos son tus clientes con más pedidos en toda la plataforma.`;
    } else {
      filas = customers.filter((c) => (c.name ?? '').toLowerCase().includes(needle) || c.phone.includes(needle));
      texto = filas.length > 0
        ? `Encontré ${filas.length} cliente${filas.length === 1 ? '' : 's'} que coincide${filas.length === 1 ? '' : 'n'} con "${q}".`
        : `No encontré clientes que coincidan con "${q}". Pregúntame por pendientes, lo de hoy, restaurantes activos, tus clientes más recurrentes, o un nombre/teléfono.`;
    }

    setMensajesChat((m) => [...m, { rol: 'asistente', texto, filas }]);
    setPensando(false);
  };

  const descargarPdfRespuestaSA = (preguntaTexto: string, texto: string, filas?: (CustomerRow | OrderRow)[]) => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Atiende — Reporte de plataforma', 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(new Date().toLocaleString('es-MX'), 14, 25);
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.text(`Pregunta: ${preguntaTexto}`, 14, 35);
    const textoLineas = doc.splitTextToSize(texto, 180);
    doc.text(textoLineas, 14, 43);
    if (filas && filas.length > 0) {
      const esCliente = 'phone' in filas[0];
      autoTable(doc, {
        startY: 43 + textoLineas.length * 6 + 6,
        head: esCliente ? [['Nombre', 'Teléfono', 'Pedidos']] : [['Fecha', 'Total']],
        body: filas.map((r) =>
          esCliente
            ? [(r as CustomerRow).name || 'Sin nombre', (r as CustomerRow).phone, String((r as CustomerRow).order_count)]
            : [new Date((r as OrderRow).created_at).toLocaleString('es-MX'), `$${Number((r as OrderRow).total).toLocaleString('es-MX')}`]
        ),
        headStyles: { fillColor: [37, 99, 235] },
      });
    }
    doc.save(`atiende-plataforma-${Date.now()}.pdf`);
  };

  const categoriasPreguntasSA = [
    {
      titulo: 'PLATAFORMA Y VENTAS',
      preguntas: ['¿Qué pedidos entraron hoy?', '¿Cuánto llevo vendido hoy?', '¿Cuántos pedidos están pendientes?'],
    },
    {
      titulo: 'RESTAURANTES',
      preguntas: ['¿Cuántos restaurantes activos tengo?'],
    },
    {
      titulo: 'CLIENTES',
      preguntas: ['¿Quiénes son mis clientes más recurrentes?', 'Busca un cliente por nombre o teléfono'],
    },
  ];
  const preguntasSugeridasSAPlano = categoriasPreguntasSA.flatMap((c) => c.preguntas);
  const historialFiltradoSA = historial.filter((h) => h.toLowerCase().includes(busquedaHistorial.toLowerCase()));

  const navItems = [
    { id: "resumen" as const, label: "Resumen", icon: LayoutGrid },
    { id: "pregunta" as const, label: "Pregunta a tus datos", icon: MessageCircle },
    { id: "restaurantes" as const, label: "Restaurantes", icon: Store },
    { id: "clientes" as const, label: "Clientes", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-muted/30 flex gap-3 p-3">
      {/* Sidebar — panel flotante, separado del resto (no fundido con el
          header ni con el contenido): mismo patrón que el sidebar real de
          Likida. Logo suelto arriba, nav suelta, y todo lo de cuenta abajo
          metido en su propio recuadro más gris. */}
      <aside className={`hidden md:flex flex-col shrink-0 rounded-2xl border border-border bg-card sticky top-3 h-[calc(100vh-1.5rem)] overflow-hidden transition-all duration-300 ${collapsed ? "w-16" : "w-60"}`}>
        <div className="h-14 flex items-center justify-between px-3.5 shrink-0">
          {!collapsed ? <AtiendeWordmark className="scale-90 origin-left" /> : <AtiendeMark className="h-6 w-auto" />}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="w-6 h-6 rounded-md border border-border/60 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
          >
            {collapsed ? <PanelLeftOpen className="w-3.5 h-3.5" strokeWidth={1.75} /> : <PanelLeftClose className="w-3.5 h-3.5" strokeWidth={1.75} />}
          </button>
        </div>
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {!collapsed && <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground px-2.5 mb-1.5">Superadmin</p>}
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors ${
                section === item.id
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-2 space-y-0.5 shrink-0">
          {/* Cuenta — el recuadro gris real de Likida (sobresale del blanco
              del sidebar, sin borde propio, contenido dentro del padding). */}
          {!collapsed && (
            <div className="rounded-xl bg-muted/60 p-1.5 space-y-0.5 mb-1.5">
              <button className="w-full flex items-center gap-2 px-3 py-1.5 mb-1 rounded-full text-[13px] border border-border bg-card hover:bg-muted transition-colors">
                <LifeBuoy className="w-3.5 h-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
                <span className="truncate">Centro de ayuda</span>
              </button>
              {[
                { label: "Notificaciones", icon: Bell },
                { label: "Mi perfil", icon: UserRound },
                { label: "Plan y facturación", icon: CreditCard },
                { label: "Configuración", icon: Settings },
              ].map((it) => (
                <button key={it.label} className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-full text-[13px] text-muted-foreground hover:bg-background transition-colors">
                  <it.icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                  <span className="truncate">{it.label}</span>
                </button>
              ))}
              <div className="pt-1.5 pb-0.5 flex justify-center">
                <ThemeSelector />
              </div>
            </div>
          )}

          {/* Usuario — plano, separado solo por un borde superior fino */}
          <div className={`border-t border-border pt-1.5 ${collapsed ? "px-0" : "px-1"}`}>
            <div className="flex items-center gap-2 px-2 py-1">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium shrink-0">
                {(userName || userEmail).charAt(0).toUpperCase()}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-foreground truncate">{userName}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Superadmin</p>
                  </div>
                  <button onClick={handleLogout} className="text-destructive hover:opacity-70 shrink-0">
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main — UN solo panel grande (como la consola real de Likida): encabezado
          blanco arriba, cuerpo gris abajo con las tarjetas encima, todo dentro
          del mismo recuadro redondeado. */}
      <div className="flex-1 min-w-0 rounded-2xl border border-border bg-card overflow-hidden flex flex-col">
        {section !== "pregunta" && (
          <div className="h-12 flex items-center justify-between px-4 shrink-0 border-b border-border bg-card sticky top-0 z-10">
            <div className="flex items-center gap-2 text-sm text-foreground">
              {section === "resumen" && <LayoutGrid className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />}
              {section === "restaurantes" && <Store className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />}
              {section === "clientes" && <Users className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />}
              <span className="font-medium">
                {section === "resumen" && "Consola de Atiende Restaurantes"}
                {section === "restaurantes" && "Restaurantes"}
                {section === "clientes" && "Clientes"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
                <Bell className="w-4 h-4" strokeWidth={1.75} />
              </button>
              <span className="font-mono text-xs text-muted-foreground border border-border rounded-full px-3 py-1.5 shrink-0">
                {new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            </div>
          </div>
        )}

        <div className="w-full flex-1 overflow-auto bg-muted/30 p-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : section === "resumen" ? (
            <>
              <h1 className="text-xl font-semibold text-foreground mb-1">
                {saludoHorario()}, {nombreSaludo || 'de vuelta'} 👋
              </h1>
              <p className="text-sm text-muted-foreground mb-6">Toda la plataforma en una pantalla — cifras reales, de todos los restaurantes</p>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard icon={Store} label="Restaurantes activos" value={String(restaurants.filter((r) => r.is_active).length)} />
                <StatCard icon={Receipt} label="Pedidos hoy" value={String(ordersToday.length)} />
                <StatCard icon={TrendingUp} label="Ingresos hoy" value={`$${revenueToday.toLocaleString("es-MX")}`} />
                <StatCard icon={Users} label="Clientes totales" value={String(customers.length)} />
              </div>

              <SectionCard title="Restaurantes">
                <RestaurantsTable restaurants={restaurants} statsByRestaurant={statsByRestaurant} onOpen={(id) => navigate(`/admin?restaurante=${id}`)} />
              </SectionCard>
            </>
          ) : section === "pregunta" ? (
            <div className="relative min-h-[calc(100vh-6.5rem)] -m-6 pt-4 px-6 overflow-hidden">
              <CampoPixeles />
              <div className="flex justify-end mb-6">
                <button
                  onClick={() => setMostrarHistorial((v) => !v)}
                  className="relative flex items-center gap-1.5 text-xs border border-border rounded-full pl-3 pr-2.5 py-1.5 bg-card text-muted-foreground hover:bg-muted transition-colors"
                >
                  <History className="w-3.5 h-3.5" />
                  Historial
                  <span className="font-mono text-[10px] bg-muted rounded-full px-1.5 py-0.5 text-foreground">{historial.length}</span>
                </button>
              </div>

              {/* Panel de historial — mismo patrón flotante que el de tenant. */}
              {mostrarHistorial && (
                <div className="absolute right-3 top-3 bottom-3 z-20 w-72 max-w-[85vw] bg-card border border-border rounded-2xl shadow-xl flex flex-col overflow-hidden">
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
                    {historialFiltradoSA.length === 0 ? (
                      <p className="text-sm text-muted-foreground px-2 py-2">
                        {historial.length === 0 ? 'Sin chats recientes.' : 'Sin resultados.'}
                      </p>
                    ) : (
                      historialFiltradoSA.map((h, i) => (
                        <button
                          key={i}
                          onClick={() => { setMostrarHistorial(false); responderPregunta(h); }}
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
                      Tu operación, con la cifra que ya calculó el sistema — pregunta por clientes, restaurantes o pedidos en toda la plataforma.
                    </p>
                  </>
                )}

                {/* Hilo de conversación — mismo patrón que el panel de tenant:
                    burbuja del usuario a la derecha, respuesta como texto +
                    tabla de resultados con hairline punteado. */}
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

                          {m.filas && m.filas.length > 0 && (
                            <div className="rounded-xl border border-border bg-card p-3">
                              <ul className="space-y-2 text-sm">
                                {m.filas.slice(0, 10).map((r, j) => (
                                  <li key={j} className="flex justify-between border-b border-dashed border-border last:border-0 pb-2">
                                    {'phone' in r ? (
                                      <>
                                        <span>{r.name || 'Sin nombre'} · {r.phone}</span>
                                        <span className="font-mono tabular-nums text-muted-foreground">{r.order_count} pedidos</span>
                                      </>
                                    ) : (
                                      <>
                                        <span>{new Date(r.created_at).toLocaleString('es-MX')}</span>
                                        <span className="font-mono tabular-nums text-muted-foreground">${Number(r.total).toLocaleString('es-MX')}</span>
                                      </>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {m.filas && m.filas.length > 0 && (
                            <button
                              onClick={() => descargarPdfRespuestaSA(mensajesChat[i - 1]?.texto ?? '', m.texto, m.filas)}
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

                {/* Categorías — sólo al apretar Consulta con el campo vacío,
                    arriba del input (igual que en el panel de tenant). */}
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
                      {categoriasPreguntasSA.map((cat) => (
                        <div key={cat.titulo} className="rounded-xl border border-border bg-card p-3">
                          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground mb-2">{cat.titulo}</p>
                          <div className="space-y-1">
                            {cat.preguntas.map((p) => (
                              <button
                                key={p}
                                onClick={() => responderPregunta(p)}
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
                    responderPregunta(pregunta);
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

                {mensajesChat.length === 0 && !mostrarSugerencias && (
                  <div className="flex flex-wrap gap-1.5 justify-center mt-4 max-w-xl">
                    {preguntasSugeridasSAPlano.map((p) => (
                      <button
                        key={p}
                        onClick={() => responderPregunta(p)}
                        className="text-xs rounded-full px-3 py-1 bg-secondary/10 text-secondary border border-secondary/20 hover:bg-secondary/20 transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}

                {mensajesChat.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center mt-8 max-w-lg">
                    Responde con cifras ya calculadas en el servidor — búsqueda simple por nombre, teléfono y estatus por ahora, no
                    un motor de lenguaje natural completo. Adjuntar un archivo lo guarda con tu pregunta; todavía no lo leemos ni lo
                    analizamos automáticamente.
                  </p>
                )}
              </div>
            </div>
          ) : section === "restaurantes" ? (
            <SectionCard title={`${restaurants.length} restaurante${restaurants.length === 1 ? "" : "s"}`}>
              <RestaurantsTable restaurants={restaurants} statsByRestaurant={statsByRestaurant} onOpen={(id) => navigate(`/admin?restaurante=${id}`)} />
            </SectionCard>
          ) : (
            <SectionCard title={`${customers.length} clientes registrados`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground border-b border-border">
                      <th className="pb-2 font-medium">Nombre</th>
                      <th className="pb-2 font-medium">Teléfono</th>
                      <th className="pb-2 font-medium">Restaurante</th>
                      <th className="pb-2 font-medium text-right">Pedidos</th>
                      <th className="pb-2 font-medium text-right">Último pedido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c, i) => (
                      <tr key={i} className="border-b border-dashed border-border last:border-0">
                        <td className="py-2.5 text-foreground">{c.name || <span className="text-muted-foreground">Sin nombre</span>}</td>
                        <td className="py-2.5 font-mono text-muted-foreground tabular-nums">{c.phone}</td>
                        <td className="py-2.5 text-muted-foreground">{restaurants.find((r) => r.id === c.restaurant_id)?.name ?? "—"}</td>
                        <td className="py-2.5 text-right font-mono tabular-nums">{c.order_count}</td>
                        <td className="py-2.5 text-right text-muted-foreground text-xs">
                          {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString("es-MX") : "—"}
                        </td>
                      </tr>
                    ))}
                    {customers.length === 0 && (
                      <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Todavía no hay clientes registrados.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
};

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="px-5 py-3.5 border-b border-border">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function RestaurantsTable({
  restaurants,
  statsByRestaurant,
  onOpen,
}: {
  restaurants: Restaurant[];
  statsByRestaurant: (id: string) => { orders: number; revenue: number; customers: number; pending: number };
  onOpen: (id: string) => void;
}) {
  if (restaurants.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Todavía no hay restaurantes dados de alta.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground border-b border-border">
            <th className="pb-2 font-medium">Restaurante</th>
            <th className="pb-2 font-medium text-right">Pedidos</th>
            <th className="pb-2 font-medium text-right">Pendientes</th>
            <th className="pb-2 font-medium text-right">Clientes</th>
            <th className="pb-2 font-medium text-right">Ingresos</th>
            <th className="pb-2 font-medium text-right"></th>
          </tr>
        </thead>
        <tbody>
          {restaurants.map((r) => {
            const s = statsByRestaurant(r.id);
            return (
              <tr key={r.id} className="border-b border-dashed border-border last:border-0">
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-medium">{r.name}</span>
                    {!r.is_active && (
                      <span className="font-mono text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">inactivo</span>
                    )}
                  </div>
                </td>
                <td className="py-3 text-right font-mono tabular-nums">{s.orders}</td>
                <td className="py-3 text-right font-mono tabular-nums text-secondary">{s.pending}</td>
                <td className="py-3 text-right font-mono tabular-nums">{s.customers}</td>
                <td className="py-3 text-right font-mono tabular-nums">${s.revenue.toLocaleString("es-MX")}</td>
                <td className="py-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onOpen(r.id)}
                    className="h-7 px-3 rounded-full text-xs font-medium border-border/70"
                  >
                    Ver cuenta
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default SuperAdminDashboard;
