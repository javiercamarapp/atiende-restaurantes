import { memo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CardsParallax, type iCardItem } from "@/components/ui/scroll-cards";
import { WordPullUp } from "@/components/ui/word-pull-up";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import OptimizedImage from "@/components/OptimizedImage";

// Use public paths for lazy loading
const promoLunes = "/promo-images/promo-lunes.avif";
const promoMartes = "/promo-images/promo-martes.avif";
const promoBoxes = "/promo-images/promo-boxes.png";
const cardItems: iCardItem[] = [{
  title: "Lunes de Promoción",
  description: "¡Aprovecha nuestras ofertas especiales cada lunes!",
  tag: "promocion",
  src: promoLunes,
  link: "#",
  color: "transparent",
  textColor: "white"
}, {
  title: "Martes de Tacos",
  description: "Los mejores tacos con descuentos increíbles",
  tag: "promocion",
  src: promoMartes,
  link: "#",
  color: "transparent",
  textColor: "white"
}];
const PromotionsSection = memo(() => {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  
  return <section id="promociones" className="relative bg-terracotta scroll-mt-20">
      {/* Animated Wave shape at top */}
      <div className="absolute top-0 left-0 right-0 overflow-hidden leading-none transform -translate-y-[99%] z-10">
        <svg 
          className="relative block w-[200%] h-16 md:h-24 rotate-180" 
          viewBox="0 0 2880 100" 
          preserveAspectRatio="none"
          style={{ animation: 'waveSlide 12s linear infinite' }}
        >
          <path 
            d="M0,50 C360,100 720,0 1080,50 C1440,100 1800,0 2160,50 C2520,100 2880,0 2880,50 L2880,100 L0,100 Z" 
            className="fill-terracotta" 
            style={{ opacity: 0.4 }}
          />
          <path 
            d="M0,60 C360,20 720,80 1080,40 C1440,0 1800,60 2160,20 C2520,80 2880,40 2880,60 L2880,100 L0,100 Z" 
            className="fill-terracotta" 
            style={{ opacity: 0.6 }}
          />
          <path 
            d="M0,70 C360,40 720,90 1080,60 C1440,30 1800,80 2160,50 C2520,90 2880,60 2880,70 L2880,100 L0,100 Z" 
            className="fill-terracotta"
          />
        </svg>
      </div>
      
      <div className="container pt-2 pb-0">
        <div className="text-center mb-0 py-4 -mx-4 px-4">
          <div className="flex items-center justify-center gap-4">
            <WordPullUp 
              words="Promociones PM" 
              className="text-4xl md:text-5xl text-white mb-0"
            />
            {isAdmin && (
              <Button 
                onClick={() => navigate('/admin', { state: { openSection: 'promos', openDialog: true } })} 
                variant="terracotta" 
                size="icon"
                className="rounded-full w-10 h-10 shadow-lg bg-white text-terracotta hover:bg-white/90"
              >
                <Plus className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.3 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <CardsParallax items={cardItems} />
      </motion.div>
      
      <div className="container pb-8 px-4">
        <p className="text-white/80 text-xs md:text-sm text-center leading-relaxed">
          *APLICAN RESTRICCIONES: PROMOCIONES VÁLIDAS ÚNICAMENTE EN SUCURSALES FRANCISCO DE MONTEJO, PENSIONES, Y PLAZA GALERÍAS A PARTIR DEL HORARIO DE APERTURA AL CIERRE. *NO VÁLIDO EN SERVICIO A DOMICILIO.
        </p>
        
        {/* Transition image with floating animation */}
        <div className="mt-8 flex justify-center">
          <OptimizedImage 
            src={promoBoxes} 
            alt="Los Taquitos de PM - Cajas de tacos" 
            className="w-full max-w-md md:max-w-lg object-contain drop-shadow-2xl"
            style={{ animation: 'wiggleFloat 2s ease-in-out infinite' }}
          />
        </div>
      </div>
      
      {/* Animated Wave shape at bottom */}
      <div className="absolute bottom-0 left-0 right-0 overflow-hidden leading-none transform translate-y-[99%] z-10">
        <svg 
          className="relative block w-[200%] h-16 md:h-24" 
          viewBox="0 0 2880 100" 
          preserveAspectRatio="none"
          style={{ animation: 'waveSlide 10s linear infinite' }}
        >
          <path 
            d="M0,0 L0,50 C360,0 720,100 1080,50 C1440,0 1800,100 2160,50 C2520,0 2880,100 2880,50 L2880,0 Z" 
            className="fill-terracotta" 
            style={{ opacity: 0.4 }}
          />
          <path 
            d="M0,0 L0,40 C360,80 720,20 1080,60 C1440,100 1800,40 2160,80 C2520,20 2880,60 2880,40 L2880,0 Z" 
            className="fill-terracotta" 
            style={{ opacity: 0.6 }}
          />
          <path 
            d="M0,0 L0,30 C360,60 720,10 1080,40 C1440,70 1800,20 2160,50 C2520,10 2880,40 2880,30 L2880,0 Z" 
            className="fill-terracotta"
          />
        </svg>
      </div>
    </section>;
});

PromotionsSection.displayName = 'PromotionsSection';

export default PromotionsSection;