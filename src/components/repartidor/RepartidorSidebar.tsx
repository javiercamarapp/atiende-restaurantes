import { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  Clock,
  MapPin,
  History,
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Truck,
  UserCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AtiendeMark, AtiendeWordmark } from '@/components/AtiendeLogo';

interface RepartidorSidebarProps {
  user: { email: string } | null;
  activeSection: string;
  onSectionChange: (section: string) => void;
  onLogout: () => void;
  pendingCount?: number;
  activeCount?: number;
}

const menuSections = [
  {
    title: 'RESUMEN',
    items: [
      { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
    ]
  },
  {
    title: 'ENTREGAS',
    items: [
      { id: 'pending', label: 'Pendientes', icon: Clock, badge: true },
      { id: 'active', label: 'En Camino', icon: Truck, badge: true },
      { id: 'history', label: 'Historial', icon: History },
    ]
  },
  {
    title: 'CUENTA',
    items: [
      { id: 'profile', label: 'Perfil', icon: UserCircle },
    ]
  },
];

const RepartidorSidebar = ({ 
  user, 
  activeSection, 
  onSectionChange, 
  onLogout,
  pendingCount = 0,
  activeCount = 0
}: RepartidorSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);

  const getBadgeCount = (itemId: string) => {
    if (itemId === 'pending') return pendingCount;
    if (itemId === 'active') return activeCount;
    return 0;
  };

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
                {section.items.map((item) => {
                  const badgeCount = 'badge' in item && item.badge ? getBadgeCount(item.id) : 0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSectionChange(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors relative",
                        activeSection === item.id
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                      {badgeCount > 0 && (
                        <span className={cn(
                          "absolute right-2 min-w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold",
                          activeSection === item.id
                            ? "bg-primary-foreground text-primary"
                            : "bg-destructive text-destructive-foreground"
                        )}>
                          {badgeCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Bloque de cuenta — mismo patrón que AdminSidebar.tsx: recuadro gris
          aparte con Ayuda (se movió aquí desde ENTREGAS, ver menuSections
          arriba) y un recuadro blanco separado con el chip de usuario. */}
      <div className="p-3 space-y-2 shrink-0">
        {!collapsed && (
          <div className="rounded-xl bg-muted/60 border border-border p-2 space-y-0.5">
            <button
              onClick={() => onSectionChange('help')}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-full text-[12.5px] font-medium border border-border bg-background hover:bg-muted transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
              <span className="truncate">Centro de ayuda</span>
            </button>
          </div>
        )}

        {/* Usuario — recuadro aparte, blanco */}
        <div className={cn("rounded-xl border border-border bg-card", collapsed ? "p-2" : "p-2.5")}>
          {!collapsed ? (
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => onSectionChange('profile')}
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium shrink-0"
              >
                {user?.email?.charAt(0).toUpperCase() || 'R'}
              </button>
              <button onClick={() => onSectionChange('profile')} className="flex-1 min-w-0 text-left">
                <p className="text-sm text-foreground truncate">{user?.email}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Repartidor</p>
              </button>
              <button onClick={onLogout} className="text-destructive hover:opacity-70 shrink-0">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Button onClick={onLogout} variant="ghost" size="icon" className="w-full text-destructive hover:bg-destructive hover:text-destructive-foreground">
              <LogOut className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default RepartidorSidebar;
