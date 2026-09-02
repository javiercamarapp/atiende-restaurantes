import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeSelector } from "@/components/ThemeSelector";
import { AtiendeMark, AtiendeWordmark } from "@/components/AtiendeLogo";
import {
  LayoutGrid, Store, Users, LogOut, TrendingUp, Receipt, MessageCircle,
  LifeBuoy, Bell, UserRound, CreditCard, Settings, Send,
} from "lucide-react";

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
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<"resumen" | "restaurantes" | "clientes" | "pregunta">("resumen");
  const [pregunta, setPregunta] = useState("");
  const [respuesta, setRespuesta] = useState<CustomerRow[] | OrderRow[] | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/admin/login");
        return;
      }
      setUserEmail(session.user.email ?? "");

      const [{ data: r }, { data: o }, { data: c }] = await Promise.all([
        supabase.from("restaurants").select("id, name, slug, is_active").order("created_at"),
        supabase.from("orders").select("restaurant_id, total, status, created_at"),
        supabase.from("customers").select("restaurant_id, name, phone, order_count, last_order_at").order("last_order_at", { ascending: false }),
      ]);
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

  // Búsqueda simple y determinista (no es un motor de lenguaje natural real
  // todavía — responde a las preguntas sugeridas y a nombre/teléfono).
  const responderPregunta = (q: string) => {
    const needle = q.toLowerCase();
    if (needle.includes("pendiente")) {
      setRespuesta(orders.filter((o) => o.status === "pending" || o.status === "preparando"));
      return;
    }
    if (needle.includes("cliente") || needle.includes("recurrente")) {
      setRespuesta([...customers].sort((a, b) => b.order_count - a.order_count).slice(0, 10));
      return;
    }
    setRespuesta(
      customers.filter((c) => (c.name ?? "").toLowerCase().includes(needle) || c.phone.includes(needle)),
    );
  };

  const preguntasSugeridas = ["¿Cuántos pedidos están pendientes?", "¿Quiénes son mis clientes más recurrentes?"];

  const navItems = [
    { id: "resumen" as const, label: "Resumen", icon: LayoutGrid },
    { id: "pregunta" as const, label: "Pregunta a tus datos", icon: MessageCircle },
    { id: "restaurantes" as const, label: "Restaurantes", icon: Store },
    { id: "clientes" as const, label: "Clientes", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-border bg-card h-screen sticky top-0">
        <div className="h-16 flex items-center px-5 border-b border-border">
          <AtiendeWordmark />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground px-2.5 mb-1.5">Superadmin</p>
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
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Bloque inferior — mismo patrón que Likida: pill de ayuda, links
            de cuenta, selector de tema, chip de usuario con logout. */}
        <div className="px-3 pb-3 space-y-0.5">
          <button className="w-full flex items-center gap-2 px-3 py-1.5 mb-1 rounded-full text-[12.5px] font-medium border border-border bg-background hover:bg-muted transition-colors">
            <LifeBuoy className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
            <span className="truncate">Centro de ayuda</span>
          </button>
          {[
            { label: "Notificaciones", icon: Bell },
            { label: "Mi perfil", icon: UserRound },
            { label: "Plan y facturación", icon: CreditCard },
            { label: "Configuración", icon: Settings },
          ].map((it) => (
            <button key={it.label} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] text-muted-foreground hover:bg-muted transition-colors">
              <it.icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{it.label}</span>
            </button>
          ))}
          <div className="pt-1.5 flex justify-center">
            <ThemeSelector />
          </div>
        </div>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border bg-background">
            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium shrink-0">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground truncate">{userEmail.split("@")[0]}</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground">Superadmin</p>
            </div>
            <button onClick={handleLogout} className="text-destructive hover:opacity-70 shrink-0">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <div className="h-16 border-b border-border flex items-center justify-between px-6 sticky top-0 bg-background/95 backdrop-blur z-10">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <LayoutGrid className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
            <span className="font-medium">
              {section === "resumen" && "Consola de atiende.ai"}
              {section === "pregunta" && "Pregunta a tus datos"}
              {section === "restaurantes" && "Restaurantes"}
              {section === "clientes" && "Clientes"}
            </span>
          </div>
          <span className="font-mono text-xs text-muted-foreground border border-border rounded-full px-3 py-1">
            {new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
        </div>

        <div className="p-6 max-w-6xl">
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : section === "resumen" ? (
            <>
              <h1 className="font-display text-2xl font-semibold text-foreground mb-1">
                Buenas {new Date().getHours() < 13 ? "tardes" : "tardes"}, {userEmail.split("@")[0]}
              </h1>
              <p className="text-sm text-muted-foreground mb-6">Toda la plataforma en una pantalla — cifras reales, de todos los restaurantes</p>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard icon={Store} label="Restaurantes activos" value={String(restaurants.filter((r) => r.is_active).length)} />
                <StatCard icon={Receipt} label="Pedidos hoy" value={String(ordersToday.length)} />
                <StatCard icon={TrendingUp} label="Ingresos hoy" value={`$${revenueToday.toLocaleString("es-MX")}`} />
                <StatCard icon={Users} label="Clientes totales" value={String(customers.length)} />
              </div>

              <SectionCard title="Restaurantes">
                <RestaurantsTable restaurants={restaurants} statsByRestaurant={statsByRestaurant} onOpen={() => navigate("/admin")} />
              </SectionCard>
            </>
          ) : section === "pregunta" ? (
            <div className="flex flex-col items-center pt-10">
              <AtiendeMark className="h-8 w-auto mb-3" />
              <h1 className="text-2xl font-semibold text-foreground mb-2">Pregunta a tus datos</h1>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                Tu operación, con la cifra que ya calculó el sistema — pregunta por clientes o pedidos en toda la plataforma.
              </p>
              <form
                onSubmit={(e) => { e.preventDefault(); responderPregunta(pregunta); }}
                className="w-full max-w-xl bg-card border border-border rounded-2xl p-2 flex items-center gap-2"
              >
                <input
                  value={pregunta}
                  onChange={(e) => setPregunta(e.target.value)}
                  placeholder="Pregunta sobre tu operación…"
                  className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
                />
                <Button type="submit" size="icon" className="rounded-full shrink-0">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
              <div className="flex flex-wrap gap-2 justify-center mt-4 max-w-xl">
                {preguntasSugeridas.map((p) => (
                  <button
                    key={p}
                    onClick={() => { setPregunta(p); responderPregunta(p); }}
                    className="text-xs border border-border rounded-full px-3 py-1.5 text-muted-foreground hover:bg-muted transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground text-center mt-6 max-w-md">
                Responde con cifras ya calculadas en el servidor — búsqueda simple por ahora, no un motor de lenguaje natural completo.
              </p>

              {respuesta && (
                <div className="w-full max-w-xl mt-8">
                  <SectionCard title={`${respuesta.length} resultado${respuesta.length === 1 ? "" : "s"}`}>
                    {respuesta.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin resultados.</p>
                    ) : (
                      <ul className="space-y-2 text-sm">
                        {respuesta.slice(0, 10).map((r, i) => (
                          <li key={i} className="flex justify-between border-b border-dashed border-border last:border-0 pb-2">
                            {"phone" in r ? (
                              <>
                                <span>{r.name || "Sin nombre"} · {r.phone}</span>
                                <span className="font-mono tabular-nums text-muted-foreground">{r.order_count} pedidos</span>
                              </>
                            ) : (
                              <>
                                <span>{new Date(r.created_at).toLocaleString("es-MX")}</span>
                                <span className="font-mono tabular-nums text-muted-foreground">${Number(r.total).toLocaleString("es-MX")}</span>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </SectionCard>
                </div>
              )}
            </div>
          ) : section === "restaurantes" ? (
            <SectionCard title={`${restaurants.length} restaurante${restaurants.length === 1 ? "" : "s"}`}>
              <RestaurantsTable restaurants={restaurants} statsByRestaurant={statsByRestaurant} onOpen={() => navigate("/admin")} />
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
      </main>
    </div>
  );
};

// Anatomía exacta de StatCard de Likida: caja interna --canvas con chip de
// ícono sólido en --marca, cifra grande debajo del hairline punteado.
function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>; label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-2">
      <div className="rounded-lg px-3 py-2.5 bg-muted">
        <div className="flex items-center gap-2.5 mb-1.5">
          <div className="w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
          </div>
          <span className="text-[13px] text-muted-foreground">{label}</span>
        </div>
        <p className="font-display text-xl font-semibold tabular-nums text-foreground">{value}</p>
      </div>
    </div>
  );
}

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
                  <Button size="sm" variant="outline" onClick={() => onOpen(r.id)}>Ver cuenta</Button>
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
