import { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, MessageCircle, ArrowUp, Clock, CreditCard, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DirectionAwareHover } from '@/components/ui/direction-aware-hover';
import { WordPullUp } from '@/components/ui/word-pull-up';
import { CartProvider } from '@/context/CartContext';
import { cn } from '@/lib/utils';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import CartDrawer from '@/components/CartDrawer';
import servicioFoto from '@/assets/servicio-foto.avif';
import eventosHero from '@/assets/eventos-hero.jpg';
import paymentCards from '@/assets/payment-cards.png';
import tacoLeft from '@/assets/taco-left.png';
import tacoRight from '@/assets/taco-right.png';
import handTaco from '@/assets/hand-taco.png';
import mascotTaco from '@/assets/mascot-taco.png';
const EventosContent = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [fecha, setFecha] = useState<Date>();
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    servicio: '',
    horario: '',
    personas: '',
    comentarios: ''
  });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    window.open('https://api.whatsapp.com/send?phone=529992227302&text=Hola%20quisiera%20hacer%20una%20cotizaci%C3%B3n%20para%20un%20evento', '_blank');
  };
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  return <div className="min-h-screen bg-background">
      <Header onCartClick={() => setIsCartOpen(true)} />

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4 relative min-h-[80vh] flex items-center" style={{
      backgroundImage: `url(${eventosHero})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }}>
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/60 via-transparent to-primary/80" />
        <div className="container relative z-10">
          <motion.div initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} className="text-center mb-12">
            <WordPullUp 
              words="SERVICIO PARA FIESTAS Y EVENTOS" 
              className="text-4xl md:text-6xl text-amber-300 mb-4"
            />
            <motion.p 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ delay: 0.6 }}
              className="text-xl md:text-2xl text-primary-foreground/90 max-w-3xl mx-auto"
            >
              ¡Nuestro personal impecable y uniformado para darle una excelente presentación a su fiesta o evento!
            </motion.p>
          </motion.div>

          {/* Direction Aware Image */}
          <div className="flex justify-center mb-16">
            <DirectionAwareHover imageUrl={servicioFoto} className="w-full max-w-2xl h-80 md:h-[500px] rounded-2xl shadow-2xl">
              <p className="font-bold text-2xl md:text-3xl">¡SOMOS EL SABOR DE TU EVENTO!</p>
              <p className="font-normal text-lg">Servicio profesional de tacos</p>
            </DirectionAwareHover>
          </div>
        </div>
      </section>

      {/* Services Included */}
      <section className="relative py-16 bg-terracotta">
        {/* Animated Wave at top */}
        <div className="absolute top-0 left-0 right-0 overflow-hidden leading-none transform -translate-y-[85%]">
          <svg className="relative block w-[200%] h-16 md:h-24 rotate-180" viewBox="0 0 2880 100" preserveAspectRatio="none" style={{
          animation: 'waveSlide 12s linear infinite'
        }}>
            <path d="M0,50 C360,100 720,0 1080,50 C1440,100 1800,0 2160,50 C2520,100 2880,0 2880,50 L2880,100 L0,100 Z" className="fill-terracotta" style={{
            opacity: 0.4
          }} />
            <path d="M0,60 C360,20 720,80 1080,40 C1440,0 1800,60 2160,20 C2520,80 2880,40 2880,60 L2880,100 L0,100 Z" className="fill-terracotta" style={{
            opacity: 0.6
          }} />
            <path d="M0,70 C360,40 720,90 1080,60 C1440,30 1800,80 2160,50 C2520,90 2880,60 2880,70 L2880,100 L0,100 Z" className="fill-terracotta" />
          </svg>
        </div>
        <div className="container px-4">
          <WordPullUp 
            words="Nuestro servicio incluye:" 
            className="text-3xl md:text-4xl text-gold mb-12"
          />
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <motion.div initial={{
            opacity: 0,
            x: -20
          }} whileInView={{
            opacity: 1,
            x: 0
          }} className="bg-primary rounded-2xl p-6 border border-gold/30">
              <ul className="space-y-3 text-primary-foreground">
                {['Kilos de carne solicitada', 'Cebolla, cilantro, limones', 'Salsas: Guacamolera, roja y verde', '(Puede solicitar la deliciosa crema de ajo y la salsa mexicana)', 'Tortilla taquera de maíz y harina', 'Platos y servilletas para el servicio', 'El servicio de parrilla es por 3 horas'].map((item, i) => <li key={i} className="flex items-start gap-2">
                    <span className="text-gold">●</span>
                    <span>{item}</span>
                  </li>)}
              </ul>
            </motion.div>

            <motion.div initial={{
            opacity: 0,
            x: 20
          }} whileInView={{
            opacity: 1,
            x: 0
          }} className="bg-primary rounded-2xl p-6 border border-gold/30">
              <h3 className="font-menu text-xl font-bold text-primary-foreground mb-4">Nuestros Complementos Extras:</h3>
              <ul className="space-y-3 text-primary-foreground">
                {['Guacamole', 'Cebollitas Cambray', 'Frijoles Charros', 'Kilo de queso para gringas, quesadillas o chicharrón de queso', 'Nuestros famosos frijolitos con tostaditas hechas en casa'].map((item, i) => <li key={i} className="flex items-start gap-2">
                    <span className="text-gold">●</span>
                    <span>{item}</span>
                  </li>)}
              </ul>
            </motion.div>
          </div>

          {/* Meats */}
          <motion.div initial={{
          opacity: 0,
          y: 20
        }} whileInView={{
          opacity: 1,
          y: 0
        }} className="mt-12 text-center">
            <h3 className="font-menu text-xl font-bold text-gold mb-4">Nuestras carnes:</h3>
            <p className="text-foreground text-lg">
              Pastor, Bistec, Chuleta, Poc-Chuc, Costilla, Chuleta, Pechuga de Pollo y Arrachera
            </p>
          </motion.div>

          {/* Payment Methods */}
          <motion.div initial={{
          opacity: 0,
          y: 20
        }} whileInView={{
          opacity: 1,
          y: 0
        }} className="mt-8 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-foreground">
              <CreditCard className="w-6 h-6 text-gold" />
              <span className="font-medium">Formas de pago: Efectivo, crédito o débito</span>
            </div>
            <img src={paymentCards} alt="Visa, MasterCard, American Express" className="h-24 md:h-32 object-contain" />
          </motion.div>
        </div>

        {/* Decorative side image - hidden on mobile */}
        <img src={tacoRight} alt="Plato de tacos" className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 w-48 xl:w-64 translate-x-1/3 drop-shadow-2xl z-0" style={{
          animation: 'float 4s ease-in-out infinite',
          animationDelay: '1s'
        }} />
      </section>

      {/* Quote Form */}
      <section className="relative pt-24 md:pt-32 pb-16 px-4 bg-gradient-to-b from-background to-primary/20 overflow-hidden">
        {/* Animated Wave at top */}
        <div className="absolute -top-1 left-0 right-0 overflow-hidden leading-none rotate-180">
          <svg className="relative block w-[200%] h-16 md:h-24" viewBox="0 0 2880 100" preserveAspectRatio="none" style={{
            animation: 'waveSlide 15s linear infinite'
          }}>
            <path d="M0,50 C360,100 720,0 1080,50 C1440,100 1800,0 2160,50 C2520,100 2880,0 2880,50 L2880,100 L0,100 Z" className="fill-terracotta" style={{
              opacity: 0.4
            }} />
            <path d="M0,60 C360,20 720,80 1080,40 C1440,0 1800,60 2160,20 C2520,80 2880,40 2880,60 L2880,100 L0,100 Z" className="fill-terracotta" style={{
              opacity: 0.6
            }} />
            <path d="M0,70 C360,40 720,90 1080,60 C1440,30 1800,80 2160,50 C2520,90 2880,60 2880,70 L2880,100 L0,100 Z" className="fill-terracotta" />
          </svg>
        </div>

        {/* Decorative side images - hidden on mobile */}
        <img src={mascotTaco} alt="Decoración" className="hidden lg:block absolute left-0 top-1/4 w-56 xl:w-72 -translate-x-1/4 drop-shadow-2xl z-0" style={{
          animation: 'float 4s ease-in-out infinite'
        }} />
        <img src={handTaco} alt="Decoración" className="hidden lg:block absolute right-0 bottom-1/4 w-56 xl:w-72 translate-x-1/4 drop-shadow-2xl z-0" style={{
          animation: 'float 4s ease-in-out infinite',
          animationDelay: '1.5s'
        }} />

        <div className="container max-w-3xl relative z-10">
          <motion.div initial={{
          opacity: 0,
          y: 20
        }} whileInView={{
          opacity: 1,
          y: 0
        }} className="bg-card rounded-3xl p-8 md:p-12 shadow-2xl border border-gold/30">
            <WordPullUp 
              words="¡COTIZA CON NOSOTROS!" 
              className="text-3xl md:text-4xl text-gold mb-2"
            />
            <motion.p 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ delay: 0.5 }}
              className="text-center text-muted-foreground mb-8"
            >
              Solicitud de presupuesto
            </motion.p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Nombre</label>
                  <Input placeholder="Tu nombre" value={formData.nombre} onChange={e => setFormData({
                  ...formData,
                  nombre: e.target.value
                })} required />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Apellido</label>
                  <Input placeholder="Tu apellido" value={formData.apellido} onChange={e => setFormData({
                  ...formData,
                  apellido: e.target.value
                })} required />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Email</label>
                  <Input type="email" placeholder="tu@email.com" value={formData.email} onChange={e => setFormData({
                  ...formData,
                  email: e.target.value
                })} required />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Teléfono</label>
                  <Input type="tel" placeholder="999 123 4567" value={formData.telefono} onChange={e => setFormData({
                  ...formData,
                  telefono: e.target.value
                })} required />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Selecciona un servicio</label>
                  <Select onValueChange={value => setFormData({
                  ...formData,
                  servicio: value
                })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un servicio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="servicio-trompo">Servicio de trompo</SelectItem>
                      <SelectItem value="buffete">Buffete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Fecha del evento</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !fecha && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fecha ? format(fecha, "PPP", { locale: es }) : <span>Selecciona una fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={fecha}
                        onSelect={setFecha}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Horario</label>
                  <Input 
                    type="text" 
                    placeholder="Ej: 2:00 PM - 5:00 PM" 
                    value={formData.horario} 
                    onChange={e => setFormData({
                      ...formData,
                      horario: e.target.value
                    })} 
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Número de personas</label>
                  <Input type="number" placeholder="Ingresa un número de personas" value={formData.personas} onChange={e => setFormData({
                  ...formData,
                  personas: e.target.value
                })} required />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Comentarios</label>
                <Textarea placeholder="Cuéntanos más sobre tu evento..." value={formData.comentarios} onChange={e => setFormData({
                ...formData,
                comentarios: e.target.value
              })} rows={4} />
              </div>

              <Button type="submit" variant="terracotta" size="lg" className="w-full text-lg">
                <MessageCircle className="w-5 h-5 mr-2" />
                ¡Llama y cotiza!
              </Button>
            </form>
          </motion.div>
        </div>
      </section>

      {/* Contact Info */}
      <section className="relative py-6 bg-primary">
        <div className="container px-4 text-center">
          <p className="text-white/80 mb-4">Para mayor información y disponibilidad para el evento comunicarse con:</p>
          
          <motion.div initial={{
          opacity: 0,
          scale: 0.9
        }} whileInView={{
          opacity: 1,
          scale: 1
        }} className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 max-w-xl mx-auto">
            <h3 className="font-menu text-2xl font-bold text-white mb-2">Mireya Santos</h3>
            <p className="text-gold font-medium mb-4">Gerente de Eventos</p>
            
            <div className="space-y-2 text-white">
              <p className="flex items-center justify-center gap-2">
                <Phone className="w-4 h-4" />
                Cel. (9992) 22.73.02
              </p>
              <p className="flex items-center justify-center gap-2">
                <Phone className="w-4 h-4" />
                Tel. Oficina. 923.51.10 y 923.55.63
              </p>
              <p className="flex items-center justify-center gap-2">
                <Clock className="w-4 h-4" />
                Horario de oficina de 9 am a 6:30 pm
              </p>
            </div>

            <a href="https://api.whatsapp.com/send?phone=529992227302&text=Hola%20quisiera%20cotizar%20un%20evento" target="_blank" rel="noopener noreferrer" className="mt-6 inline-block">
              <Button size="lg" className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                <MessageCircle className="w-5 h-5" />
                ¡WhatsApp y cotiza!
              </Button>
            </a>
          </motion.div>
        </div>
      </section>

      <Footer />

      {/* Floating WhatsApp Button */}
      <FloatingWhatsApp />

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} onCheckout={() => setIsCartOpen(false)} />
    </div>;
};
const Eventos = () => {
  return <CartProvider>
      <EventosContent />
    </CartProvider>;
};
export default Eventos;