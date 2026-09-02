import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import MenuItemDialog from '@/components/MenuItemDialog';
import MenuItemImage from '@/components/MenuItemImage';
import { WordPullUp } from '@/components/ui/word-pull-up';
import { Button } from '@/components/ui/button';
import { MenuItem, CategoryId } from '@/data/menu';
import { useProducts } from '@/hooks/useProducts';
import { useCart } from '@/context/CartContext';
import { toast } from 'sonner';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel';
import OptimizedImage from '@/components/OptimizedImage';

// Lazy load decorative images
const pizzaPromo = '/menu-images/pizza-promo.png';
const tacoMascotMenu = '/menu-images/taco-mascot-menu.png';
const tacoRight = '/menu-images/taco-right.png';
const menuSalsa = '/menu-images/menu-salsa.png';
const menuAguaFresca = '/menu-images/menu-agua-fresca.png';

const MenuSection = () => {
  const [activeCategory, setActiveCategory] = useState<string>('tacos');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const { products, categories, loading, refetch } = useProducts();
  
  // Set first category as active when categories load
  useEffect(() => {
    if (categories.length > 0 && !categories.find(c => c.id === activeCategory)) {
      setActiveCategory(categories[0].id);
    }
  }, [categories, activeCategory]);
  
  const scrollCategories = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      const scrollAmount = container.clientWidth * 0.6;
      const newScrollLeft = direction === 'left' 
        ? container.scrollLeft - scrollAmount 
        : container.scrollLeft + scrollAmount;
      
      container.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
    }
  };
  const { addItem } = useCart();
  
  const filteredItems = products.filter(item => item.category === activeCategory);
  
  const handleAddItem = (item: MenuItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    addItem(item);
    toast.success(`${item.name} agregado al carrito`);
  };

  const handleCardClick = (item: MenuItem) => {
    setSelectedItem(item);
    setDialogOpen(true);
  };

  const handleImageUploaded = () => {
    // Refresh products when an image is uploaded
    refetch();
  };
  return <section id="menu" className="relative pt-[1cm] pb-24 bg-[image:var(--gradient-warm)] scroll-mt-20">
      {/* Animated Wave shape at top */}
      <div className="absolute top-0 left-0 right-0 overflow-visible leading-none transform -translate-y-[99%]">
        <svg className="relative block w-[200%] h-16 md:h-24 rotate-180" viewBox="0 0 2880 100" preserveAspectRatio="none" style={{
        animation: 'waveSlide 12s linear infinite'
      }}>
          <path d="M0,50 C360,100 720,0 1080,50 C1440,100 1800,0 2160,50 C2520,100 2880,0 2880,50 L2880,100 L0,100 Z" className="fill-primary" style={{
          opacity: 0.4
        }} />
          <path d="M0,60 C360,20 720,80 1080,40 C1440,0 1800,60 2160,20 C2520,80 2880,40 2880,60 L2880,100 L0,100 Z" className="fill-primary" style={{
          opacity: 0.6
        }} />
          <path d="M0,70 C360,40 720,90 1080,60 C1440,30 1800,80 2160,50 C2520,90 2880,60 2880,70 L2880,100 L0,100 Z" className="fill-primary" />
        </svg>
        {/* Taco mascot overlay */}
        <OptimizedImage src={tacoMascotMenu} alt="Mascota Taco" className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-96 md:h-[36rem] object-contain z-10" />
      </div>
      <div className="container relative z-10">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4">
            <WordPullUp 
              words="Nuestro Menú" 
              className="text-4xl md:text-5xl text-foreground mb-4"
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
            transition={{ delay: 0.4 }}
            className="font-menu text-muted-foreground max-w-xl mx-auto"
          >
            Sabores auténticos preparados con recetas tradicionales y los mejores ingredientes
          </motion.p>
        </div>

        {/* Category Tabs with Scroll */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative mb-12"
        >
          {/* Left Arrow */}
          <button 
            onClick={() => scrollCategories('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-primary/90 hover:bg-primary text-primary-foreground rounded-full p-2 shadow-lg hidden md:flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          {/* Scrollable Categories */}
          <div 
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-2 font-menu scroll-smooth touch-pan-x"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {categories.map(category => (
              <Button 
                key={category.id} 
                variant={activeCategory === category.id ? 'terracotta' : 'secondary'} 
                onClick={() => setActiveCategory(category.id as CategoryId)} 
                className="gap-2 whitespace-nowrap flex-shrink-0"
              >
                <span>{category.icon}</span>
                {category.name}
              </Button>
            ))}
          </div>
          
          {/* Right Arrow */}
          <button 
            onClick={() => scrollCategories('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-primary/90 hover:bg-primary text-primary-foreground rounded-full p-2 shadow-lg hidden md:flex items-center justify-center"
          >
          <ChevronRight className="w-5 h-5" />
          </button>
        </motion.div>

        {/* Menu Carousel */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
        {/* Menu Carousel - Mobile only */}
        <div className="md:hidden overflow-visible">
          <Carousel
            opts={{
              align: "center",
              loop: true,
            }}
            className="w-full overflow-visible"
          >
            <CarouselContent className="-ml-2 overflow-visible">
              {filteredItems.map((item, index) => (
                <CarouselItem key={item.id} className="pl-2 basis-[38%]">
                  <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: false, amount: 0.3 }}
                    transition={{
                      duration: 0.25, 
                      delay: index * 0.05,
                      ease: [0.25, 0.1, 0.25, 1]
                    }}
                    className="h-full"
                  >
                  <div 
                    onClick={() => handleCardClick(item)}
                    className="group bg-card rounded-xl overflow-hidden shadow-card hover:shadow-[0_0_20px_hsl(42_85%_55%/0.4)] transition-all duration-300 border border-gold/50 hover:border-gold h-full cursor-pointer">
                    {/* Image */}
                    <MenuItemImage
                      image={item.image}
                      itemName={item.name}
                      itemId={item.id}
                      categoryIcon={categories.find(c => c.id === item.category)?.icon || '🍽️'}
                      size="sm"
                      onImageUploaded={handleImageUploaded}
                    />
                    {item.popular && (
                      <div className="absolute top-2 left-2 bg-gold text-gold-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 z-10">
                        <Star className="w-2 h-2 fill-current" />
                        Popular
                      </div>
                    )}

                    {/* Content */}
                    <div className="p-2 font-menu">
                      <h3 className="text-sm font-semibold text-white mb-1 line-clamp-1">
                        {item.name}
                      </h3>
                      <p className="text-xs text-white/70 mb-2 line-clamp-1">
                        {item.description}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-gold">
                          ${item.price}
                        </span>
                        <Button variant="terracotta" size="sm" onClick={(e) => handleAddItem(item, e)} className="gap-1 text-xs px-2 py-1 h-7">
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  </motion.div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>

        {/* Menu Grid - Desktop */}
        <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{
                duration: 0.3, 
                delay: index * 0.05,
                ease: [0.25, 0.1, 0.25, 1]
              }}
              className="h-full"
            >
            <div 
              onClick={() => handleCardClick(item)}
              className="group bg-card rounded-2xl overflow-hidden shadow-card hover:shadow-[0_0_30px_hsl(42_85%_55%/0.4)] transition-all duration-300 hover:-translate-y-1 border border-gold/50 hover:border-gold h-full cursor-pointer">
              {/* Image */}
              <MenuItemImage
                image={item.image}
                itemName={item.name}
                itemId={item.id}
                categoryIcon={categories.find(c => c.id === item.category)?.icon || '🍽️'}
                size="lg"
                onImageUploaded={handleImageUploaded}
              />
              {item.popular && (
                <div className="absolute top-3 left-3 bg-gold text-gold-foreground text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1 animate-pulse z-10">
                  <Star className="w-3 h-3 fill-current" />
                  Popular
                </div>
              )}

              {/* Content */}
              <div className="p-4 font-menu">
                <h3 className="text-xl font-semibold text-white mb-2">
                  {item.name}
                </h3>
                <p className="text-sm text-white/70 mb-4 line-clamp-2">
                  {item.description}
                </p>
                
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-gold">
                    ${item.price}
                  </span>
                  <Button variant="terracotta" size="sm" onClick={(e) => handleAddItem(item, e)} className="gap-1">
                    <Plus className="w-4 h-4" />
                    Agregar
                  </Button>
                </div>
              </div>
            </div>
            </motion.div>
          ))}
        </div>
        </motion.div>

        {/* Pizza promo image with optical effect */}
        <div className="mt-12 flex justify-center">
          <img 
            src={pizzaPromo} 
            alt="Pizza deliciosa con queso derretido" 
            loading="lazy"
            decoding="async"
            className="w-full max-w-sm md:max-w-md object-contain drop-shadow-2xl" 
            style={{ animation: 'wiggleFloat 2s ease-in-out infinite' }} 
          />
        </div>
      </div>

      {/* Side decorative images - hidden on mobile */}
      <OptimizedImage 
        src={menuSalsa} 
        alt="La Salsa" 
        className="hidden md:block absolute left-0 top-16 w-32 lg:w-96 xl:w-[28rem] -translate-x-1/4 drop-shadow-2xl z-0" 
        style={{ animation: 'float 4s ease-in-out infinite' }}
      />
      <OptimizedImage 
        src={menuAguaFresca} 
        alt="El Agua Fresca" 
        className="hidden md:block absolute right-0 top-[28rem] w-32 lg:w-96 xl:w-[28rem] translate-x-1/4 drop-shadow-2xl z-0" 
        style={{ animation: 'float 4s ease-in-out infinite', animationDelay: '1s' }}
      />
      
      {/* Side taco images - visible on all devices */}
      <OptimizedImage 
        alt="Taco con salsa" 
        className="absolute left-0 bottom-[17rem] md:bottom-24 w-36 md:w-40 lg:w-96 xl:w-[28rem] -translate-x-1/3 lg:-translate-x-1/4 drop-shadow-2xl z-10" 
        src="/lovable-uploads/a31a9d8a-89bf-4df0-a48a-b65d7ba02182.png" 
      />
      <OptimizedImage 
        src={tacoRight} 
        alt="Plato de tacos" 
        className="absolute right-0 bottom-[17rem] md:bottom-24 w-36 md:w-40 lg:w-96 xl:w-[28rem] translate-x-1/3 lg:translate-x-1/4 drop-shadow-2xl z-10" 
      />
      
      {/* Menu Item Dialog */}
      <MenuItemDialog 
        item={selectedItem} 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
      />
    </section>;
};
export default MenuSection;