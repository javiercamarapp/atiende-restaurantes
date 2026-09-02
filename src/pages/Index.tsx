import { useState } from 'react';
import { CartProvider } from '@/context/CartContext';
import { OrderProvider, useOrder } from '@/context/OrderContext';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import MenuSection from '@/components/MenuSection';
import PromotionsSection from '@/components/PromotionsSection';
import MerchSection from '@/components/MerchSection';
import BranchesSection from '@/components/BranchesSection';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/CartDrawer';
import CheckoutModal from '@/components/CheckoutModal';
import OrderTracker from '@/components/OrderTracker';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';

const IndexContent = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);
  const { currentOrder } = useOrder();

  const handleCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const handleOrderSuccess = () => {
    setIsCheckoutOpen(false);
    setIsTrackerOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onCartClick={() => setIsCartOpen(true)} />
      
      <main>
        <Hero />
        <MenuSection />
        <PromotionsSection />
        <MerchSection />
        <BranchesSection />
      </main>
      
      <Footer />

      {/* Floating WhatsApp Button */}
      <FloatingWhatsApp />

      {/* Floating Track Order Button */}
      {currentOrder && !isTrackerOpen && (
        <button
          onClick={() => setIsTrackerOpen(true)}
          className="fixed bottom-24 right-6 bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-elevated hover:shadow-glow transition-all duration-300 flex items-center gap-2 font-semibold animate-bounce z-40"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-gold"></span>
          </span>
          Seguir Pedido
        </button>
      )}

      <CartDrawer 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)}
        onCheckout={handleCheckout}
      />
      
      <CheckoutModal 
        isOpen={isCheckoutOpen} 
        onClose={() => setIsCheckoutOpen(false)}
        onSuccess={handleOrderSuccess}
      />
      
      <OrderTracker 
        isOpen={isTrackerOpen} 
        onClose={() => setIsTrackerOpen(false)}
      />
    </div>
  );
};

const Index = () => {
  return (
    <CartProvider>
      <OrderProvider>
        <IndexContent />
      </OrderProvider>
    </CartProvider>
  );
};

export default Index;
