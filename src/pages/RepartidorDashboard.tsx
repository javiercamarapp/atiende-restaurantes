import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CampoFormulario } from "@/components/ModalFormularioElegante";
import { ModalFormularioLateral } from "@/components/ModalFormularioLateral";
import {
  Package,
  MapPin,
  Clock,
  CheckCircle,
  Phone,
  User,
  DollarSign,
  Truck,
  Menu,
  X,
  LogOut,
  ExternalLink,
  Timer,
  History,
  HelpCircle,
  ArrowLeft,
  AlertTriangle,
  UserCircle,
  Bike,
  Car,
  IdCard,
  Contact
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import RepartidorSidebar from "@/components/repartidor/RepartidorSidebar";
import { AtiendeWordmark } from "@/components/AtiendeLogo";
import PedidoDetalleSection from "@/components/admin/PedidoDetalleSection";

interface Order {
  id: string;
  order_number: number | null;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  total: number;
  status: string | null;
  created_at: string;
  items: any;
  branch: string | null;
  estimated_delivery_at: string | null;
  incident_note: string | null;
}

interface RepartidorPerfil {
  nombre_completo: string;
  telefono: string;
  correo: string;
  tipo_vehiculo: string;
  placas: string | null;
  numero_licencia: string | null;
  direccion: string;
  contacto_emergencia_nombre: string;
  contacto_emergencia_telefono: string;
  fecha_alta: string;
}

// "Demorado" no es un status guardado — es una condición calculada: la
// entrega sigue en_camino pero ya se pasó del tiempo estimado real
// (estimated_delivery_at, capturada al despachar). Pedido real de Javier
// el 4-sep-2026 ("también agrega el demorado"), junto con el estado
// genérico "Incidencias" — mismo criterio real que ya usa "Entrega tardía"
// en Notificaciones del admin, pero para pedidos TODAVÍA en camino, no
// solo los ya entregados.
const esDemorado = (order: Order) =>
  order.status === "en_camino" && !!order.estimated_delivery_at && new Date(order.estimated_delivery_at).getTime() < Date.now();

const RepartidorDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [perfil, setPerfil] = useState<RepartidorPerfil | null>(null);

  // Diálogo real de "Reportar incidencia" — pedido real de Javier el
  // 4-sep-2026: un estado genérico ("Incidencias" en la UI, `problema` en
  // la base) que el repartidor mismo puede reportar en cualquier punto del
  // ciclo (dirección incorrecta, cliente no contesta, etc.), con una nota
  // libre que queda guardada en `incident_note` y dispara el correo real de
  // aviso al staff (mismo mecanismo que ya usa "cancelado").
  const [incidenciaAbierta, setIncidenciaAbierta] = useState<{ orderId: string; clienteNombre: string } | null>(null);
  // Pedido real de Javier el 4-sep-2026: "no es un pop up, cada pedido
  // tiene su página completa" — misma página compartida de
  // Historial/Pedidos/Notificaciones, ver PedidoDetalleSection.tsx.
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [incidenciaNota, setIncidenciaNota] = useState("");
  const [reportandoIncidencia, setReportandoIncidencia] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if user has repartidor role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'repartidor')
        .maybeSingle();

      if (!roleData) {
        toast.error("No tienes permisos de repartidor");
        navigate("/");
        return;
      }

      setUser(session.user);
      await Promise.all([fetchOrders(session.user.id), fetchPerfil(session.user.id)]);
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session) {
          navigate("/auth");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Bug real corregido el 4-sep-2026: antes se traían TODOS los pedidos del
  // restaurante sin filtro, así que cualquier repartidor veía (y podía
  // marcar como entregados) los pedidos asignados a otros repartidores. La
  // asignación real vive en `assigned_repartidor_id` (la pone el admin al
  // despachar desde Pedidos) — cada repartidor solo debe ver lo que es
  // suyo.
  const fetchOrders = async (repartidorId: string) => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("assigned_repartidor_id", repartidorId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setOrders(data as Order[]);
    }
  };

  const fetchPerfil = async (repartidorId: string) => {
    const { data } = await supabase
      .from("repartidor_perfil")
      .select("*")
      .eq("user_id", repartidorId)
      .maybeSingle();
    setPerfil((data as RepartidorPerfil | null) ?? null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const { data: updated, error } = await supabase.rpc("update_assigned_order_status", {
      p_order_id: orderId,
      p_status: newStatus,
      p_incident_note: null,
    });

    if (error || !updated) {
      toast.error("Error al actualizar el pedido");
      return;
    }

    toast.success(`Pedido ${newStatus === 'en_camino' ? 'en camino' : newStatus === 'entregado' ? 'entregado' : 'actualizado'}`);
    if (user?.id) await fetchOrders(user.id);
  };

  const reportarIncidencia = async () => {
    if (!incidenciaAbierta) return;
    if (!incidenciaNota.trim()) {
      toast.error("Escribe qué pasó antes de reportar la incidencia.");
      return;
    }
    setReportandoIncidencia(true);
    const { data: updated, error } = await supabase.rpc("update_assigned_order_status", {
      p_order_id: incidenciaAbierta.orderId,
      p_status: "problema",
      p_incident_note: incidenciaNota.trim(),
    });
    setReportandoIncidencia(false);
    if (error || !updated) {
      toast.error("No se pudo reportar la incidencia");
      return;
    }
    toast.success("Incidencia reportada — administración ya la puede ver.");
    setIncidenciaAbierta(null);
    setIncidenciaNota("");
    if (user?.id) await fetchOrders(user.id);
  };

  const openGoogleMaps = (address: string | null) => {
    if (!address) {
      toast.error("No hay dirección disponible");
      return;
    }
    const encodedAddress = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
  };

  const callCustomer = (phone: string) => {
    window.open(`tel:${phone}`, '_self');
  };

  // Filter orders by status
  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'preparando');
  const activeOrders = orders.filter(o => o.status === 'en_camino');
  const completedOrders = orders.filter(o => o.status === 'entregado');

  // Stats
  const todayOrders = orders.filter(o => {
    const orderDate = new Date(o.created_at);
    const today = new Date();
    return orderDate.toDateString() === today.toDateString();
  });
  const todayDelivered = todayOrders.filter(o => o.status === 'entregado').length;
  const todayEarnings = todayOrders.filter(o => o.status === 'entregado').reduce((sum, o) => sum + Number(o.total), 0);

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30">Pendiente</Badge>;
      case 'preparando':
        return <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/30">Preparando</Badge>;
      case 'en_camino':
        return <Badge className="bg-secondary/15 text-secondary-foreground dark:text-secondary border border-secondary/30">En Camino</Badge>;
      case 'entregado':
        return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30">Entregado</Badge>;
      case 'problema':
        return <Badge className="bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400 border border-fuchsia-500/30">Incidencia</Badge>;
      case 'cancelado':
        return <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30">Cancelado</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground border border-border">{status || 'Sin estado'}</Badge>;
    }
  };

  const OrderCard = ({ order, showActions = true }: { order: Order; showActions?: boolean }) => {
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    const itemsList = Array.isArray(items) ? items : [];

    return (
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="cursor-pointer" onClick={() => setDetalleId(order.id)}>
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold text-foreground">{order.customer_name}</span>
              </div>
              <p className="font-mono text-[11px] text-muted-foreground">
                Pedido #{order.order_number != null ? String(order.order_number).padStart(4, "0") : order.id.slice(0, 8)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: es })}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {getStatusBadge(order.status)}
              {esDemorado(order) && (
                <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Demorado
                </Badge>
              )}
            </div>
          </div>

          {/* Order Items */}
          <div className="bg-muted rounded-lg p-3 mb-3">
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Productos</p>
            <div className="space-y-1">
              {itemsList.slice(0, 3).map((item: any, idx: number) => (
                <p key={idx} className="text-sm text-foreground">
                  {item.quantity}x {item.name}
                </p>
              ))}
              {itemsList.length > 3 && (
                <p className="text-xs text-muted-foreground">+{itemsList.length - 3} más...</p>
              )}
            </div>
          </div>

          {/* Address */}
          {order.customer_address && (
            <div className="flex items-start gap-2 mb-3">
              <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">{order.customer_address}</p>
            </div>
          )}

          {/* Total & Time */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="font-bold text-foreground">${Number(order.total).toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Timer className="w-4 h-4" />
              <span className="text-sm">{format(new Date(order.created_at), 'HH:mm', { locale: es })}</span>
            </div>
          </div>

          {/* Quick Actions - Call & Map */}
          {showActions && (
            <div className="flex gap-2 mb-3">
              <Button
                size="sm"
                onClick={() => callCustomer(order.customer_phone)}
                className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90"
              >
                <Phone className="w-4 h-4 mr-1" />
                Llamar
              </Button>
              <Button
                size="sm"
                onClick={() => openGoogleMaps(order.customer_address)}
                className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90"
              >
                <MapPin className="w-4 h-4 mr-1" />
                Mapa
              </Button>
            </div>
          )}

          {/* Status Action Buttons */}
          {showActions && (
            <div className="space-y-2">
              {(order.status === 'pending' || order.status === 'preparando') && (
                <Button
                  size="lg"
                  className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold py-3"
                  onClick={() => updateOrderStatus(order.id, 'en_camino')}
                >
                  <Truck className="w-5 h-5 mr-2" />
                  RECIBIDO - EN CAMINO
                </Button>
              )}
              {order.status === 'en_camino' && (
                <Button
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3"
                  onClick={() => updateOrderStatus(order.id, 'entregado')}
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  ENTREGADO
                </Button>
              )}
              {(order.status === 'pending' || order.status === 'preparando' || order.status === 'en_camino') && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/30 hover:bg-fuchsia-500/10"
                  onClick={() => setIncidenciaAbierta({ orderId: order.id, clienteNombre: order.customer_name })}
                >
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  Reportar incidencia
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const renderContent = () => {
    // Pedido real de Javier el 4-sep-2026: "no es un pop up, cada pedido
    // tiene su página completa" — reemplaza el contenido de la sección
    // (dentro del mismo shell de sidebar/nav) en vez de un modal.
    if (detalleId) {
      return <PedidoDetalleSection orderId={detalleId} onVolver={() => setDetalleId(null)} onSelect={setDetalleId} />;
    }
    switch (activeSection) {
      case 'dashboard':
        return (
          <div className="space-y-4 md:space-y-6">
            <h2 className="text-xl md:text-2xl font-bold text-foreground">Panel de Control</h2>
            
            {/* Stats - Clickable */}
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <Card
                className="cursor-pointer active:scale-95 transition-transform hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => setActiveSection('pending')}
              >
                <CardContent className="p-3 md:p-4 flex items-center gap-2 md:gap-3">
                  <div className="p-2 md:p-3 bg-yellow-100 dark:bg-yellow-500/15 rounded-full">
                    <Clock className="w-4 h-4 md:w-5 md:h-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <p className="font-display text-xl md:text-2xl font-semibold tabular-nums text-foreground">{pendingOrders.length}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Pendientes</p>
                  </div>
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer active:scale-95 transition-transform hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => setActiveSection('active')}
              >
                <CardContent className="p-3 md:p-4 flex items-center gap-2 md:gap-3">
                  <div className="p-2 md:p-3 bg-blue-100 dark:bg-secondary/15 rounded-full">
                    <Truck className="w-4 h-4 md:w-5 md:h-5 text-blue-600 dark:text-secondary" />
                  </div>
                  <div>
                    <p className="font-display text-xl md:text-2xl font-semibold tabular-nums text-foreground">{activeOrders.length}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">En Camino</p>
                  </div>
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer active:scale-95 transition-transform hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => setActiveSection('today-delivered')}
              >
                <CardContent className="p-3 md:p-4 flex items-center gap-2 md:gap-3">
                  <div className="p-2 md:p-3 bg-green-100 dark:bg-green-500/15 rounded-full">
                    <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-display text-xl md:text-2xl font-semibold tabular-nums text-foreground">{todayDelivered}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Entregados</p>
                  </div>
                </CardContent>
              </Card>
              <Card
                className="cursor-pointer active:scale-95 transition-transform hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => setActiveSection('cash-received')}
              >
                <CardContent className="p-3 md:p-4 flex items-center gap-2 md:gap-3">
                  <div className="p-2 md:p-3 bg-emerald-100 dark:bg-emerald-500/15 rounded-full">
                    <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-display text-xl md:text-2xl font-semibold tabular-nums text-foreground">${todayEarnings.toFixed(0)}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Efectivo</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Active Orders Preview */}
            {activeOrders.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                    <Truck className="w-5 h-5 text-secondary" />
                    Entregas en Curso
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activeOrders.slice(0, 2).map(order => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                  {activeOrders.length > 2 && (
                    <Button 
                      variant="link" 
                      className="w-full text-foreground"
                      onClick={() => setActiveSection('active')}
                    >
                      Ver todas ({activeOrders.length})
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Pending Orders Preview */}
            {pendingOrders.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                    <Clock className="w-5 h-5 text-yellow-500" />
                    Pedidos Pendientes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingOrders.slice(0, 3).map(order => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                  {pendingOrders.length > 3 && (
                    <Button 
                      variant="link" 
                      className="w-full text-foreground"
                      onClick={() => setActiveSection('pending')}
                    >
                      Ver todos ({pendingOrders.length})
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {pendingOrders.length === 0 && activeOrders.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No hay pedidos activos</p>
                  <p className="text-sm text-muted-foreground">Los nuevos pedidos aparecerán aquí</p>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 'pending':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Button variant="ghost" size="icon" onClick={() => setActiveSection('dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Clock className="w-6 h-6 text-yellow-500" />
                Pedidos Pendientes ({pendingOrders.length})
              </h2>
            </div>
            {pendingOrders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500/30" />
                  <p className="text-muted-foreground">No hay pedidos pendientes</p>
                </CardContent>
              </Card>
            ) : (
              pendingOrders.map(order => <OrderCard key={order.id} order={order} />)
            )}
          </div>
        );

      case 'active':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Button variant="ghost" size="icon" onClick={() => setActiveSection('dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Truck className="w-6 h-6 text-secondary" />
                En Camino ({activeOrders.length})
              </h2>
            </div>
            {activeOrders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Truck className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No tienes entregas en curso</p>
                  <Button 
                    variant="link"
                    className="text-foreground"
                    onClick={() => setActiveSection('pending')}
                  >
                    Ver pedidos pendientes
                  </Button>
                </CardContent>
              </Card>
            ) : (
              activeOrders.map(order => <OrderCard key={order.id} order={order} />)
            )}
          </div>
        );

      case 'today-delivered': {
        const todayDeliveredOrders = todayOrders.filter(o => o.status === 'entregado');
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Button variant="ghost" size="icon" onClick={() => setActiveSection('dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-green-500" />
                Entregados Hoy ({todayDeliveredOrders.length})
              </h2>
            </div>
            {todayDeliveredOrders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No hay entregas completadas hoy</p>
                </CardContent>
              </Card>
            ) : (
              todayDeliveredOrders.map(order => (
                <OrderCard key={order.id} order={order} showActions={false} />
              ))
            )}
          </div>
        );
      }

      case 'cash-received': {
        const cashOrders = todayOrders.filter(o => o.status === 'entregado');
        const cashTotal = cashOrders.reduce((sum, o) => sum + Number(o.total), 0);
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Button variant="ghost" size="icon" onClick={() => setActiveSection('dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-emerald-500" />
                Recibido en Efectivo
              </h2>
            </div>
            {cashOrders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <DollarSign className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No hay pedidos entregados en efectivo hoy</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30">
                  <CardContent className="p-4">
                    <div className="text-center">
                      <p className="font-display text-3xl font-semibold tabular-nums text-emerald-600">${cashTotal.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">{cashOrders.length} pedidos en efectivo</p>
                    </div>
                  </CardContent>
                </Card>
                {cashOrders.map(order => (
                  <OrderCard key={order.id} order={order} showActions={false} />
                ))}
              </>
            )}
          </div>
        );
      }

      case 'history':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Button variant="ghost" size="icon" onClick={() => setActiveSection('dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <History className="w-6 h-6 text-muted-foreground" />
                Historial de Entregas
              </h2>
            </div>
            {completedOrders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <History className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No hay entregas completadas</p>
                </CardContent>
              </Card>
            ) : (
              completedOrders.map(order => (
                <OrderCard key={order.id} order={order} showActions={false} />
              ))
            )}
          </div>
        );

      case 'help':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Button variant="ghost" size="icon" onClick={() => setActiveSection('dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <HelpCircle className="w-6 h-6" />
                Centro de Ayuda
              </h2>
            </div>
            <Card>
              <CardContent className="p-6 space-y-4">
                <div>
                  <h3 className="font-semibold mb-2 text-foreground">¿Cómo tomar un pedido?</h3>
                  <p className="text-sm text-muted-foreground">
                    Ve a "Pendientes", selecciona un pedido y presiona "Tomar" para comenzar la entrega.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-foreground">¿Cómo marcar como entregado?</h3>
                  <p className="text-sm text-muted-foreground">
                    Una vez que entregues el pedido, presiona "Entregado" en la tarjeta del pedido.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-foreground">¿Problemas con un pedido?</h3>
                  <p className="text-sm text-muted-foreground">
                    Contacta al cliente directamente usando el botón "Llamar", o presiona "Reportar incidencia" en la
                    tarjeta del pedido — queda registrado y administración lo ve de inmediato.
                  </p>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    <strong>Soporte:</strong> WhatsApp al administrador
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'profile':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Button variant="ghost" size="icon" onClick={() => setActiveSection('dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <UserCircle className="w-6 h-6" />
                Perfil
              </h2>
            </div>
            {!perfil ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <UserCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No encontramos tu perfil operativo todavía.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-semibold shrink-0">
                        {perfil.nombre_completo.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-display text-lg font-semibold text-foreground">{perfil.nombre_completo}</p>
                        <p className="text-sm text-muted-foreground">{perfil.correo}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm text-foreground">{perfil.telefono}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {perfil.tipo_vehiculo === 'bicicleta' ? <Bike className="w-4 h-4 text-muted-foreground shrink-0" /> : <Car className="w-4 h-4 text-muted-foreground shrink-0" />}
                        <span className="text-sm text-foreground capitalize">{perfil.tipo_vehiculo}</span>
                      </div>
                      {perfil.placas && (
                        <div className="flex items-center gap-2">
                          <IdCard className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm text-foreground">{perfil.placas}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm text-foreground">Desde {format(new Date(perfil.fecha_alta), "d MMM yyyy", { locale: es })}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 space-y-2">
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Contacto de emergencia</p>
                    <div className="flex items-center gap-2">
                      <Contact className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground">{perfil.contacto_emergencia_nombre} — {perfil.contacto_emergencia_telefono}</span>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
            <Button
              variant="outline"
              className="w-full text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Desktop Sidebar */}
      <RepartidorSidebar
        user={user}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onLogout={handleLogout}
        pendingCount={pendingOrders.length}
        activeCount={activeOrders.length}
      />

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-card border-b border-border z-50 safe-area-top">
        <div className="flex items-center justify-between px-4 py-3">
          <AtiendeWordmark />
          <button
            onClick={() => setActiveSection('profile')}
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium"
          >
            {user?.email?.charAt(0).toUpperCase() || 'R'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-3 md:p-8 pt-16 pb-24 md:pt-8 md:pb-8">
        <div className="max-w-4xl mx-auto">
          {renderContent()}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-bottom">
        <nav className="flex justify-around items-center py-2">
          <button
            onClick={() => setActiveSection('dashboard')}
            className={`flex flex-col items-center p-2 min-w-[60px] ${
              activeSection === 'dashboard' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Package className="w-6 h-6" />
            <span className="text-[10px] mt-1">Inicio</span>
          </button>
          <button
            onClick={() => setActiveSection('pending')}
            className={`flex flex-col items-center p-2 min-w-[60px] relative ${
              activeSection === 'pending' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Clock className="w-6 h-6" />
            <span className="text-[10px] mt-1">Pendientes</span>
            {pendingOrders.length > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center">
                {pendingOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSection('active')}
            className={`flex flex-col items-center p-2 min-w-[60px] relative ${
              activeSection === 'active' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Truck className="w-6 h-6" />
            <span className="text-[10px] mt-1">En Camino</span>
            {activeOrders.length > 0 && (
              <span className="absolute top-1 right-1 bg-secondary text-secondary-foreground text-[10px] rounded-full w-5 h-5 flex items-center justify-center">
                {activeOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSection('cash-received')}
            className={`flex flex-col items-center p-2 min-w-[60px] ${
              activeSection === 'cash-received' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <DollarSign className="w-6 h-6" />
            <span className="text-[10px] mt-1">Efectivo</span>
          </button>
          <button
            onClick={() => setActiveSection('history')}
            className={`flex flex-col items-center p-2 min-w-[60px] ${
              activeSection === 'history' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <History className="w-6 h-6" />
            <span className="text-[10px] mt-1">Historial</span>
          </button>
        </nav>
      </div>

      {/* Diálogo de "Reportar incidencia" — ver reportarIncidencia() arriba.
          Unificado al esqueleto real de ModalClonarVoz.tsx (riel izquierdo
          con ícono/marca + título/subtítulo, columna derecha con el
          contenido y los botones al pie) vía ModalFormularioLateral, el
          esqueleto vigente en toda la app. */}
      <ModalFormularioLateral
        open={!!incidenciaAbierta}
        onOpenChange={(v) => { if (!v) { setIncidenciaAbierta(null); setIncidenciaNota(""); } }}
        icono={AlertTriangle}
        titulo="Reportar incidencia"
        subtitulo={incidenciaAbierta ? `Pedido de ${incidenciaAbierta.clienteNombre} — administración lo verá de inmediato` : undefined}
        anchoClase="max-w-5xl"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full flex-1" onClick={() => { setIncidenciaAbierta(null); setIncidenciaNota(""); }}>
              Cancelar
            </Button>
            <Button
              className="rounded-full flex-1 bg-fuchsia-600 hover:bg-fuchsia-700 text-white"
              onClick={reportarIncidencia}
              disabled={reportandoIncidencia}
            >
              {reportandoIncidencia ? "Reportando..." : "Reportar incidencia"}
            </Button>
          </div>
        }
      >
        <CampoFormulario id="incidencia-nota-repartidor" label="¿Qué pasó?">
          <Textarea
            id="incidencia-nota-repartidor"
            placeholder="Ej. la dirección no existe, el cliente no contesta, hubo un accidente..."
            value={incidenciaNota}
            onChange={(e) => setIncidenciaNota(e.target.value)}
            rows={4}
          />
        </CampoFormulario>
      </ModalFormularioLateral>
    </div>
  );
};

export default RepartidorDashboard;
