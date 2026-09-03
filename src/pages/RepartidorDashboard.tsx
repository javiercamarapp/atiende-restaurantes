import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
  ArrowLeft
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import RepartidorSidebar from "@/components/repartidor/RepartidorSidebar";
import { AtiendeWordmark } from "@/components/AtiendeLogo";

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  total: number;
  status: string | null;
  created_at: string;
  items: any;
  branch: string | null;
}

const RepartidorDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      await fetchOrders();
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

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setOrders(data as Order[]);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      toast.error("Error al actualizar el pedido");
      return;
    }

    // Marca de tiempo real de entrega (aparte del status), para "Entrega
    // tardía" en el panel de Notificaciones del admin. Va suelta y sin
    // bloquear: si la columna `delivered_at` todavía no existe (migración
    // pendiente de aplicar — ver supabase/migrations/20260903041514_...),
    // esto falla en silencio y el pedido de todos modos queda entregado.
    if (newStatus === "entregado") {
      (supabase as any).from("orders").update({ delivered_at: new Date().toISOString() }).eq("id", orderId)
        .then(({ error: errDelivered }: { error: unknown }) => {
          if (errDelivered) console.warn("No se pudo guardar delivered_at (¿falta aplicar la migración?)", errDelivered);
        });
    }

    toast.success(`Pedido ${newStatus === 'en_camino' ? 'en camino' : newStatus === 'entregado' ? 'entregado' : 'actualizado'}`);
    await fetchOrders();
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
            <div>
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold text-foreground">{order.customer_name}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: es })}
              </p>
            </div>
            {getStatusBadge(order.status)}
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
              <>
                {pendingOrders.map(order => (
                  <Card key={order.id} className="mb-4">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="font-semibold text-foreground">{order.customer_name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: es })}
                          </p>
                        </div>
                        {getStatusBadge(order.status)}
                      </div>

                      {/* Address */}
                      {order.customer_address && (
                        <div className="flex items-start gap-2 mb-3">
                          <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-muted-foreground">{order.customer_address}</p>
                        </div>
                      )}

                      {/* Total */}
                      <div className="flex items-center gap-2 mb-4">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <span className="font-bold text-foreground">${Number(order.total).toFixed(2)}</span>
                      </div>

                      {/* Action Buttons */}
                      <div className="space-y-2">
                        <div className="flex gap-2">
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
                        <Button
                          size="lg"
                          className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold py-4 text-lg"
                          onClick={() => updateOrderStatus(order.id, 'en_camino')}
                        >
                          <Truck className="w-6 h-6 mr-2" />
                          RECIBIDO - EN CAMINO
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
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
              <>
                {activeOrders.map(order => (
                  <OrderCard key={order.id} order={order} showActions={false} />
                ))}
                
                {/* Prominent Action Buttons */}
                <Card className="border-2 border-green-500 bg-green-50 dark:bg-green-500/10">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold text-center mb-4 text-foreground">Acciones de Entrega</h3>
                    <div className="space-y-3">
                      {activeOrders.map(order => (
                        <div key={order.id} className="space-y-2">
                          <p className="text-sm font-medium text-center text-muted-foreground">
                            Pedido de {order.customer_name} - ${Number(order.total).toFixed(2)}
                          </p>
                          <div className="flex gap-2">
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
                          <Button
                            size="lg"
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-4 text-lg"
                            onClick={() => updateOrderStatus(order.id, 'entregado')}
                          >
                            <CheckCircle className="w-6 h-6 mr-2" />
                            ENTREGADO
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        );

      case 'today-delivered':
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

      case 'cash-received':
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
                    Contacta al cliente directamente usando el botón "Llamar" o comunícate con administración.
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
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-destructive hover:bg-destructive hover:text-destructive-foreground">
            <LogOut className="w-5 h-5" />
          </Button>
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
    </div>
  );
};

export default RepartidorDashboard;
