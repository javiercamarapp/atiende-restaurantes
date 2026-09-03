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
  Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-border shrink-0">
        {!collapsed ? <AtiendeWordmark /> : <AtiendeMark className="h-6 w-auto" />}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-6 px-2">
          {menuSections.map((section) => (
            <div key={section.title}>
              {!collapsed && (
                <p className="px-3 mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSectionChange(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                      activeSection === item.id
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Bloque de cuenta — su propio recuadro gris, separado de la lista de
          navegación de arriba (mismo patrón que el sidebar real de Likida:
          logo arriba suelto, todo lo de cuenta abajo metido en un recuadro
          más gris aparte). */}
      <div className="p-3 space-y-2 shrink-0">
        {!collapsed && (
          <div className="rounded-xl bg-muted/60 border border-border p-2 space-y-0.5">
            <button className="w-full flex items-center gap-2 px-3 py-1.5 mb-1 rounded-full text-[12.5px] font-medium border border-border bg-background hover:bg-muted transition-colors">
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
              <span className="truncate">Centro de ayuda</span>
            </button>
            <button
              onClick={() => onSectionChange('notificaciones')}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] text-muted-foreground hover:bg-background transition-colors"
            >
              <Bell className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              <span className="truncate">Notificaciones</span>
            </button>
            <div className="pt-1 flex justify-center">
              <ThemeSelector />
            </div>
          </div>
        )}

        {/* Usuario — recuadro aparte, blanco */}
        <div className={cn("rounded-xl border border-border bg-card", collapsed ? "p-2" : "p-2.5")}>
          {!collapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium shrink-0">
                {user?.email?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{user?.email}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Administrador</p>
              </div>
              <button onClick={onLogout} className="text-destructive hover:opacity-70 shrink-0">
                <LogOut className="w-4 h-4" />
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
