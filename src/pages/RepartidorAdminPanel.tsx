import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Truck, Phone, Mail, Calendar, Package, Clock, CheckCircle, DollarSign, MapPin } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AtiendeMark } from "@/components/AtiendeLogo";
import { StatCard } from "@/components/admin/ui/StatCard";

const ADMIN_EMAIL = "javiercamaraportepetit@gmail.com";

interface Repartidor {
  user_id: string;
  email: string;
  nombre: string | null;
  telefono: string | null;
  created_at: string;
}

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  total: number;
  status: string | null;
  created_at: string;
  items: any;
}

const RepartidorAdminPanel = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [repartidor, setRepartidor] = useState<Repartidor | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState({
    totalDeliveries: 0,
    pendingDeliveries: 0,
    completedToday: 0,
    totalEarnings: 0
  });

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email !== ADMIN_EMAIL) {
        navigate("/admin/login");
        return;
      }

      if (!userId) {
        navigate("/admin");
        return;
      }

      // Fetch repartidor profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, email, nombre, telefono, created_at")
        .eq("user_id", userId)
        .single();

      if (!profileData) {
        navigate("/admin");
        return;
      }

      setRepartidor(profileData);

      // Fetch all orders (in a real app, you'd filter by assigned repartidor)
      const { data: ordersData } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      setOrders(ordersData || []);

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayOrders = (ordersData || []).filter(o => 
        new Date(o.created_at) >= today
      );
      
      const completedOrders = (ordersData || []).filter(o => 
        o.status === 'completado' || o.status === 'entregado'
      );

      const pendingOrders = (ordersData || []).filter(o => 
        o.status === 'pending' || o.status === 'en_camino'
      );

      setStats({
        totalDeliveries: completedOrders.length,
        pendingDeliveries: pendingOrders.length,
        completedToday: todayOrders.filter(o => o.status === 'completado' || o.status === 'entregado').length,
        totalEarnings: completedOrders.reduce((sum, o) => sum + Number(o.total), 0)
      });

      setLoading(false);
    };

    checkAuthAndFetch();
  }, [userId, navigate]);

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'completado':
      case 'entregado':
        return 'bg-green-100 text-green-700';
      case 'en_camino':
        return 'bg-blue-100 text-blue-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'completado':
      case 'entregado':
        return 'Entregado';
      case 'en_camino':
        return 'En camino';
      case 'pending':
        return 'Pendiente';
      default:
        return status || 'Pendiente';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!repartidor) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin")}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <AtiendeMark className="h-8 w-auto" />
        <h1 className="font-semibold text-foreground">Panel del Repartidor</h1>
      </header>

      <main className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
        {/* Repartidor Info Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Truck className="w-10 h-10 text-primary" />
              </div>
              <div className="flex-1 space-y-2">
                <h2 className="text-2xl font-bold text-foreground">
                  {repartidor.nombre || 'Sin nombre'}
                </h2>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {repartidor.email}
                  </div>
                  {repartidor.telefono && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {repartidor.telefono}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Desde {format(new Date(repartidor.created_at), "d MMM yyyy", { locale: es })}
                  </div>
                </div>
              </div>
              <span className="px-4 py-2 bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400 rounded-full text-sm font-medium self-start md:self-center">
                Activo
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Package} label="Total Entregas" value={String(stats.totalDeliveries)} />
          <StatCard icon={Clock} label="Pendientes" value={String(stats.pendingDeliveries)} />
          <StatCard icon={CheckCircle} label="Hoy" value={String(stats.completedToday)} />
          <StatCard icon={DollarSign} label="Total Cobrado" value={`$${stats.totalEarnings.toLocaleString()}`} />
        </div>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Pedidos Recientes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {orders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No hay pedidos registrados
              </div>
            ) : (
              <div className="divide-y divide-border">
                {orders.map((order) => (
                  <div key={order.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-foreground truncate">
                            {order.customer_name}
                          </p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {order.customer_phone}
                        </p>
                        {order.customer_address && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {order.customer_address}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-foreground">${order.total.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(order.created_at), "d MMM, HH:mm", { locale: es })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default RepartidorAdminPanel;
