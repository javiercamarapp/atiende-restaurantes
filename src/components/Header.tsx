import { useState, useEffect } from 'react';
import { ShoppingBag, MapPin, Phone, ChevronDown, Navigation, Menu, X, User, UtensilsCrossed, Tag, Shirt, PartyPopper, Shield, LogOut, ChevronRight, HelpCircle, Edit3, ArrowLeft, Save, Loader2, Camera, Truck, ClipboardList, Headphones, CreditCard, Star, Ticket, Receipt, MapPinned } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '@/assets/logo.avif';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCart } from '@/context/CartContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';
import PaymentMethodsSheet from '@/components/PaymentMethodsSheet';

interface HeaderProps {
  onCartClick: () => void;
}
const sucursales = [{
  name: 'Altabrisa',
  phones: ['999 518 2857'],
  coords: { lat: 21.0156, lng: -89.5982 }
}, {
  name: 'García Lavín',
  phones: ['999 518 2637'],
  coords: { lat: 21.0205, lng: -89.6150 }
}, {
  name: 'Prol. Montejo',
  phones: ['999 944 0342'],
  coords: { lat: 21.0280, lng: -89.6100 }
}, {
  name: 'Fco. de Montejo',
  phones: ['999 953 7122'],
  coords: { lat: 21.0350, lng: -89.6050 }
}, {
  name: 'Galerías',
  phones: [],
  coords: { lat: 21.0400, lng: -89.5900 }
}, {
  name: 'Chicxulub',
  phones: ['968 688 4195'],
  coords: { lat: 21.2960, lng: -89.6020 }
}, {
  name: 'Pensiones',
  phones: ['999 987 5410'],
  coords: { lat: 20.9800, lng: -89.6300 }
}];
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
const Header = ({
  onCartClick
}: HeaderProps) => {
  const {
    itemCount
  } = useCart();
  const navigate = useNavigate();
  const [selectedBranch, setSelectedBranch] = useState(sucursales[0]);
  const [isLocating, setIsLocating] = useState(false);
  const [hasManualSelection, setHasManualSelection] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profileData, setProfileData] = useState<{ nombre: string | null; email: string; telefono: string | null; avatar_url: string | null } | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editTelefono, setEditTelefono] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [recentOrders, setRecentOrders] = useState<Array<{
    id: string;
    created_at: string;
    items: Array<{ name: string; quantity: number; image?: string }>;
    total: number;
    status: string;
  }>>([]);
  const [allOrders, setAllOrders] = useState<Array<{
    id: string;
    created_at: string;
    items: Array<{ name: string; quantity: number; image?: string }>;
    total: number;
    status: string;
  }>>([]);
  
  const { isAdmin, isRepartidor } = useUserRole(user);

  const fetchRecentOrders = async (telefono: string) => {
    const { data } = await supabase
      .from('orders')
      .select('id, created_at, items, total, status')
      .eq('customer_phone', telefono)
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (data) {
      setRecentOrders(data.map(order => ({
        ...order,
        items: order.items as Array<{ name: string; quantity: number; image?: string }>
      })));
    }
  };

  const fetchAllOrders = async (telefono: string) => {
    const { data } = await supabase
      .from('orders')
      .select('id, created_at, items, total, status')
      .eq('customer_phone', telefono)
      .order('created_at', { ascending: false });
    
    if (data) {
      setAllOrders(data.map(order => ({
        ...order,
        items: order.items as Array<{ name: string; quantity: number; image?: string }>
      })));
    }
  };

  const handleShowAllOrders = () => {
    if (profileData?.telefono) {
      fetchAllOrders(profileData.telefono);
    }
    setShowAllOrders(true);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfileData(null);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("nombre, email, telefono, avatar_url")
      .eq("user_id", userId)
      .maybeSingle();
    
    if (data) {
      setProfileData(data);
      setEditNombre(data.nombre || "");
      setEditTelefono(data.telefono || "");
      if (data.telefono) {
        fetchRecentOrders(data.telefono);
      }
    } else {
      // No profile exists, use user metadata as fallback
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const fallbackData = {
          nombre: authUser.user_metadata?.nombre || null,
          email: authUser.email || "",
          telefono: authUser.user_metadata?.telefono || null,
          avatar_url: null
        };
        setProfileData(fallbackData);
        setEditNombre(fallbackData.nombre || "");
        setEditTelefono(fallbackData.telefono || "");
        if (fallbackData.telefono) {
          fetchRecentOrders(fallbackData.telefono);
        }
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    
    // Use upsert to create or update the profile
    const { error } = await supabase
      .from("profiles")
      .upsert({ 
        user_id: user.id, 
        email: user.email || "",
        nombre: editNombre, 
        telefono: editTelefono 
      }, { 
        onConflict: 'user_id' 
      });

    if (error) {
      toast.error("No se pudo guardar");
    } else {
      setProfileData(prev => prev ? { ...prev, nombre: editNombre, telefono: editTelefono } : { nombre: editNombre, email: user.email || "", telefono: editTelefono, avatar_url: null });
      toast.success("Perfil actualizado");
      setIsEditingProfile(false);
    }
    setSavingProfile(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingAvatar(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/avatar.${fileExt}`;

    // Delete old avatar if exists
    await supabase.storage.from('avatars').remove([filePath]);

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error("No se pudo subir la imagen");
      setUploadingAvatar(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
    
    // Use upsert to create or update the profile with avatar
    const { error: updateError } = await supabase
      .from("profiles")
      .upsert({ 
        user_id: user.id, 
        email: user.email || "",
        avatar_url: publicUrl 
      }, { 
        onConflict: 'user_id' 
      });

    if (!updateError) {
      setProfileData(prev => prev ? { ...prev, avatar_url: publicUrl } : { nombre: null, email: user.email || "", telefono: null, avatar_url: publicUrl });
      toast.success("Foto actualizada");
    } else {
      toast.error("No se pudo guardar la foto");
    }
    setUploadingAvatar(false);
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };
  useEffect(() => {
    // Check for saved preference first
    const savedBranch = localStorage.getItem('selectedBranch');
    if (savedBranch) {
      const found = sucursales.find(s => s.name === savedBranch);
      if (found) {
        setSelectedBranch(found);
        setHasManualSelection(true);
        return;
      }
    }

    // If no saved preference, use geolocation
    if ('geolocation' in navigator) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(position => {
        const {
          latitude,
          longitude
        } = position.coords;
        let minDistance = Infinity;
        let closest = sucursales[0];
        sucursales.forEach(sucursal => {
          const distance = calculateDistance(latitude, longitude, sucursal.coords.lat, sucursal.coords.lng);
          if (distance < minDistance) {
            minDistance = distance;
            closest = sucursal;
          }
        });
        setSelectedBranch(closest);
        setIsLocating(false);
      }, () => {
        setIsLocating(false);
      }, {
        timeout: 5000
      });
    }
  }, []);
  const handleSelectBranch = (sucursal: typeof sucursales[0]) => {
    setSelectedBranch(sucursal);
    setHasManualSelection(true);
    localStorage.setItem('selectedBranch', sucursal.name);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfileData(null);
    setProfileSheetOpen(false);
  };
  return <header className="fixed top-4 left-4 right-4 z-50 bg-primary rounded-2xl shadow-elevated">
      <div className="container flex items-center justify-between h-14 md:h-16">
        {/* Mobile: hamburger menu on left */}
        <div className="md:hidden">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-primary-foreground hover:text-terracotta hover:bg-terracotta/10">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-primary border-r border-primary-foreground/10 p-0 rounded-r-3xl">
              <div className="flex flex-col h-full">
                <div className="p-4 border-b border-primary-foreground/10">
                  <img src={logo} alt="Los Taquitos de PM" className="h-12 w-auto" />
                </div>
                <nav className="flex flex-col p-4 gap-2">
                  <Link to="/#menu" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-primary-foreground/80 hover:text-primary-foreground py-3 px-4 rounded-lg hover:bg-primary-foreground/10 transition-colors flex items-center gap-3">
                    <UtensilsCrossed className="w-5 h-5" />
                    Menú
                  </Link>
                  <Link to="/#promociones" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-primary-foreground/80 hover:text-primary-foreground py-3 px-4 rounded-lg hover:bg-primary-foreground/10 transition-colors flex items-center gap-3">
                    <Tag className="w-5 h-5" />
                    Promociones
                  </Link>
                  <Link to="/#merch" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-primary-foreground/80 hover:text-primary-foreground py-3 px-4 rounded-lg hover:bg-primary-foreground/10 transition-colors flex items-center gap-3">
                    <Shirt className="w-5 h-5" />
                    Merch
                  </Link>
                  <Link to="/#sucursales" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-primary-foreground/80 hover:text-primary-foreground py-3 px-4 rounded-lg hover:bg-primary-foreground/10 transition-colors flex items-center gap-3">
                    <MapPin className="w-5 h-5" />
                    Sucursales
                  </Link>
                  <Link to="/eventos" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-primary-foreground/80 hover:text-primary-foreground py-3 px-4 rounded-lg hover:bg-primary-foreground/10 transition-colors flex items-center gap-3">
                    <PartyPopper className="w-5 h-5" />
                    Servicio de Eventos
                  </Link>
                </nav>
                
                <div className="mt-auto p-4 border-t border-primary-foreground/10">
                  <p className="text-sm font-medium text-primary-foreground mb-3 flex items-center gap-2">
                    <Navigation className="w-4 h-4" />
                    Sucursal: {selectedBranch.name}
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {sucursales.map(sucursal => <button key={sucursal.name} onClick={() => {
                    handleSelectBranch(sucursal);
                    setMobileMenuOpen(false);
                  }} className={`w-full text-left p-3 rounded-lg transition-colors ${sucursal.name === selectedBranch.name ? 'bg-primary-foreground/20 text-primary-foreground' : 'text-primary-foreground/70 hover:bg-primary-foreground/10'}`}>
                        <p className="font-medium">{sucursal.name}</p>
                        <p className="text-xs mt-1 opacity-70">{sucursal.phones[0] || 'Sin teléfono'}</p>
                      </button>)}
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Logo - centered on mobile */}
        <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0">
          <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src={logo} alt="Los Taquitos de PM" className="h-10 md:h-12 w-auto" />
          </Link>
        </div>

        {/* Mobile: account and cart on right */}
        <div className="md:hidden flex items-center gap-2">
          {user ? (
            isAdmin ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button 
                    className="h-8 w-8 flex items-center justify-center text-gold hover:-translate-y-1 transition-transform"
                  >
                    <Shield className="w-5 h-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-terracotta border-none rounded-2xl p-2">
                  <DropdownMenuItem 
                    onClick={() => navigate('/admin')}
                    className="text-white hover:bg-terracotta-dark focus:bg-terracotta-dark rounded-xl py-3 px-4 cursor-pointer"
                  >
                    <Shield className="w-5 h-5 mr-3" />
                    <span className="text-lg font-medium">Panel Admin</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => toast.success('Cambios guardados correctamente')}
                    className="text-white hover:bg-terracotta-dark focus:bg-terracotta-dark rounded-xl py-3 px-4 cursor-pointer"
                  >
                    <Save className="w-5 h-5 mr-3" />
                    <span className="text-lg font-medium">Guardar Cambios</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/20 my-1" />
                  <DropdownMenuItem 
                    onClick={handleLogout}
                    className="text-white/70 hover:bg-terracotta-dark focus:bg-terracotta-dark rounded-xl py-3 px-4 cursor-pointer"
                  >
                    <LogOut className="w-5 h-5 mr-3" />
                    <span className="text-lg font-medium">Cerrar Sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : isRepartidor ? (
              <button 
                onClick={() => navigate('/repartidor')}
                className="h-8 w-8 flex items-center justify-center text-green-400 hover:-translate-y-1 transition-transform"
              >
                <Truck className="w-5 h-5" />
              </button>
            ) : (
            <Sheet open={profileSheetOpen} onOpenChange={(open) => { setProfileSheetOpen(open); if (!open) { setShowAllOrders(false); setIsEditingProfile(false); } }}>
              <SheetTrigger asChild>
                <button className="h-8 w-8 flex items-center justify-center text-white hover:-translate-y-1 transition-transform">
                  <User className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 bg-primary border-l border-primary-foreground/10 p-0 rounded-l-3xl">
                <div className="flex flex-col h-full">
                  {showAllOrders ? (
                    <>
                      {/* All Orders Header */}
                      <div className="p-4 border-b border-primary-foreground/10 flex items-center gap-3">
                        <button onClick={() => setShowAllOrders(false)} className="text-primary-foreground">
                          <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h2 className="text-lg font-bold text-primary-foreground">Mis Pedidos</h2>
                      </div>
                      
                      {/* Orders List */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {allOrders.length > 0 ? (
                          allOrders.map((order) => {
                            const firstItem = order.items[0];
                            const itemsDescription = order.items.map(i => `${i.quantity}x ${i.name}`).join(', ');
                            const orderDate = new Date(order.created_at).toLocaleDateString('es-MX', { 
                              day: '2-digit', 
                              month: 'short',
                              year: 'numeric'
                            });
                            const statusColors: Record<string, string> = {
                              pending: 'bg-yellow-500/20 text-yellow-300',
                              preparing: 'bg-blue-500/20 text-blue-300',
                              ready: 'bg-green-500/20 text-green-300',
                              delivered: 'bg-primary-foreground/20 text-primary-foreground',
                              cancelled: 'bg-red-500/20 text-red-300'
                            };
                            const statusLabels: Record<string, string> = {
                              pending: 'Pendiente',
                              preparing: 'Preparando',
                              ready: 'Listo',
                              delivered: 'Entregado',
                              cancelled: 'Cancelado'
                            };
                            return (
                              <div key={order.id} className="bg-primary-foreground/5 rounded-xl p-3">
                                <div className="flex items-start gap-3">
                                  {firstItem?.image ? (
                                    <img 
                                      src={firstItem.image} 
                                      alt={firstItem.name}
                                      className="w-14 h-14 rounded-lg object-cover"
                                    />
                                  ) : (
                                    <div className="w-14 h-14 bg-terracotta rounded-lg flex items-center justify-center">
                                      <span className="text-white text-2xl">🌮</span>
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-sm font-semibold text-primary-foreground">{orderDate}</p>
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[order.status] || statusColors.pending}`}>
                                        {statusLabels[order.status] || 'Pendiente'}
                                      </span>
                                    </div>
                                    <p className="text-xs text-primary-foreground/60 mt-1 line-clamp-2">{itemsDescription}</p>
                                    <p className="text-sm font-bold text-terracotta mt-2">${order.total.toFixed(2)}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="w-16 h-16 bg-primary-foreground/10 rounded-full flex items-center justify-center mb-4">
                              <ClipboardList className="w-8 h-8 text-primary-foreground/40" />
                            </div>
                            <p className="text-primary-foreground/60 font-medium">No tienes pedidos</p>
                            <p className="text-primary-foreground/40 text-sm mt-1">¡Haz tu primer pedido!</p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : isEditingProfile ? (
                    <>
                      {/* Edit Header */}
                      <div className="p-4 border-b border-primary-foreground/10 flex items-center gap-3">
                        <button onClick={() => setIsEditingProfile(false)} className="text-primary-foreground">
                          <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h2 className="text-lg font-bold text-primary-foreground">Editar Perfil</h2>
                      </div>
                      
                      {/* Avatar Upload */}
                      <div className="p-4 flex flex-col items-center">
                        <label className="relative cursor-pointer group">
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleAvatarUpload}
                            className="hidden"
                          />
                          {profileData?.avatar_url ? (
                            <img 
                              src={profileData.avatar_url} 
                              alt="Avatar" 
                              className="w-20 h-20 rounded-full object-cover border-2 border-primary-foreground/20"
                            />
                          ) : (
                            <div className="w-20 h-20 rounded-full bg-terracotta flex items-center justify-center text-white font-bold text-xl">
                              {getInitials(profileData?.nombre || null, profileData?.email || user.email || "")}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            {uploadingAvatar ? (
                              <Loader2 className="w-6 h-6 text-white animate-spin" />
                            ) : (
                              <Camera className="w-6 h-6 text-white" />
                            )}
                          </div>
                        </label>
                        <p className="text-primary-foreground/60 text-xs mt-2">Toca para cambiar foto</p>
                      </div>

                      {/* Edit Form */}
                      <div className="p-4 space-y-4">
                        <div className="space-y-1">
                          <Label className="text-primary-foreground text-sm">Nombre</Label>
                          <Input
                            value={editNombre}
                            onChange={(e) => setEditNombre(e.target.value)}
                            placeholder="Tu nombre"
                            className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-primary-foreground text-sm">Teléfono</Label>
                          <Input
                            value={editTelefono}
                            onChange={(e) => setEditTelefono(e.target.value)}
                            placeholder="999 123 4567"
                            className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-primary-foreground text-sm">Email</Label>
                          <Input
                            value={profileData?.email || ""}
                            disabled
                            className="bg-primary-foreground/5 border-primary-foreground/10 text-primary-foreground/50"
                          />
                        </div>
                      </div>

                      {/* Save Button */}
                      <div className="mt-auto p-4">
                        <Button
                          onClick={handleSaveProfile}
                          disabled={savingProfile}
                          className="w-full bg-terracotta hover:bg-terracotta/90 text-white"
                        >
                          {savingProfile ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
                          ) : (
                            <><Save className="w-4 h-4 mr-2" /> Guardar</>
                          )}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Header */}
                      <div className="p-4 border-b border-primary-foreground/10">
                        <h2 className="text-xl font-bold text-primary-foreground">Cuenta</h2>
                      </div>
                      
                      {/* Profile Card */}
                      <div className="p-4">
                        <button 
                          onClick={() => setIsEditingProfile(true)}
                          className="w-full flex items-center gap-3 bg-primary-foreground/10 rounded-xl p-3 text-left"
                        >
                          {profileData?.avatar_url ? (
                            <img 
                              src={profileData.avatar_url} 
                              alt="Avatar" 
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-terracotta flex items-center justify-center text-white font-bold">
                              {getInitials(profileData?.nombre || null, profileData?.email || user.email || "")}
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="text-primary-foreground font-semibold">
                              {profileData?.nombre || user.email?.split('@')[0]}
                            </p>
                            <p className="text-primary-foreground/60 text-sm flex items-center gap-1">
                              Editar perfil <ChevronRight className="w-3 h-3" />
                            </p>
                          </div>
                        </button>
                      </div>

                      {/* Quick Access Cards */}
                      <div className="px-4 py-3">
                        <div className="grid grid-cols-3 gap-2">
                          <button 
                            onClick={handleShowAllOrders}
                            className="flex flex-col items-center justify-center bg-primary-foreground/10 rounded-xl p-3 hover:bg-primary-foreground/20 transition-colors"
                          >
                            <ClipboardList className="w-6 h-6 text-primary-foreground mb-1" />
                            <span className="text-xs text-primary-foreground font-medium">Pedidos</span>
                          </button>
                          <a 
                            href="https://wa.me/5219995182857"
                            className="flex flex-col items-center justify-center bg-primary-foreground/10 rounded-xl p-3 hover:bg-primary-foreground/20 transition-colors"
                          >
                            <Headphones className="w-6 h-6 text-primary-foreground mb-1" />
                            <span className="text-xs text-primary-foreground font-medium">Ayuda</span>
                          </a>
                          <PaymentMethodsSheet 
                            user={user}
                            trigger={
                              <button 
                                className="flex flex-col items-center justify-center bg-primary-foreground/10 rounded-xl p-3 hover:bg-primary-foreground/20 transition-colors"
                              >
                                <CreditCard className="w-6 h-6 text-primary-foreground mb-1" />
                                <span className="text-xs text-primary-foreground font-medium text-center leading-tight">Métodos de pago</span>
                              </button>
                            }
                          />
                        </div>
                      </div>

                      {/* Últimos Pedidos */}
                      <div className="px-4 py-3">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-primary-foreground">Últimos pedidos</h3>
                          <button 
                            onClick={handleShowAllOrders}
                            className="text-xs bg-primary-foreground/20 text-primary-foreground px-3 py-1 rounded-full hover:bg-primary-foreground/30 transition-colors"
                          >
                            Ver todos
                          </button>
                        </div>
                        <div className="space-y-2">
                          {recentOrders.length > 0 ? (
                            recentOrders.map((order) => {
                              const firstItem = order.items[0];
                              const itemsDescription = order.items.map(i => `${i.quantity}x ${i.name}`).join(', ');
                              const orderDate = new Date(order.created_at).toLocaleDateString('es-MX', { 
                                day: '2-digit', 
                                month: 'short' 
                              });
                              return (
                                <div key={order.id} className="flex items-center gap-3 bg-primary-foreground/5 rounded-lg p-2 hover:bg-primary-foreground/10 transition-colors cursor-pointer">
                                  {firstItem?.image ? (
                                    <img 
                                      src={firstItem.image} 
                                      alt={firstItem.name}
                                      className="w-10 h-10 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 bg-terracotta rounded-full flex items-center justify-center">
                                      <span className="text-white text-lg">🌮</span>
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-primary-foreground">{orderDate}</p>
                                    <p className="text-xs text-primary-foreground/60 truncate">{itemsDescription}</p>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-primary-foreground/40 flex-shrink-0" />
                                </div>
                              );
                            })
                          ) : (
                            <div className="flex items-center gap-3 bg-primary-foreground/5 rounded-lg p-2">
                              <div className="w-10 h-10 bg-terracotta/50 rounded-full flex items-center justify-center">
                                <span className="text-white text-lg">🌮</span>
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-primary-foreground/60">Sin pedidos</p>
                                <p className="text-xs text-primary-foreground/40">¡Haz tu primer pedido!</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Beneficios Section */}
                      <div className="px-4 py-3 border-t border-primary-foreground/10">
                        <h3 className="text-sm font-bold text-primary-foreground mb-2">Beneficios</h3>
                        <div className="divide-y divide-primary-foreground/10">
                          <button className="w-full flex items-center justify-between py-3 text-primary-foreground hover:bg-primary-foreground/5 transition-colors -mx-1 px-1 rounded">
                            <div className="flex items-center gap-3">
                              <Star className="w-5 h-5" />
                              <span className="text-sm">Puntos Taquitos</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gold">0 pts</span>
                            </div>
                          </button>
                          <button className="w-full flex items-center justify-between py-3 text-primary-foreground hover:bg-primary-foreground/5 transition-colors -mx-1 px-1 rounded">
                            <div className="flex items-center gap-3">
                              <Ticket className="w-5 h-5" />
                              <span className="text-sm">Cupones</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-primary-foreground/40" />
                          </button>
                        </div>
                      </div>

                      {/* Mi cuenta Section */}
                      <div className="px-4 py-3 border-t border-primary-foreground/10 flex-1 overflow-y-auto">
                        <h3 className="text-sm font-bold text-primary-foreground mb-2">Mi cuenta</h3>
                        <div className="divide-y divide-primary-foreground/10">
                          {isRepartidor && (
                            <Link 
                              to="/repartidor" 
                              onClick={() => setProfileSheetOpen(false)} 
                              className="w-full flex items-center justify-between py-3 text-green-400 hover:bg-primary-foreground/5 transition-colors -mx-1 px-1 rounded"
                            >
                              <div className="flex items-center gap-3">
                                <Truck className="w-5 h-5" />
                                <span className="text-sm font-medium">Panel Repartidor</span>
                              </div>
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                          )}
                          {isAdmin && (
                            <Link 
                              to="/admin" 
                              onClick={() => setProfileSheetOpen(false)} 
                              className="w-full flex items-center justify-between py-3 text-gold hover:bg-primary-foreground/5 transition-colors -mx-1 px-1 rounded"
                            >
                              <div className="flex items-center gap-3">
                                <Shield className="w-5 h-5" />
                                <span className="text-sm font-medium">Panel Admin</span>
                              </div>
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                          )}
                          <button className="w-full flex items-center justify-between py-3 text-primary-foreground hover:bg-primary-foreground/5 transition-colors -mx-1 px-1 rounded">
                            <div className="flex items-center gap-3">
                              <MapPinned className="w-5 h-5" />
                              <span className="text-sm">Mis direcciones</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-primary-foreground/40" />
                          </button>
                          <PaymentMethodsSheet 
                            user={user}
                            trigger={
                              <button 
                                className="w-full flex items-center justify-between py-3 text-primary-foreground hover:bg-primary-foreground/5 transition-colors -mx-1 px-1 rounded"
                              >
                                <div className="flex items-center gap-3">
                                  <CreditCard className="w-5 h-5" />
                                  <span className="text-sm">Métodos de pago</span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-primary-foreground/40" />
                              </button>
                            }
                          />
                        </div>
                      </div>

                      {/* Logout */}
                      <div className="mt-auto p-3 border-t border-primary-foreground/10">
                        <button 
                          onClick={handleLogout}
                          className="w-full text-sm font-medium text-primary-foreground/70 py-2 px-3 rounded-lg hover:bg-primary-foreground/10 transition-colors flex items-center gap-2"
                        >
                          <LogOut className="w-4 h-4" />
                          Cerrar sesión
                        </button>
                        <p className="text-center text-primary-foreground/40 text-[10px] mt-2">
                          Hecho con 🧡 en Mérida
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
            )
          ) : (
            <Link to="/auth" className="h-8 w-8 flex items-center justify-center text-white hover:-translate-y-1 transition-transform">
              <User className="w-5 h-5" />
            </Link>
          )}
          <Button variant="terracotta" size="sm" onClick={onCartClick} className="relative h-8 w-8 p-0">
            <ShoppingBag className="w-4 h-4" />
            {itemCount > 0 && <span className="absolute -top-1 -right-1 bg-gold text-gold-foreground text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {itemCount}
              </span>}
          </Button>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <Link to="/#menu" className="text-sm font-medium text-primary-foreground/80 hover:text-primary-foreground transition-colors">
            Menú
          </Link>
          <Link to="/#promociones" className="text-sm font-medium text-primary-foreground/80 hover:text-primary-foreground transition-colors">
            Promociones
          </Link>
          <Link to="/#merch" className="text-sm font-medium text-primary-foreground/80 hover:text-primary-foreground transition-colors">
            Merch
          </Link>
          <Link to="/#sucursales" className="text-sm font-medium text-primary-foreground/80 hover:text-primary-foreground transition-colors">
            Sucursales
          </Link>
          <Link to="/eventos" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-sm font-medium text-primary-foreground/80 hover:text-primary-foreground transition-colors">
            Eventos
          </Link>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-sm">
              <Navigation className={`w-4 h-4 text-primary-foreground ${isLocating ? 'animate-pulse' : ''}`} />
              <span className="text-primary-foreground font-medium">
                {isLocating ? 'Detectando...' : selectedBranch.name}
              </span>
              {hasManualSelection && <span className="text-xs text-primary-foreground/60">(guardado)</span>}
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-sm text-primary-foreground/80 hover:text-primary-foreground transition-colors cursor-pointer">
                <ChevronDown className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 bg-background border border-border shadow-elevated p-3 z-50">
                {sucursales.map(sucursal => <div key={sucursal.name} className={`mb-3 last:mb-0 p-3 rounded-lg transition-colors cursor-pointer hover:bg-muted/50 ${sucursal.name === selectedBranch.name ? 'bg-primary/10 border border-primary/20' : 'border border-transparent'}`} onClick={() => handleSelectBranch(sucursal)}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-foreground flex items-center gap-2">
                        🌮 {sucursal.name}
                      </p>
                      {sucursal.name === selectedBranch.name ? <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                          Seleccionada
                        </span> : <span className="text-xs text-muted-foreground hover:text-primary">
                          Seleccionar
                        </span>}
                    </div>
                    <div className="space-y-1 pl-6">
                      {sucursal.phones.map(phone => <a key={phone} href={`tel:${phone.replace(/\s/g, '')}`} onClick={e => e.stopPropagation()} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                          <Phone className="w-3 h-3" />
                          {phone}
                        </a>)}
                    </div>
                  </div>)}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>

        {/* Desktop account and cart buttons */}
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            isAdmin ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="default" 
                    className="text-gold hover:bg-primary-foreground/10 hover:-translate-y-1 transition-all"
                  >
                    <Shield className="w-5 h-5" />
                    <span className="max-w-[100px] truncate">Admin</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-terracotta border-none rounded-2xl p-2">
                  <DropdownMenuItem 
                    onClick={() => navigate('/admin')}
                    className="text-white hover:bg-terracotta-dark focus:bg-terracotta-dark rounded-xl py-3 px-4 cursor-pointer"
                  >
                    <Shield className="w-5 h-5 mr-3" />
                    <span className="text-lg font-medium">Panel Admin</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => toast.success('Cambios guardados correctamente')}
                    className="text-white hover:bg-terracotta-dark focus:bg-terracotta-dark rounded-xl py-3 px-4 cursor-pointer"
                  >
                    <Save className="w-5 h-5 mr-3" />
                    <span className="text-lg font-medium">Guardar Cambios</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/20 my-1" />
                  <DropdownMenuItem 
                    onClick={handleLogout}
                    className="text-white/70 hover:bg-terracotta-dark focus:bg-terracotta-dark rounded-xl py-3 px-4 cursor-pointer"
                  >
                    <LogOut className="w-5 h-5 mr-3" />
                    <span className="text-lg font-medium">Cerrar Sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : isRepartidor ? (
              <Button 
                variant="ghost" 
                size="default" 
                onClick={() => navigate('/repartidor')}
                className="text-green-400 hover:bg-primary-foreground/10 hover:-translate-y-1 transition-all"
              >
                <Truck className="w-5 h-5" />
                <span className="max-w-[100px] truncate">Repartidor</span>
              </Button>
            ) : (
            <>
              <Sheet open={profileSheetOpen} onOpenChange={(open) => { setProfileSheetOpen(open); if (!open) { setShowAllOrders(false); setIsEditingProfile(false); } }}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="default" className="text-primary-foreground hover:bg-primary-foreground/10 hover:-translate-y-1 transition-all">
                    <User className="w-5 h-5" />
                    <span className="max-w-[100px] truncate">{user.email?.split('@')[0]}</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80 bg-primary border-l border-primary-foreground/10 p-0 rounded-l-3xl">
                  <div className="flex flex-col h-full">
                    {showAllOrders ? (
                      <>
                        {/* All Orders Header */}
                        <div className="p-4 border-b border-primary-foreground/10 flex items-center gap-3">
                          <button onClick={() => setShowAllOrders(false)} className="text-primary-foreground">
                            <ArrowLeft className="w-5 h-5" />
                          </button>
                          <h2 className="text-lg font-bold text-primary-foreground">Mis Pedidos</h2>
                        </div>
                        
                        {/* Orders List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                          {allOrders.length > 0 ? (
                            allOrders.map((order) => {
                              const firstItem = order.items[0];
                              const itemsDescription = order.items.map(i => `${i.quantity}x ${i.name}`).join(', ');
                              const orderDate = new Date(order.created_at).toLocaleDateString('es-MX', { 
                                day: '2-digit', 
                                month: 'short',
                                year: 'numeric'
                              });
                              const statusColors: Record<string, string> = {
                                pending: 'bg-yellow-500/20 text-yellow-300',
                                preparing: 'bg-blue-500/20 text-blue-300',
                                ready: 'bg-green-500/20 text-green-300',
                                delivered: 'bg-primary-foreground/20 text-primary-foreground',
                                cancelled: 'bg-red-500/20 text-red-300'
                              };
                              const statusLabels: Record<string, string> = {
                                pending: 'Pendiente',
                                preparing: 'Preparando',
                                ready: 'Listo',
                                delivered: 'Entregado',
                                cancelled: 'Cancelado'
                              };
                              return (
                                <div key={order.id} className="bg-primary-foreground/5 rounded-xl p-3">
                                  <div className="flex items-start gap-3">
                                    {firstItem?.image ? (
                                      <img 
                                        src={firstItem.image} 
                                        alt={firstItem.name}
                                        className="w-14 h-14 rounded-lg object-cover"
                                      />
                                    ) : (
                                      <div className="w-14 h-14 bg-terracotta rounded-lg flex items-center justify-center">
                                        <span className="text-white text-2xl">🌮</span>
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-primary-foreground">{orderDate}</p>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[order.status] || statusColors.pending}`}>
                                          {statusLabels[order.status] || 'Pendiente'}
                                        </span>
                                      </div>
                                      <p className="text-xs text-primary-foreground/60 mt-1 line-clamp-2">{itemsDescription}</p>
                                      <p className="text-sm font-bold text-terracotta mt-2">${order.total.toFixed(2)}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                              <div className="w-16 h-16 bg-primary-foreground/10 rounded-full flex items-center justify-center mb-4">
                                <ClipboardList className="w-8 h-8 text-primary-foreground/40" />
                              </div>
                              <p className="text-primary-foreground/60 font-medium">No tienes pedidos</p>
                              <p className="text-primary-foreground/40 text-sm mt-1">¡Haz tu primer pedido!</p>
                            </div>
                          )}
                        </div>
                      </>
                    ) : isEditingProfile ? (
                      <>
                        {/* Edit Header */}
                        <div className="p-4 border-b border-primary-foreground/10 flex items-center gap-3">
                          <button onClick={() => setIsEditingProfile(false)} className="text-primary-foreground">
                            <ArrowLeft className="w-5 h-5" />
                          </button>
                          <h2 className="text-lg font-bold text-primary-foreground">Editar Perfil</h2>
                        </div>
                        
                        {/* Avatar Upload */}
                        <div className="p-4 flex flex-col items-center">
                          <label className="relative cursor-pointer group">
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleAvatarUpload}
                              className="hidden"
                            />
                            {profileData?.avatar_url ? (
                              <img 
                                src={profileData.avatar_url} 
                                alt="Avatar" 
                                className="w-20 h-20 rounded-full object-cover border-2 border-primary-foreground/20"
                              />
                            ) : (
                              <div className="w-20 h-20 rounded-full bg-terracotta flex items-center justify-center text-white font-bold text-xl">
                                {getInitials(profileData?.nombre || null, profileData?.email || user.email || "")}
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              {uploadingAvatar ? (
                                <Loader2 className="w-6 h-6 text-white animate-spin" />
                              ) : (
                                <Camera className="w-6 h-6 text-white" />
                              )}
                            </div>
                          </label>
                          <p className="text-primary-foreground/60 text-xs mt-2">Toca para cambiar foto</p>
                        </div>

                        {/* Edit Form */}
                        <div className="p-4 space-y-4">
                          <div className="space-y-1">
                            <Label className="text-primary-foreground text-sm">Nombre</Label>
                            <Input
                              value={editNombre}
                              onChange={(e) => setEditNombre(e.target.value)}
                              placeholder="Tu nombre"
                              className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-primary-foreground text-sm">Teléfono</Label>
                            <Input
                              value={editTelefono}
                              onChange={(e) => setEditTelefono(e.target.value)}
                              placeholder="999 123 4567"
                              className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-primary-foreground text-sm">Email</Label>
                            <Input
                              value={profileData?.email || ""}
                              disabled
                              className="bg-primary-foreground/5 border-primary-foreground/10 text-primary-foreground/50"
                            />
                          </div>
                        </div>

                        {/* Save Button */}
                        <div className="mt-auto p-4">
                          <Button
                            onClick={handleSaveProfile}
                            disabled={savingProfile}
                            className="w-full bg-terracotta hover:bg-terracotta/90 text-white"
                          >
                            {savingProfile ? (
                              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
                            ) : (
                              <><Save className="w-4 h-4 mr-2" /> Guardar</>
                            )}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Header */}
                        <div className="p-4 border-b border-primary-foreground/10">
                          <h2 className="text-xl font-bold text-primary-foreground">Cuenta</h2>
                        </div>
                        
                        {/* Profile Card */}
                        <div className="p-4">
                          <button 
                            onClick={() => setIsEditingProfile(true)}
                            className="w-full flex items-center gap-3 bg-primary-foreground/10 rounded-xl p-3 text-left"
                          >
                            {profileData?.avatar_url ? (
                              <img 
                                src={profileData.avatar_url} 
                                alt="Avatar" 
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-terracotta flex items-center justify-center text-white font-bold">
                                {getInitials(profileData?.nombre || null, profileData?.email || user.email || "")}
                              </div>
                            )}
                            <div className="flex-1">
                              <p className="text-primary-foreground font-semibold">
                                {profileData?.nombre || user.email?.split('@')[0]}
                              </p>
                              <p className="text-primary-foreground/60 text-sm flex items-center gap-1">
                                Editar perfil <ChevronRight className="w-3 h-3" />
                              </p>
                            </div>
                          </button>
                        </div>

                        {/* Quick Access Cards */}
                        <div className="px-4 py-3">
                          <div className="grid grid-cols-3 gap-2">
                            <button 
                              onClick={handleShowAllOrders}
                              className="flex flex-col items-center justify-center bg-primary-foreground/10 rounded-xl p-3 hover:bg-primary-foreground/20 transition-colors"
                            >
                              <ClipboardList className="w-6 h-6 text-primary-foreground mb-1" />
                              <span className="text-xs text-primary-foreground font-medium">Pedidos</span>
                            </button>
                            <a 
                              href="https://wa.me/5219995182857"
                              className="flex flex-col items-center justify-center bg-primary-foreground/10 rounded-xl p-3 hover:bg-primary-foreground/20 transition-colors"
                            >
                              <Headphones className="w-6 h-6 text-primary-foreground mb-1" />
                              <span className="text-xs text-primary-foreground font-medium">Ayuda</span>
                            </a>
                            <PaymentMethodsSheet 
                              user={user}
                              trigger={
                                <button 
                                  className="flex flex-col items-center justify-center bg-primary-foreground/10 rounded-xl p-3 hover:bg-primary-foreground/20 transition-colors"
                                >
                                  <CreditCard className="w-6 h-6 text-primary-foreground mb-1" />
                                  <span className="text-xs text-primary-foreground font-medium text-center leading-tight">Métodos de pago</span>
                                </button>
                              }
                            />
                          </div>
                        </div>

                        {/* Últimos Pedidos */}
                        <div className="px-4 py-3">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-primary-foreground">Últimos pedidos</h3>
                            <button 
                              onClick={handleShowAllOrders}
                              className="text-xs bg-primary-foreground/20 text-primary-foreground px-3 py-1 rounded-full hover:bg-primary-foreground/30 transition-colors"
                            >
                              Ver todos
                            </button>
                          </div>
                          <div className="space-y-2">
                            {recentOrders.length > 0 ? (
                              recentOrders.map((order) => {
                                const firstItem = order.items[0];
                                const itemsDescription = order.items.map(i => `${i.quantity}x ${i.name}`).join(', ');
                                const orderDate = new Date(order.created_at).toLocaleDateString('es-MX', { 
                                  day: '2-digit', 
                                  month: 'short' 
                                });
                                return (
                                  <div key={order.id} className="flex items-center gap-3 bg-primary-foreground/5 rounded-lg p-2 hover:bg-primary-foreground/10 transition-colors cursor-pointer">
                                    {firstItem?.image ? (
                                      <img 
                                        src={firstItem.image} 
                                        alt={firstItem.name}
                                        className="w-10 h-10 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-10 h-10 bg-terracotta rounded-full flex items-center justify-center">
                                        <span className="text-white text-lg">🌮</span>
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-primary-foreground">{orderDate}</p>
                                      <p className="text-xs text-primary-foreground/60 truncate">{itemsDescription}</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-primary-foreground/40 flex-shrink-0" />
                                  </div>
                                );
                              })
                            ) : (
                              <div className="flex items-center gap-3 bg-primary-foreground/5 rounded-lg p-2">
                                <div className="w-10 h-10 bg-terracotta/50 rounded-full flex items-center justify-center">
                                  <span className="text-white text-lg">🌮</span>
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-primary-foreground/60">Sin pedidos</p>
                                  <p className="text-xs text-primary-foreground/40">¡Haz tu primer pedido!</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Beneficios Section */}
                        <div className="px-4 py-3 border-t border-primary-foreground/10">
                          <h3 className="text-sm font-bold text-primary-foreground mb-2">Beneficios</h3>
                          <div className="divide-y divide-primary-foreground/10">
                            <button className="w-full flex items-center justify-between py-3 text-primary-foreground hover:bg-primary-foreground/5 transition-colors -mx-1 px-1 rounded">
                              <div className="flex items-center gap-3">
                                <Star className="w-5 h-5" />
                                <span className="text-sm">Puntos Taquitos</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gold">0 pts</span>
                              </div>
                            </button>
                            <button className="w-full flex items-center justify-between py-3 text-primary-foreground hover:bg-primary-foreground/5 transition-colors -mx-1 px-1 rounded">
                              <div className="flex items-center gap-3">
                                <Ticket className="w-5 h-5" />
                                <span className="text-sm">Cupones</span>
                              </div>
                              <ChevronRight className="w-4 h-4 text-primary-foreground/40" />
                            </button>
                          </div>
                        </div>

                        {/* Mi cuenta Section */}
                        <div className="px-4 py-3 border-t border-primary-foreground/10 flex-1 overflow-y-auto">
                          <h3 className="text-sm font-bold text-primary-foreground mb-2">Mi cuenta</h3>
                          <div className="divide-y divide-primary-foreground/10">
                            {isRepartidor && (
                              <Link 
                                to="/repartidor" 
                                onClick={() => setProfileSheetOpen(false)} 
                                className="w-full flex items-center justify-between py-3 text-green-400 hover:bg-primary-foreground/5 transition-colors -mx-1 px-1 rounded"
                              >
                                <div className="flex items-center gap-3">
                                  <Truck className="w-5 h-5" />
                                  <span className="text-sm font-medium">Panel Repartidor</span>
                                </div>
                                <ChevronRight className="w-4 h-4" />
                              </Link>
                            )}
                            {isAdmin && (
                              <Link 
                                to="/admin" 
                                onClick={() => setProfileSheetOpen(false)} 
                                className="w-full flex items-center justify-between py-3 text-gold hover:bg-primary-foreground/5 transition-colors -mx-1 px-1 rounded"
                              >
                                <div className="flex items-center gap-3">
                                  <Shield className="w-5 h-5" />
                                  <span className="text-sm font-medium">Panel Admin</span>
                                </div>
                                <ChevronRight className="w-4 h-4" />
                              </Link>
                            )}
                            <button className="w-full flex items-center justify-between py-3 text-primary-foreground hover:bg-primary-foreground/5 transition-colors -mx-1 px-1 rounded">
                              <div className="flex items-center gap-3">
                                <MapPinned className="w-5 h-5" />
                                <span className="text-sm">Mis direcciones</span>
                              </div>
                              <ChevronRight className="w-4 h-4 text-primary-foreground/40" />
                            </button>
                            <PaymentMethodsSheet 
                              user={user}
                              trigger={
                                <button 
                                  className="w-full flex items-center justify-between py-3 text-primary-foreground hover:bg-primary-foreground/5 transition-colors -mx-1 px-1 rounded"
                                >
                                  <div className="flex items-center gap-3">
                                    <CreditCard className="w-5 h-5" />
                                    <span className="text-sm">Métodos de pago</span>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-primary-foreground/40" />
                                </button>
                              }
                            />
                          </div>
                        </div>

                        {/* Logout */}
                        <div className="mt-auto p-3 border-t border-primary-foreground/10">
                          <button 
                            onClick={handleLogout}
                            className="w-full text-sm font-medium text-primary-foreground/70 py-2 px-3 rounded-lg hover:bg-primary-foreground/10 transition-colors flex items-center gap-2"
                          >
                            <LogOut className="w-4 h-4" />
                            Cerrar sesión
                          </button>
                          <p className="text-center text-primary-foreground/40 text-[10px] mt-2">
                            Hecho con 🧡 en Mérida
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </>
            )
          ) : (
            <Link to="/auth">
              <Button variant="ghost" size="default" className="text-primary-foreground hover:bg-primary-foreground/10 hover:-translate-y-1 transition-all">
                <User className="w-5 h-5" />
                <span>Cuenta</span>
              </Button>
            </Link>
          )}
          <Button variant="terracotta" size="default" onClick={onCartClick} className="relative">
            <ShoppingBag className="w-5 h-5" />
            <span>Carrito</span>
            {itemCount > 0 && <span className="absolute -top-2 -right-2 bg-gold text-gold-foreground text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {itemCount}
              </span>}
          </Button>
        </div>
      </div>
    </header>;
};
export default Header;