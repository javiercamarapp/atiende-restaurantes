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
  ChevronLeft,
  ChevronRight,
  Percent,
  Truck,
  Bell,
  MessageCircle,
  UserRound,
  CreditCard,
  Settings,
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

const menuSections = [
  {
    title: 'ANÁLISIS',
    items: [
      { id: 'dashboard', label: 'Estadísticas', icon: BarChart3 },
      { id: 'pregunta', label: 'Pregunta a tus datos', icon: MessageCircle },
    ]
  },
  {
    title: 'ADMINISTRAR',
    items: [
      { id: 'products', label: 'Productos', icon: Package },
      { id: 'categories', label: 'Categorías', icon: Tag },
      { id: 'promos', label: 'Promociones', icon: Percent },
      { id: 'orders', label: 'Pedidos', icon: ShoppingCart },
      { id: 'users', label: 'Usuarios', icon: Users },
      { id: 'repartidores', label: 'Repartidores', icon: Truck },
    ]
  },
];

const AdminSidebar = ({ user, activeSection, onSectionChange, onLogout }: AdminSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);

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
          className="w-6 h-6 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Navigation — misma densidad que el sidebar de superadmin */}
      <nav className="flex-1 px-3 py-2 space-y-3 overflow-y-auto">
        {menuSections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="px-2.5 mb-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors",
                    activeSection === item.id
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
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
            <button
              onClick={() => onSectionChange('notificaciones')}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-full text-[13px] text-muted-foreground hover:bg-background transition-colors"
            >
              <Bell className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              <span className="truncate">Notificaciones</span>
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
