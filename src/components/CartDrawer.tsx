import { X, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

const CartDrawer = ({ isOpen, onClose, onCheckout }: CartDrawerProps) => {
  const { items, total, updateQuantity, removeItem, clearCart } = useCart();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-72 bg-primary border-l border-primary-foreground/10 shadow-elevated z-50 animate-slide-in-right rounded-l-3xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-primary-foreground/10">
            <div className="flex items-center gap-2">
              <span className="text-xl">🛒</span>
              <h2 className="font-display text-xl font-bold text-primary-foreground tracking-wide uppercase">Tu Carrito</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-primary-foreground hover:bg-terracotta hover:text-white active:bg-terracotta h-8 w-8 transition-colors">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto p-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <span className="text-5xl mb-3">🌮</span>
                <p className="text-primary-foreground/80 text-sm">Tu carrito está vacío</p>
                <p className="text-xs text-primary-foreground/60 mt-1">¡Agrega algunos tacos deliciosos!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div 
                    key={item.id}
                    className="flex gap-3 p-3 bg-terracotta rounded-xl"
                  >
                    {/* Item Image Placeholder */}
                    <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
                      {item.category === 'tacos' && '🌮'}
                      {item.category === 'bebidas' && '🥤'}
                      {item.category === 'extras' && '🥑'}
                      {item.category === 'postres' && '🍮'}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white text-sm truncate">{item.name}</h3>
                      <p className="text-gold font-bold text-sm">${item.price}</p>
                      
                      <div className="flex items-center gap-2 mt-1">
                        <Button 
                          variant="secondary" 
                          size="icon" 
                          className="h-6 w-6 bg-white/20 hover:bg-white/30 text-white"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-6 text-center font-semibold text-white text-sm">{item.quantity}</span>
                        <Button 
                          variant="secondary" 
                          size="icon" 
                          className="h-6 w-6 bg-white/20 hover:bg-white/30 text-white"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-white/80 hover:text-white hover:bg-white/20 ml-auto"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="mt-auto border-t border-primary-foreground/10 p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-primary-foreground/80 text-sm">Subtotal:</span>
                <span className="text-xl font-bold text-gold">${total}</span>
              </div>
              
              <Button 
                variant="terracotta" 
                size="default" 
                className="w-full"
                onClick={onCheckout}
              >
                Proceder al Pago
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 text-xs"
                onClick={clearCart}
              >
                Vaciar Carrito
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CartDrawer;
