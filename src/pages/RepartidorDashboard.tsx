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
import logo from "@/assets/logo-admin.avif";

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
        return <Badge className="bg-yellow-500/20 backdrop-blur-xl text-yellow-700 border border-yellow-300/50">Pendiente</Badge>;
      case 'preparando':
        return <Badge className="bg-orange-500/20 backdrop-blur-xl text-orange-700 border border-orange-300/50">Preparando</Badge>;
      case 'en_camino':
        return <Badge className="bg-blue-500/20 backdrop-blur-xl text-blue-700 border border-blue-300/50">En Camino</Badge>;
      case 'entregado':
        return <Badge className="bg-green-500/20 backdrop-blur-xl text-green-700 border border-green-300/50">Entregado</Badge>;
      default:
        return <Badge className="bg-gray-500/20 backdrop-blur-xl text-gray-700 border border-gray-300/50">{status || 'Sin estado'}</Badge>;
    }
  };

  const OrderCard = ({ order, showActions = true }: { order: Order; showActions?: boolean }) => {
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    const itemsList = Array.isArray(items) ? items : [];

    return (
      <Card className="mb-4 bg-white/60 backdrop-blur-xl border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-black/60" />
                <span className="font-semibold text-black">{order.customer_name}</span>
              </div>
              <p className="text-xs text-black/60">
                {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: es })}
              </p>
            </div>
            {getStatusBadge(order.status)}
          </div>

          {/* Order Items */}
          <div className="bg-white/40 backdrop-blur-sm rounded-lg p-3 mb-3">
            <p className="text-xs font-medium text-black/60 mb-2">Productos:</p>
            <div className="space-y-1">
              {itemsList.slice(0, 3).map((item: any, idx: number) => (
                <p key={idx} className="text-sm text-black">
                  {item.quantity}x {item.name}
                </p>
              ))}
              {itemsList.length > 3 && (
                <p className="text-xs text-black/60">+{itemsList.length - 3} más...</p>
              )}
            </div>
          </div>

          {/* Address */}
          {order.customer_address && (
            <div className="flex items-start gap-2 mb-3">
              <MapPin className="w-4 h-4 text-terracotta mt-0.5 flex-shrink-0" />
              <p className="text-sm text-black/70">{order.customer_address}</p>
            </div>
          )}

          {/* Total & Time */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="font-bold text-black">${Number(order.total).toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2 text-black/60">
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
                className="flex-1 bg-blue-500 text-black hover:bg-blue-600"
              >
                <Phone className="w-4 h-4 mr-1" />
                Llamar
              </Button>
              <Button
                size="sm"
                onClick={() => openGoogleMaps(order.customer_address)}
                className="flex-1 bg-blue-500 text-black hover:bg-blue-600"
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
                  className="w-full bg-red-600 hover:bg-red-700 text-black font-bold py-3"
                  onClick={() => updateOrderStatus(order.id, 'en_camino')}
                >
                  <Truck className="w-5 h-5 mr-2" />
                  RECIBIDO - EN CAMINO
                </Button>
              )}
              {order.status === 'en_camino' && (
                <Button
                  size="lg"
                  className="w-full bg-green-600 hover:bg-green-700 text-black font-bold py-3"
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <div className="space-y-4 md:space-y-6">
            <h2 className="text-xl md:text-2xl font-bold text-black">Panel de Control</h2>
            
            {/* Stats - Clickable */}
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <Card 
                className="cursor-pointer active:scale-95 transition-transform bg-white/60 backdrop-blur-xl border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.08)] hover:shadow-lg hover:border-yellow-400"
                onClick={() => setActiveSection('pending')}
              >
                <CardContent className="p-3 md:p-4 flex items-center gap-2 md:gap-3">
                  <div className="p-2 md:p-3 bg-yellow-100 rounded-full">
                    <Clock className="w-4 h-4 md:w-5 md:h-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-xl md:text-2xl font-bold text-black">{pendingOrders.length}</p>
                    <p className="text-[10px] md:text-xs text-black/60">Pendientes</p>
                  </div>
                </CardContent>
              </Card>
              <Card 
                className="cursor-pointer active:scale-95 transition-transform bg-white/60 backdrop-blur-xl border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.08)] hover:shadow-lg hover:border-blue-400"
                onClick={() => setActiveSection('active')}
              >
                <CardContent className="p-3 md:p-4 flex items-center gap-2 md:gap-3">
                  <div className="p-2 md:p-3 bg-blue-100 rounded-full">
                    <Truck className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xl md:text-2xl font-bold text-black">{activeOrders.length}</p>
                    <p className="text-[10px] md:text-xs text-black/60">En Camino</p>
                  </div>
                </CardContent>
              </Card>
              <Card 
                className="cursor-pointer active:scale-95 transition-transform bg-white/60 backdrop-blur-xl border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.08)] hover:shadow-lg hover:border-green-400"
                onClick={() => setActiveSection('today-delivered')}
              >
                <CardContent className="p-3 md:p-4 flex items-center gap-2 md:gap-3">
                  <div className="p-2 md:p-3 bg-green-100 rounded-full">
                    <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xl md:text-2xl font-bold text-black">{todayDelivered}</p>
                    <p className="text-[10px] md:text-xs text-black/60">Entregados</p>
                  </div>
                </CardContent>
              </Card>
              <Card 
                className="cursor-pointer active:scale-95 transition-transform bg-white/60 backdrop-blur-xl border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.08)] hover:shadow-lg hover:border-emerald-400"
                onClick={() => setActiveSection('cash-received')}
              >
                <CardContent className="p-3 md:p-4 flex items-center gap-2 md:gap-3">
                  <div className="p-2 md:p-3 bg-emerald-100 rounded-full">
                    <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xl md:text-2xl font-bold text-black">${todayEarnings.toFixed(0)}</p>
                    <p className="text-[10px] md:text-xs text-black/60">Efectivo</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Active Orders Preview */}
            {activeOrders.length > 0 && (
              <Card className="bg-white/60 backdrop-blur-xl border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-black">
                    <Truck className="w-5 h-5 text-blue-500" />
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
                      className="w-full text-black"
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
              <Card className="bg-white/60 backdrop-blur-xl border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-black">
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
                      className="w-full text-black"
                      onClick={() => setActiveSection('pending')}
                    >
                      Ver todos ({pendingOrders.length})
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {pendingOrders.length === 0 && activeOrders.length === 0 && (
              <Card className="bg-white/60 backdrop-blur-xl border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
                <CardContent className="py-12 text-center">
                  <Package className="w-16 h-16 mx-auto mb-4 text-black/30" />
                  <p className="text-black/70">No hay pedidos activos</p>
                  <p className="text-sm text-black/60">Los nuevos pedidos aparecerán aquí</p>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 'pending':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <Button size="icon" className="bg-green-500 text-black hover:bg-green-600" onClick={() => setActiveSection('dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h2 className="text-2xl font-bold text-black flex items-center gap-2">
                <Clock className="w-6 h-6 text-yellow-500" />
                Pedidos Pendientes ({pendingOrders.length})
              </h2>
            </div>
            {pendingOrders.length === 0 ? (
              <Card className="bg-white/60 backdrop-blur-xl border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
                <CardContent className="py-12 text-center">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500/30" />
                  <p className="text-black/70">No hay pedidos pendientes</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {pendingOrders.map(order => (
                  <Card key={order.id} className="mb-4 bg-white/60 backdrop-blur-xl border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <User className="w-4 h-4 text-black/60" />
                            <span className="font-semibold text-black">{order.customer_name}</span>
                          </div>
                          <p className="text-xs text-black/60">
                            {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: es })}
                          </p>
                        </div>
                        {getStatusBadge(order.status)}
                      </div>

                      {/* Address */}
                      {order.customer_address && (
                        <div className="flex items-start gap-2 mb-3">
                          <MapPin className="w-4 h-4 text-terracotta mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-black/70">{order.customer_address}</p>
                        </div>
                      )}

                      {/* Total */}
                      <div className="flex items-center gap-2 mb-4">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <span className="font-bold text-black">${Number(order.total).toFixed(2)}</span>
                      </div>

                      {/* Action Buttons */}
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => callCustomer(order.customer_phone)}
                            className="flex-1 bg-blue-500 text-black hover:bg-blue-600"
                          >
                            <Phone className="w-4 h-4 mr-1" />
                            Llamar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => openGoogleMaps(order.customer_address)}
                            className="flex-1 bg-blue-500 text-black hover:bg-blue-600"
                          >
                            <MapPin className="w-4 h-4 mr-1" />
                            Mapa
                          </Button>
                        </div>
                        <Button
                          size="lg"
                          className="w-full bg-red-600 hover:bg-red-700 text-black font-bold py-4 text-lg"
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
              <Button size="icon" className="bg-green-500 text-black hover:bg-green-600" onClick={() => setActiveSection('dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h2 className="text-2xl font-bold text-black flex items-center gap-2">
                <Truck className="w-6 h-6 text-blue-500" />
                En Camino ({activeOrders.length})
              </h2>
            </div>
            {activeOrders.length === 0 ? (
              <Card className="bg-white/60 backdrop-blur-xl border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
                <CardContent className="py-12 text-center">
                  <Truck className="w-16 h-16 mx-auto mb-4 text-black/30" />
                  <p className="text-black/70">No tienes entregas en curso</p>
                  <Button 
                    variant="link"
                    className="text-black"
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
                <Card className="border-2 border-green-500 bg-green-50/60 backdrop-blur-xl">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold text-center mb-4 text-black">Acciones de Entrega</h3>
                    <div className="space-y-3">
                      {activeOrders.map(order => (
                        <div key={order.id} className="space-y-2">
                          <p className="text-sm font-medium text-center text-black/70">
                            Pedido de {order.customer_name} - ${Number(order.total).toFixed(2)}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => callCustomer(order.customer_phone)}
                              className="flex-1 bg-blue-500 text-black hover:bg-blue-600"
                            >
                              <Phone className="w-4 h-4 mr-1" />
                              Llamar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => openGoogleMaps(order.customer_address)}
                              className="flex-1 bg-blue-500 text-black hover:bg-blue-600"
                            >
                              <MapPin className="w-4 h-4 mr-1" />
                              Mapa
                            </Button>
                          </div>
                          <Button
                            size="lg"
                            className="w-full bg-green-600 hover:bg-green-700 text-black font-bold py-4 text-lg"
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
              <Button size="icon" className="bg-green-500 text-black hover:bg-green-600" onClick={() => setActiveSection('dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h2 className="text-2xl font-bold text-black flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-green-500" />
                Entregados Hoy ({todayDeliveredOrders.length})
              </h2>
            </div>
            {todayDeliveredOrders.length === 0 ? (
              <Card className="bg-white/60 backdrop-blur-xl border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
                <CardContent className="py-12 text-center">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-black/30" />
                  <p className="text-black/70">No hay entregas completadas hoy</p>
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
              <Button size="icon" className="bg-green-500 text-black hover:bg-green-600" onClick={() => setActiveSection('dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h2 className="text-2xl font-bold text-black flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-emerald-500" />
                Recibido en Efectivo
              </h2>
            </div>
            {cashOrders.length === 0 ? (
              <Card className="bg-white/60 backdrop-blur-xl border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
                <CardContent className="py-12 text-center">
                  <DollarSign className="w-16 h-16 mx-auto mb-4 text-black/30" />
                  <p className="text-black/70">No hay pedidos entregados en efectivo hoy</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="bg-emerald-50/60 backdrop-blur-xl border-emerald-200">
                  <CardContent className="p-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-emerald-600">${cashTotal.toFixed(2)}</p>
                      <p className="text-sm text-black/70">{cashOrders.length} pedidos en efectivo</p>
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
              <Button size="icon" className="bg-green-500 text-black hover:bg-green-600" onClick={() => setActiveSection('dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h2 className="text-2xl font-bold text-black flex items-center gap-2">
                <History className="w-6 h-6 text-black/60" />
                Historial de Entregas
              </h2>
            </div>
            {completedOrders.length === 0 ? (
              <Card className="bg-white/60 backdrop-blur-xl border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
                <CardContent className="py-12 text-center">
                  <History className="w-16 h-16 mx-auto mb-4 text-black/30" />
                  <p className="text-black/70">No hay entregas completadas</p>
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
              <Button size="icon" className="bg-green-500 text-black hover:bg-green-600" onClick={() => setActiveSection('dashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h2 className="text-2xl font-bold text-black flex items-center gap-2">
                <HelpCircle className="w-6 h-6" />
                Centro de Ayuda
              </h2>
            </div>
            <Card className="bg-white/60 backdrop-blur-xl border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
              <CardContent className="p-6 space-y-4">
                <div>
                  <h3 className="font-semibold mb-2 text-black">¿Cómo tomar un pedido?</h3>
                  <p className="text-sm text-black/70">
                    Ve a "Pendientes", selecciona un pedido y presiona "Tomar" para comenzar la entrega.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-black">¿Cómo marcar como entregado?</h3>
                  <p className="text-sm text-black/70">
                    Una vez que entregues el pedido, presiona "Entregado" en la tarjeta del pedido.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2 text-black">¿Problemas con un pedido?</h3>
                  <p className="text-sm text-black/70">
                    Contacta al cliente directamente usando el botón "Llamar" o comunícate con administración.
                  </p>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-black/70">
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex w-full">
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
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white/60 backdrop-blur-xl border-b border-white/20 z-50 safe-area-top">
        <div className="flex items-center justify-between px-4 py-3">
          <img src={logo} alt="Los Taquitos de PM" className="h-8" />
          <button onClick={handleLogout} className="p-2">
            <LogOut className="w-5 h-5 text-terracotta" />
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
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/60 backdrop-blur-xl border-t border-white/20 z-50 safe-area-bottom">
        <nav className="flex justify-around items-center py-2">
          <button
            onClick={() => setActiveSection('dashboard')}
            className={`flex flex-col items-center p-2 min-w-[60px] ${
              activeSection === 'dashboard' ? 'text-primary' : 'text-black/60'
            }`}
          >
            <Package className="w-6 h-6" />
            <span className="text-[10px] mt-1">Inicio</span>
          </button>
          <button
            onClick={() => setActiveSection('pending')}
            className={`flex flex-col items-center p-2 min-w-[60px] relative ${
              activeSection === 'pending' ? 'text-primary' : 'text-black/60'
            }`}
          >
            <Clock className="w-6 h-6" />
            <span className="text-[10px] mt-1">Pendientes</span>
            {pendingOrders.length > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-black text-[10px] rounded-full w-5 h-5 flex items-center justify-center">
                {pendingOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSection('active')}
            className={`flex flex-col items-center p-2 min-w-[60px] relative ${
              activeSection === 'active' ? 'text-primary' : 'text-black/60'
            }`}
          >
            <Truck className="w-6 h-6" />
            <span className="text-[10px] mt-1">En Camino</span>
            {activeOrders.length > 0 && (
              <span className="absolute top-1 right-1 bg-blue-500 text-black text-[10px] rounded-full w-5 h-5 flex items-center justify-center">
                {activeOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSection('cash-received')}
            className={`flex flex-col items-center p-2 min-w-[60px] ${
              activeSection === 'cash-received' ? 'text-primary' : 'text-black/60'
            }`}
          >
            <DollarSign className="w-6 h-6" />
            <span className="text-[10px] mt-1">Efectivo</span>
          </button>
          <button
            onClick={() => setActiveSection('history')}
            className={`flex flex-col items-center p-2 min-w-[60px] ${
              activeSection === 'history' ? 'text-primary' : 'text-black/60'
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
