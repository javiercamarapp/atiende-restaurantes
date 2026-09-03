import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Package, DollarSign, Users, ShoppingCart, Plus, Edit, Trash2, Tag, Upload, Loader2, Menu, X, Truck, Phone, MapPin, Percent, TrendingUp, TrendingDown } from "lucide-react";
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
import { AtiendeMark } from "@/components/AtiendeLogo";
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
  const [dateFilter, setDateFilter] = useState<'today' | '7' | '30' | '90'>('today');
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
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
    const prevOrders = orders.filter(order => {
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
      default: return 'vs período anterior';
    }
  };

  // Sales trend chart data based on date filter
  const salesTrendData = useMemo(() => {
    const now = new Date();
    let intervals: Date[] = [];
    let groupFormat: string;
    
    switch (dateFilter) {
      case 'today':
        for (let i = 23; i >= 0; i--) {
          intervals.push(new Date(now.getTime() - i * 60 * 60 * 1000));
        }
        groupFormat = 'HH:00';
        break;
      case '7':
        for (let i = 6; i >= 0; i--) {
          intervals.push(subDays(now, i));
        }
        groupFormat = 'EEE';
        break;
      case '30':
        for (let i = 29; i >= 0; i--) {
          intervals.push(subDays(now, i));
        }
        groupFormat = 'dd MMM';
        break;
      case '90':
        for (let i = 89; i >= 0; i -= 7) {
          intervals.push(subDays(now, i));
        }
        groupFormat = 'dd MMM';
        break;
      default:
        for (let i = 6; i >= 0; i--) {
          intervals.push(subDays(now, i));
        }
        groupFormat = 'EEE';
    }
    
    return intervals.map(date => {
      const label = format(date, groupFormat, { locale: es });
      let revenue = 0;
      let orderCount = 0;
      
      orders.forEach(order => {
        const orderDate = new Date(order.created_at);
        let matches = false;
        
        if (dateFilter === 'today') {
          matches = format(orderDate, 'yyyy-MM-dd HH') === format(date, 'yyyy-MM-dd HH');
        } else if (dateFilter === '90') {
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

        {/* Desktop Header — una sola barra fina, como barra-acciones.tsx de
            Likida: sin barra de búsqueda, botones h-8 dentro de la misma
            barra en vez de un banner aparte para el modo superadmin. */}
        <header className="hidden md:flex items-center justify-between rounded-2xl border border-border bg-card h-12 px-4 shrink-0 sticky top-3 z-10">
          <h1 className="text-sm font-semibold text-foreground">
            {activeSection === 'dashboard' && 'Estadísticas'}
            {activeSection === 'products' && 'Productos'}
            {activeSection === 'categories' && 'Categorías'}
            {activeSection === 'promos' && 'Promociones'}
            {activeSection === 'orders' && 'Pedidos'}
            {activeSection === 'users' && 'Usuarios'}
            {activeSection === 'repartidores' && 'Repartidores'}
            {activeSection === 'notificaciones' && 'Notificaciones'}
            {activeSection === 'help' && 'Centro de Ayuda'}
          </h1>
          <div className="flex items-center gap-2">
            {searchParams.get("restaurante") && (
              <span className="text-primary text-[13px] font-medium mr-1">
                Viendo la cuenta de {restaurantName ?? "este restaurante"} como superadmin
              </span>
            )}
            {searchParams.get("restaurante") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/admin/superadmin")}
                className="h-8 text-[13px] shrink-0"
              >
                Volver a superadmin
              </Button>
            )}
            <span className="font-mono text-xs text-muted-foreground border border-border rounded-full px-3 py-1.5 shrink-0">
              {format(new Date(), "d MMM yyyy", { locale: es })}
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 space-y-6 overflow-auto">

        {/* Dashboard Stats - Only show on dashboard section */}
        {activeSection === 'dashboard' && (
          <>
            {/* Date Filter and Last Updated */}
            <div className="flex items-center justify-between">
              <Select value={dateFilter} onValueChange={(value: 'today' | '7' | '30' | '90') => setDateFilter(value)}>
                <SelectTrigger className="w-[200px]">
                  <div className="flex flex-col items-start">
                    <span className="text-xs text-muted-foreground">FECHA</span>
                    <span className="text-sm font-medium text-foreground">
                      {dateFilter === 'today' ? 'Hoy' : 
                       dateFilter === '7' ? 'Últimos 7 días' : 
                       dateFilter === '30' ? 'Últimos 30 días' : 
                       'Últimos 90 días'}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="7">Últimos 7 días</SelectItem>
                  <SelectItem value="30">Últimos 30 días</SelectItem>
                  <SelectItem value="90">Últimos 90 días</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Actualizado {format(new Date(), "EEEE d 'de' MMMM, yyyy h:mm a", {
                  locale: es
                })}
              </p>
            </div>

            {/* Tus ventas Section — anatomía exacta del StatCard de Likida:
                chip de ícono sólido, cifra grande, pie con hairline punteado
                (sin píldora de color ni "Ver más" — la tarjeta completa es
                el link, como en el dashboard real de Likida). */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Tus ventas</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button onClick={() => openStatsDialog('revenue')} className="w-full text-left">
                  <StatCard
                    icon={DollarSign}
                    label="Ventas netas"
                    value={`$${filteredStats.revenue.toLocaleString()}`}
                    nota={`${filteredStats.revenueChange >= 0 ? '+' : ''}${filteredStats.revenueChange.toFixed(1)}% ${getPeriodLabel()}`}
                  />
                </button>
                <button onClick={() => openStatsDialog('orders')} className="w-full text-left">
                  <StatCard
                    icon={ShoppingCart}
                    label="Número de órdenes"
                    value={String(filteredStats.orders)}
                    nota={`${filteredStats.ordersChange >= 0 ? '+' : ''}${filteredStats.ordersChange.toFixed(1)}% ${getPeriodLabel()}`}
                  />
                </button>
                <button onClick={() => openStatsDialog('customers')} className="w-full text-left">
                  <StatCard
                    icon={DollarSign}
                    label="Valor promedio"
                    value={`$${filteredStats.averageOrder.toFixed(2)}`}
                    nota={`${filteredStats.avgOrderChange >= 0 ? '+' : ''}${filteredStats.avgOrderChange.toFixed(1)}% ${getPeriodLabel()}`}
                  />
                </button>
              </div>
            </div>

            {/* Sales & Orders Trend Charts */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Tendencias</h2>
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
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)', color: 'hsl(var(--popover-foreground))'
                            }}
                            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Ventas']}
                          />
                          <Line
                            type="monotone"
                            dataKey="ventas"
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2}
                            dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 3 }}
                            activeDot={{ r: 5, fill: 'hsl(var(--primary))' }}
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
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)', color: 'hsl(var(--popover-foreground))'
                            }}
                            formatter={(value: number) => [value, 'Órdenes']}
                          />
                          <Line
                            type="monotone"
                            dataKey="ordenes"
                            stroke="hsl(var(--secondary))" 
                            strokeWidth={2}
                            dot={{ fill: 'hsl(var(--secondary))', strokeWidth: 2, r: 3 }}
                            activeDot={{ r: 5, fill: 'hsl(var(--secondary))' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Tu Operación Section */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Tu Operación</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button className="text-left transition-transform hover:-translate-y-0.5" onClick={() => setActiveSection('products')}>
                  <StatCard icon={Package} label="Total de productos" value={String(stats.products)} />
                </button>
                <button className="text-left transition-transform hover:-translate-y-0.5" onClick={() => setActiveSection('users')}>
                  <StatCard icon={Users} label="Usuarios registrados" value={String(stats.users)} />
                </button>
                <StatCard icon={Users} label="Clientes únicos" value={String(filteredStats.customers)} />
                <button className="text-left transition-transform hover:-translate-y-0.5" onClick={() => setActiveSection('categories')}>
                  <StatCard icon={Tag} label="Categorías" value={String(categories.length)} />
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
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="p-4 flex items-center justify-between border-b border-dashed border-border last:border-0 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Tag className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{category.name}</p>
                        <p className="text-sm text-foreground">{category.slug}</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      Activa
                    </span>
                  </div>
                ))}
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
                          contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', color: 'hsl(var(--popover-foreground))'
                          }}
                          formatter={(value: number) => [selectedStat === 'revenue' ? `$${value.toLocaleString()}` : value, getStatTitle()]} />
                        <Bar dataKey="value" fill={selectedStat === 'revenue' ? 'hsl(142 71% 45%)' : selectedStat === 'customers' ? 'hsl(var(--primary))' : selectedStat === 'orders' ? 'hsl(var(--secondary))' : 'hsl(142 71% 45%)'} radius={[4, 4, 0, 0]} />
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

        {activeSection === 'notificaciones' && (
          <div className="max-w-xl">
            <NotificacionesSection userId={user?.id} />
          </div>
        )}

        </main>
      </div>
    </div>;
};
export default AdminDashboard;