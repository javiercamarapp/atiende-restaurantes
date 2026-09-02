import { Check, ChefHat, Bike, Home, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOrder, OrderStatus } from '@/context/OrderContext';

interface OrderTrackerProps {
  isOpen: boolean;
  onClose: () => void;
}

const steps: { status: OrderStatus; label: string; icon: React.ReactNode }[] = [
  { status: 'pending', label: 'Pedido Confirmado', icon: <Check className="w-5 h-5" /> },
  { status: 'preparando', label: 'Preparando', icon: <ChefHat className="w-5 h-5" /> },
  { status: 'en_camino', label: 'En Camino', icon: <Bike className="w-5 h-5" /> },
  { status: 'entregado', label: 'Entregado', icon: <Home className="w-5 h-5" /> },
];

const getStepIndex = (status: OrderStatus) => {
  return steps.findIndex(s => s.status === status);
};

const OrderTracker = ({ isOpen, onClose }: OrderTrackerProps) => {
  const { currentOrder, clearOrder } = useOrder();

  if (!isOpen || !currentOrder) return null;

  const currentStepIndex = getStepIndex(currentOrder.status);
  const isCancelled = currentOrder.status === 'cancelado';

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-background rounded-2xl shadow-elevated z-50 animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-2xl font-bold">Seguir Pedido</h2>
              <p className="text-sm text-muted-foreground">Orden #{currentOrder.id}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Status banner */}
          {isCancelled ? (
            <div className="bg-destructive/10 rounded-xl p-4 mb-6 flex items-center gap-3">
              <X className="w-6 h-6 text-destructive" />
              <p className="font-semibold text-foreground">Este pedido fue cancelado</p>
            </div>
          ) : currentOrder.status !== 'entregado' && (
            <div className="bg-primary/10 rounded-xl p-4 mb-6 flex items-center gap-3">
              <Clock className="w-6 h-6 text-primary" />
              <div>
                <p className="font-semibold text-foreground">Tu pedido está en proceso</p>
                <p className="text-sm text-muted-foreground">Te avisamos aquí en cuanto cambie de estado</p>
              </div>
            </div>
          )}

          {/* Progress Steps */}
          <div className="relative mb-8">
            {steps.map((step, index) => {
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;
              
              return (
                <div key={step.status} className="flex items-start gap-4 mb-6 last:mb-0">
                  {/* Step Icon */}
                  <div className={`
                    relative z-10 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500
                    ${isCompleted 
                      ? 'bg-primary text-primary-foreground shadow-glow' 
                      : 'bg-muted text-muted-foreground'
                    }
                    ${isCurrent ? 'scale-110 animate-pulse' : ''}
                  `}>
                    {step.icon}
                  </div>
                  
                  {/* Connector Line */}
                  {index < steps.length - 1 && (
                    <div className={`
                      absolute left-6 top-12 w-0.5 h-6 -translate-x-1/2 transition-colors duration-500
                      ${index < currentStepIndex ? 'bg-primary' : 'bg-muted'}
                    `} style={{ top: `${index * 80 + 48}px` }} />
                  )}
                  
                  {/* Step Content */}
                  <div className="flex-1 pt-2">
                    <p className={`font-semibold ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {step.label}
                    </p>
                    {isCurrent && (
                      <p className="text-sm text-primary mt-1">En proceso...</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Details */}
          <div className="bg-card rounded-xl p-4 mb-6">
            <h3 className="font-semibold mb-3">Detalles del Pedido</h3>
            <div className="space-y-2 text-sm">
              {currentOrder.items.map(item => (
                <div key={item.id} className="flex justify-between text-muted-foreground">
                  <span>{item.quantity}x {item.name}</span>
                  <span>${item.price * item.quantity}</span>
                </div>
              ))}
              <div className="border-t border-border pt-2 mt-2 flex justify-between font-bold text-foreground">
                <span>Total</span>
                <span className="text-primary">${currentOrder.total}</span>
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="bg-card rounded-xl p-4 mb-6">
            <h3 className="font-semibold mb-2">Entregar en:</h3>
            <p className="text-muted-foreground">{currentOrder.address}</p>
            <p className="text-muted-foreground mt-1">{currentOrder.phone}</p>
          </div>

          {/* Actions */}
          {(currentOrder.status === 'entregado' || isCancelled) && (
            <Button 
              variant="hero" 
              size="lg" 
              className="w-full"
              onClick={() => {
                clearOrder();
                onClose();
              }}
            >
              ¡Gracias! Ordenar de Nuevo
            </Button>
          )}
        </div>
      </div>
    </>
  );
};

export default OrderTracker;
