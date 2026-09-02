import { useState, useEffect } from 'react';
import { Minus, Plus, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { MenuItem, categories } from '@/data/menu';
import { useCart } from '@/context/CartContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface MenuItemDialogProps {
  item: MenuItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MenuItemDialog = ({ item, open, onOpenChange }: MenuItemDialogProps) => {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);

  // Reset quantity when dialog opens or item changes
  useEffect(() => {
    if (open) setQuantity(1);
  }, [open, item]);

  if (!item) return null;

  const handleAddItem = () => {
    for (let i = 0; i < quantity; i++) {
      addItem(item);
    }
    toast.success(`${quantity}x ${item.name} agregado al carrito`);
    onOpenChange(false);
  };

  const categoryIcon = categories.find(c => c.id === item.category)?.icon || '🍽️';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-transparent border-0 shadow-none p-0 w-[85vw] max-w-sm overflow-visible">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="bg-card border-2 border-gold shadow-[0_0_30px_hsl(42_85%_55%/0.5)] rounded-2xl overflow-hidden"
            >
              {/* Close button */}
              <button
                onClick={() => onOpenChange(false)}
                className="absolute top-3 right-3 z-10 bg-terracotta hover:bg-terracotta/80 active:bg-terracotta text-white rounded-full p-1.5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Image area */}
              <div className="relative h-48 bg-gradient-to-br from-secondary to-muted overflow-hidden">
                <motion.div 
                  initial={{ scale: 1.1, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.6 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="absolute inset-0 flex items-center justify-center text-7xl"
                >
                  {categoryIcon}
                </motion.div>
                {item.popular && (
                  <div className="absolute top-3 left-3 bg-gold text-gold-foreground text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1 animate-pulse">
                    <Star className="w-3 h-3 fill-current" />
                    Popular
                  </div>
                )}
              </div>

              {/* Content */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="p-5 font-menu"
              >
                <DialogTitle className="text-2xl font-semibold text-white mb-2">
                  {item.name}
                </DialogTitle>
                <p className="text-sm text-white/70 mb-4 leading-relaxed">
                  {item.description}
                </p>
                
                {/* Quantity selector */}
                <div className="flex items-center justify-center gap-4 mb-4">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-white transition-colors"
                    disabled={quantity <= 1}
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <span className="text-2xl font-bold text-white w-8 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-white transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-bold text-gold">
                    ${item.price * quantity}
                  </span>
                  <Button 
                    variant="terracotta" 
                    onClick={handleAddItem} 
                    className="gap-2 px-6"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default MenuItemDialog;
