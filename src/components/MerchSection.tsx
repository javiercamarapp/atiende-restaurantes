import { memo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { WordPullUp } from "@/components/ui/word-pull-up";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { useIsAdmin } from "@/hooks/useIsAdmin";

// Use public paths for lazy loading
const merchBg = "/merch-images/merch-bg.jpg";
const merchImages = [
  "/merch-images/merch-1.jpg",
  "/merch-images/merch-2.jpg",
  "/merch-images/merch-3.jpg",
  "/merch-images/merch-4.jpg",
  "/merch-images/merch-5.jpg",
  "/merch-images/merch-6.jpg"
];
const MerchSection = memo(() => {
  const { addItem } = useCart();
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  
  const handleAddMerch = () => {
    addItem({
      id: "merch-playera",
      name: "Playera Oficial",
      description: "Merch oficial de la comunidad de taquitos de PM",
      price: 700,
      category: "merch",
      image: merchImages[0]
    });
    toast.success("Playera agregada al carrito");
  };
  return <section id="merch" className="relative min-h-[60vh] md:min-h-[70vh] flex items-center justify-center overflow-hidden py-12 pt-20 md:pt-28 pb-28 md:pb-32 scroll-mt-20">
      {/* Background Image */}
      <div className="absolute inset-0 bg-cover bg-center" style={{
      backgroundImage: `url(${merchBg})`
    }} />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Content */}
      <div className="relative z-10 text-center px-4 w-full max-w-4xl mx-auto">
        <div>
          <div className="flex items-center justify-center gap-4">
            <WordPullUp 
              words="Merch oficial PM" 
              className="text-4xl md:text-6xl lg:text-7xl text-white mb-2 drop-shadow-lg"
            />
            {isAdmin && (
              <Button 
                onClick={() => navigate('/admin', { state: { openSection: 'products', openDialog: true } })} 
                variant="terracotta" 
                size="icon"
                className="rounded-full w-10 h-10 shadow-lg"
              >
                <Plus className="w-5 h-5" />
              </Button>
            )}
          </div>
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ delay: 0.5 }}
            className="text-white/90 text-lg md:text-xl mb-6 drop-shadow"
          >
            Merch oficial de la comunidad de taquitos de PM
          </motion.p>
        </div>

        {/* Carousel */}
        <div className="mb-6">
          <Carousel opts={{
          align: "center",
          loop: true
        }} plugins={[Autoplay({
          delay: 3000
        })]} className="w-full">
            <CarouselContent>
              {merchImages.map((img, index) => (
                <CarouselItem key={index} className="basis-full md:basis-1/2 lg:basis-1/3">
                  <motion.div
                    initial={{ opacity: 0, x: 60 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: false, amount: 0.3 }}
                    transition={{
                      duration: 0.8, 
                      delay: index * 0.15,
                      ease: [0.25, 0.1, 0.25, 1]
                    }}
                    className="p-2"
                  >
                    <div className="overflow-hidden rounded-xl shadow-lg">
                      <img src={img} alt={`Merch ${index + 1}`} className="w-full h-64 md:h-80 object-cover" loading="lazy" decoding="async" />
                    </div>
                  </motion.div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>

        {/* Price and Add Button */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="flex items-center justify-center gap-4"
        >
          <span className="text-2xl font-bold text-gold bg-primary px-4 py-1 rounded-md h-9 flex items-center">
            $700
          </span>
          <Button variant="terracotta" size="sm" onClick={handleAddMerch} className="gap-1">
            <Plus className="w-4 h-4" />
            Agregar
          </Button>
        </motion.div>
      </div>
    </section>;
});

MerchSection.displayName = 'MerchSection';

export default MerchSection;