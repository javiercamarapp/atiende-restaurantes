import { useState } from 'react';
import { X, MapPin, Phone, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCart } from '@/context/CartContext';
import { useOrder } from '@/context/OrderContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CheckoutModal = ({ isOpen, onClose, onSuccess }: CheckoutModalProps) => {
  const { items, total, clearCart } = useCart();
  const { createOrder } = useOrder();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.phone || !formData.address) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setIsLoading(true);

    const branchName = localStorage.getItem('selectedBranch') ?? undefined;

    const { data, error } = await supabase.functions.invoke('create-order', {
      body: {
        branch_name: branchName,
        customer_name: formData.name,
        customer_phone: formData.phone,
        customer_address: formData.address,
        source: 'web',
        items: items.map(item => ({ product_id: item.id, quantity: item.quantity })),
      },
    });

    setIsLoading(false);

    if (error || data?.error) {
      toast.error(data?.error ?? 'No se pudo crear el pedido. Intenta de nuevo.');
      return;
    }

    createOrder({
      id: data.order.id,
      items,
      total: data.order.total,
      status: data.order.status,
      name: formData.name,
      phone: formData.phone,
      address: formData.address,
    });

    clearCart();
    toast.success('¡Pedido confirmado!');
    onSuccess();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-background rounded-2xl shadow-elevated z-50 animate-scale-in">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl font-bold">Datos de Entrega</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Order Summary */}
          <div className="bg-card rounded-xl p-4 mb-6">
            <h3 className="font-semibold mb-3">Resumen del Pedido</h3>
            <div className="space-y-2 text-sm">
              {items.map(item => (
                <div key={item.id} className="flex justify-between text-muted-foreground">
                  <span>{item.quantity}x {item.name}</span>
                  <span>${item.price * item.quantity}</span>
                </div>
              ))}
              <div className="border-t border-border pt-2 mt-2 flex justify-between font-bold text-foreground">
                <span>Total</span>
                <span className="text-primary">${total}</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4" />
                Nombre
              </Label>
              <Input
                id="name"
                placeholder="Tu nombre completo"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="bg-card"
              />
            </div>

            <div>
              <Label htmlFor="phone" className="flex items-center gap-2 mb-2">
                <Phone className="w-4 h-4" />
                Teléfono
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(222) 123-4567"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="bg-card"
              />
            </div>

            <div>
              <Label htmlFor="address" className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4" />
                Dirección de Entrega
              </Label>
              <Input
                id="address"
                placeholder="Calle, número, colonia, ciudad"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                className="bg-card"
              />
            </div>

            <Button 
              type="submit" 
              variant="hero" 
              size="lg" 
              className="w-full mt-6"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>Confirmar Pedido - ${total}</>
              )}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
};

export default CheckoutModal;
