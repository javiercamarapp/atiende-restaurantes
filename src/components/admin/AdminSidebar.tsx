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
  Truck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import logoFull from '@/assets/logo-admin.avif';

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
  {
    title: 'SOPORTE',
    items: [
      { id: 'help', label: 'Centro de Ayuda', icon: HelpCircle },
    ]
  }
];

const AdminSidebar = ({ user, activeSection, onSectionChange, onLogout }: AdminSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside 
      className={cn(
        "hidden md:flex flex-col bg-white border-r border-border h-screen sticky top-0 transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="p-4 flex items-center justify-between">
        {!collapsed && (
          <img src={logoFull} alt="Los Taquitos de PM" className="h-10 w-auto" />
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-black hover:bg-primary hover:text-white"
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
                <p className="px-3 mb-2 text-xs font-semibold text-black/50 tracking-wider">
                  {section.title}
                </p>
              )}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSectionChange(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      activeSection === item.id
                        ? "bg-primary text-white"
                        : "text-black hover:bg-primary hover:text-white"
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

      {/* User section at bottom */}
      <div className="border-t border-border p-4">
        {!collapsed ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                {user?.email?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-black truncate">{user?.email}</p>
                <p className="text-xs text-black/50">Administrador</p>
              </div>
            </div>
            <Button
              onClick={onLogout}
              variant="outline"
              className="w-full justify-start text-terracotta border-terracotta hover:bg-terracotta hover:text-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        ) : (
          <Button
            onClick={onLogout}
            variant="ghost"
            size="icon"
            className="w-full text-terracotta hover:bg-terracotta hover:text-white"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        )}
      </div>
    </aside>
  );
};

export default AdminSidebar;
