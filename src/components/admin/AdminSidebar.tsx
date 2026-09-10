import { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  Tag,
  Contact,
  ShoppingCart,
  BarChart3,
  HelpCircle,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Percent,
  Bike,
  Bell,
  MessageCircle,
  UserRound,
  CreditCard,
  Settings,
  History,
  Store,
  Lock,
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
      { id: 'historial-ordenes', label: 'Historial de Órdenes', icon: History },
      { id: 'pagos', label: 'Pagos', icon: CreditCard, disabled: true },
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
    ],
  },
  {
    title: 'ADMINISTRAR',
    items: [
      { id: 'products', label: 'Productos', icon: Package },
      { id: 'categories', label: 'Categorías', icon: Tag },
      { id: 'users', label: 'Clientes', icon: Contact },
      { id: 'repartidores', label: 'Repartidores', icon: Bike },
      { id: 'sucursales', label: 'Sucursales', icon: Store },
      { id: 'cuentas-accesos', label: 'Cuentas & Accesos', icon: Lock },
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

      {/* Bloque de cuenta — mismo patrón de dos capas que dashboard/chrome.tsx
          de Likida: la zona de ayuda/accesos/tema vive en un tono hundido
          (bg-muted, a todo lo ancho, con sombra interior) y la tarjeta de
          usuario queda SOBREPUESTA encima (bg-card + sombra + margen
          negativo que la monta sobre el gris) en vez de solo separada por
          un borde. */}
      <div className="shrink-0 border-t border-border">
        {!collapsed && (
          <div className="bg-muted px-2 pt-2 pb-5 space-y-0.5 shadow-[inset_0_2px_5px_-2px_rgba(0,0,0,0.08)]">
            <button className="w-full flex items-center gap-2 px-3 py-1.5 mb-1 rounded-full text-[13px] border border-border bg-card hover:bg-background transition-colors">
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
              <span className="truncate">Centro de ayuda</span>
            </button>
            {/* Mismos 5 ítems y mismo orden que el bloque ABAJO real de
                Likida (Notificaciones/Mi perfil/Centro de ayuda arriba/Plan y
                facturación/Configuración), con la MISMA anatomía de píldora
                que el nav principal: activo = relleno sólido bg-primary
                (azul de atiende, nunca el negro/naranja de Likida). Solo
                "Notificaciones" tiene página real hoy en este repo — el
                resto sigue "Pronto" (esqueleto honesto, no se finge que
                llevan a algo que no existe todavía). */}
            {[
              { id: 'notificaciones', label: 'Notificaciones', icon: Bell },
              { id: 'mi-perfil', label: 'Mi perfil', icon: UserRound, disabled: true },
              { id: 'plan-facturacion', label: 'Plan y facturación', icon: CreditCard, disabled: true },
              { id: 'configuracion', label: 'Configuración', icon: Settings, disabled: true },
            ].map((it) => (
              <button
                key={it.id}
                onClick={() => !it.disabled && onSectionChange(it.id)}
                disabled={it.disabled}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-full text-[13px] transition-colors",
                  it.disabled
                    ? "text-muted-foreground/50 cursor-not-allowed"
                    : activeSection === it.id
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:bg-background"
                )}
              >
                <it.icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span className="flex-1 flex items-center justify-between min-w-0 gap-2">
                  <span className="truncate">{it.label}</span>
                  {it.disabled && (
                    <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-muted-foreground/60 shrink-0">
                      Pronto
                    </span>
                  )}
                </span>
              </button>
            ))}
            <div className="pt-1.5 pb-0.5 flex justify-center">
              <ThemeSelector />
            </div>
          </div>
        )}

        {/* Tarjeta de usuario — montada con margen negativo sobre la zona
            gris de arriba, con su propio fondo/borde/sombra para que se
            note que está encima, no solo debajo. */}
        <div className={cn("relative px-2 pb-2", collapsed ? "-mt-1" : "-mt-3.5")}>
          {!collapsed ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm">
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
            <Button onClick={onLogout} variant="ghost" size="icon" className="w-full rounded-xl border border-border bg-card shadow-sm">
              <LogOut className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default AdminSidebar;
