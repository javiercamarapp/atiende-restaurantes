import { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  Tag,
  Users,
  ShoppingCart,
  BarChart3,
  HelpCircle,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Percent,
  Truck,
  Bell,
  MessageCircle,
  UserRound,
  CreditCard,
  Settings,
  History,
  Clock,
  LineChart,
  Calendar,
  Megaphone,
  Store,
  Lock,
  IdCard,
  GraduationCap,
  ChevronDown,
  Mic,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeSelector } from '@/components/ThemeSelector';
import { AtiendeMark, AtiendeWordmark } from '@/components/AtiendeLogo';
import { cn } from '@/lib/utils';

interface AdminSidebarProps {
  user: { email: string } | null;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onLogout: () => void;
}

// Estructura calcada de la anatomía real del panel de restaurantes de Rappi
// (INICIO/MARKETING/ADMINISTRAR/SOPORTE) — items sin página real detrás van
// `disabled` con etiqueta "Pronto", no fingen funcionar. "RappiAds" se
// adapta como "Anuncios" (no tiene sentido usar la marca de un competidor
// dentro de nuestro propio producto).
const menuSections = [
  {
    title: 'ANÁLISIS',
    siempreAbierto: true,
    items: [
      { id: 'dashboard', label: 'Estadísticas', icon: BarChart3 },
      { id: 'pregunta', label: 'Pregunta a tus datos', icon: MessageCircle },
    ],
  },
  {
    title: 'INICIO',
    items: [
      { id: 'notificaciones', label: 'Notificaciones', icon: Bell },
      { id: 'orders', label: 'Pedidos', icon: ShoppingCart },
      { id: 'historial-ordenes', label: 'Historial de Órdenes', icon: History, disabled: true },
      { id: 'pagos', label: 'Pagos', icon: CreditCard, disabled: true },
      { id: 'estados-solicitudes', label: 'Estados de solicitudes', icon: Clock, disabled: true },
    ],
  },
  {
    title: 'AGENTES',
    items: [
      { id: 'agente-voz', label: 'Agente de voz', icon: Mic },
      { id: 'agente-whatsapp', label: 'Agente de WhatsApp', icon: MessageCircle },
    ],
  },
  {
    title: 'MARKETING',
    items: [
      { id: 'promos', label: 'Promociones', icon: Percent },
      { id: 'campanas', label: 'Campañas', icon: LineChart, disabled: true },
      { id: 'eventos', label: 'Eventos', icon: Calendar, disabled: true },
      { id: 'anuncios', label: 'Anuncios', icon: Megaphone, disabled: true },
    ],
  },
  {
    title: 'ADMINISTRAR',
    items: [
      {
        id: 'products', label: 'Productos', icon: Package,
        children: ['Catálogo de marca', 'Inventario por tienda'],
      },
      { id: 'categories', label: 'Categorías', icon: Tag },
      { id: 'users', label: 'Usuarios', icon: Users },
      { id: 'repartidores', label: 'Repartidores', icon: Truck },
      { id: 'puntos-venta', label: 'Puntos de venta', icon: Store, disabled: true },
      { id: 'cuentas-accesos', label: 'Cuentas & Accesos', icon: Lock, disabled: true },
      { id: 'info-cuenta', label: 'Información de cuenta', icon: IdCard, disabled: true },
    ],
  },
  {
    title: 'SOPORTE',
    items: [
      { id: 'capacitacion', label: 'Capacitación', icon: GraduationCap, disabled: true },
    ],
  },
];

const CLAVE_GRUPO_ABIERTO = 'atiende-sidebar-grupo-abierto';

const grupoDeSeccion = (seccion: string) =>
  menuSections.find((s) => s.items.some((it) => it.id === seccion))?.title ?? null;

const AdminSidebar = ({ user, activeSection, onSectionChange, onLogout }: AdminSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  // Acordeón: solo un grupo (aparte de ANÁLISIS, que siempre está abierto y
  // no participa) puede estar abierto a la vez. Se recuerda entre sesiones;
  // por default abre INICIO (o el grupo de la sección activa, si es otro).
  const [grupoAbierto, setGrupoAbierto] = useState<string | null>(() => {
    const guardado = typeof window !== 'undefined' ? localStorage.getItem(CLAVE_GRUPO_ABIERTO) : null;
    if (guardado) return guardado;
    const grupoActivo = grupoDeSeccion(activeSection);
    return grupoActivo && grupoActivo !== 'ANÁLISIS' ? grupoActivo : 'INICIO';
  });

  const alternarGrupo = (titulo: string) => {
    setGrupoAbierto((actual) => {
      const nuevo = actual === titulo ? null : titulo;
      localStorage.setItem(CLAVE_GRUPO_ABIERTO, nuevo ?? '');
      return nuevo;
    });
  };

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col bg-card border border-border rounded-2xl sticky top-3 h-[calc(100vh-1.5rem)] overflow-hidden transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo — sin línea divisoria, igual que Likida */}
      <div className="h-14 px-3.5 flex items-center justify-between shrink-0">
        {!collapsed ? <AtiendeWordmark className="scale-90 origin-left" /> : <AtiendeMark className="h-6 w-auto" />}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="w-6 h-6 rounded-md border border-border/60 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
        >
          {collapsed ? <PanelLeftOpen className="w-3.5 h-3.5" strokeWidth={1.75} /> : <PanelLeftClose className="w-3.5 h-3.5" strokeWidth={1.75} />}
        </button>
      </div>

      {/* Navigation — misma densidad que el sidebar de superadmin. Acordeón:
          ANÁLISIS siempre visible arriba, las demás categorías se abren de
          una a la vez (con flecha), y se recuerda cuál quedó abierta. */}
      <nav className="flex-1 px-3 py-2 space-y-3 overflow-y-auto">
        {menuSections.map((section) => {
          const abierta = section.siempreAbierto || grupoAbierto === section.title;
          return (
          <div key={section.title}>
            {!collapsed && (
              section.siempreAbierto ? (
                <p className="px-2.5 mb-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  {section.title}
                </p>
              ) : (
                <button
                  onClick={() => alternarGrupo(section.title)}
                  className="w-full flex items-center justify-between px-2.5 mb-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {section.title}
                  <ChevronDown className={cn("w-3 h-3 transition-transform", abierta && "rotate-180")} />
                </button>
              )
            )}
            {(abierta || collapsed) && (
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <div key={item.id}>
                  <button
                    onClick={() => !item.disabled && onSectionChange(item.id)}
                    disabled={item.disabled}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors",
                      item.disabled
                        ? "text-muted-foreground/50 cursor-not-allowed"
                        : activeSection === item.id
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <item.icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                    {!collapsed && (
                      <span className="flex-1 flex items-center justify-between min-w-0 gap-2">
                        <span className="truncate">{item.label}</span>
                        {item.disabled && (
                          <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground/60 shrink-0">
                            Pronto
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                  {!collapsed && 'children' in item && item.children && (
                    <div className="ml-[1.15rem] pl-3 border-l border-border/60 space-y-0.5 mt-0.5">
                      {item.children.map((hijo) => (
                        <div
                          key={hijo}
                          className="flex items-center justify-between gap-2 px-2 py-1 text-[13px] text-muted-foreground/50 cursor-not-allowed"
                        >
                          <span className="truncate">{hijo}</span>
                          <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground/60 shrink-0">
                            Pronto
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            )}
          </div>
          );
        })}
      </nav>

      {/* Bloque de cuenta — el recuadro gris real de Likida (sobresale del
          blanco del sidebar, sin borde propio, contenido dentro del padding
          para que no se desborde), separado del chip de usuario de abajo. */}
      <div className="p-2 space-y-0.5 shrink-0">
        {!collapsed && (
          <div className="rounded-xl bg-muted/60 p-1.5 space-y-0.5 mb-1.5">
            <button className="w-full flex items-center gap-2 px-3 py-1.5 mb-1 rounded-full text-[13px] border border-border bg-card hover:bg-muted transition-colors">
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
              <span className="truncate">Centro de ayuda</span>
            </button>
            {[
              { label: 'Mi perfil', icon: UserRound },
              { label: 'Plan y facturación', icon: CreditCard },
              { label: 'Configuración', icon: Settings },
            ].map((it) => (
              <button
                key={it.label}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-full text-[13px] text-muted-foreground hover:bg-background transition-colors"
              >
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
        <div className={cn("border-t border-border pt-1.5", collapsed ? "px-0" : "px-1")}>
          {!collapsed ? (
            <div className="flex items-center gap-2 px-2 py-1">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-medium shrink-0">
                {user?.email?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-foreground truncate">{user?.email}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Administrador</p>
              </div>
              <button onClick={onLogout} className="text-destructive hover:opacity-70 shrink-0">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Button onClick={onLogout} variant="ghost" size="icon" className="w-full">
              <LogOut className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default AdminSidebar;
