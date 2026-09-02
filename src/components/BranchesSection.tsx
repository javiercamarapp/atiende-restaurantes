import { memo } from "react";
import { motion } from "framer-motion";
import { WordPullUp } from "@/components/ui/word-pull-up";
import { AnimatedTabs, type Tab } from "@/components/ui/animated-tabs";
import { MapPin, Clock } from "lucide-react";
import OptimizedImage from "@/components/OptimizedImage";

// Use public paths for lazy loading
const whatsappIcon = "/branch-images/whatsapp-icon.png";
const phoneIcon = "/branch-images/phone-icon-new.png";
const branchFcoMontejo = "/branch-images/branch-fco-montejo.png";
const branchGalerias = "/branch-images/branch-galerias.png";
const branchChicxulub = "/branch-images/branch-chicxulub.png";
const branchPensiones = "/branch-images/branch-pensiones.png";
const tshirtPromo = "/branch-images/tshirt-promo.png";
const promoBoxTshirt = "/branch-images/promo-box-tshirt.png";
const promoTshirtBack = "/branch-images/promo-tshirt-back.png";
const mascotTaco = "/branch-images/mascot-taco.png";
const handTaco = "/branch-images/hand-taco.png";
const handsBox = "/branch-images/hand-taco-bottom.png";
const branchTabs: Tab[] = [{
  id: "altabrisa",
  label: "Altabrisa",
  content: <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full">
        <img alt="Sucursal Altabrisa" className="rounded-lg w-full h-48 md:h-60 object-cover mt-0 !m-0 shadow-[0_0_20px_rgba(0,0,0,0.2)] border-none" src="https://static.wixstatic.com/media/634cb5_e78bac0e6e68415fa94d50efd7355b6d~mv2.png/v1/fill/w_980,h_980,al_c,q_90,usm_0.66_1.00_0.01,enc_avif,quality_auto/Captura%20de%20Pantalla%202022-09-15%20a%20la(s)%2011_43_09.png" />
        <div className="flex flex-col gap-y-3">
          <h2 className="font-menu text-xl md:text-2xl font-bold mb-0 text-white mt-0 !m-0">
            Sucursal Altabrisa
          </h2>
          <div className="flex items-start gap-2 text-sm text-gray-200">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-gold" />
            <span>C. 4 279, Vista Alegre Nte. Dentro de la Plaza Victory Altabrisa</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-200">
            <Clock className="w-4 h-4 mt-0.5 flex-shrink-0 text-gold" />
            <div className="flex flex-col">
              <span>Domingo a Jueves: 12 PM a 1 AM</span>
              <span>Viernes y Sábado: 12 PM a 1 AM</span>
            </div>
          </div>
          <p className="text-sm text-white font-medium mt-1">¡Abierto desde el mediodía todos los días!</p>
          <div className="flex-1 flex items-end justify-center md:justify-end mr-0 md:mr-4 gap-3">
            <a href="tel:9995182857" className="hover:scale-110 transition-transform">
              <img src={phoneIcon} alt="Llamar" className="w-8 h-8" />
            </a>
            <a href="https://api.whatsapp.com/send?phone=529995182857&text=Hola%20quisiera%20ordenar%20en%20Altabrisa" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform">
              <img src={whatsappIcon} alt="WhatsApp" className="w-8 h-8" />
            </a>
          </div>
        </div>
      </div>
}, {
  id: "garcia-lavin",
  label: "García Lavín",
  content: <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full">
        <img alt="Sucursal García Lavín - Victory Platz" className="rounded-lg w-full h-48 md:h-60 object-cover mt-0 !m-0 shadow-[0_0_20px_rgba(0,0,0,0.2)] border-none" src="https://static.wixstatic.com/media/634cb5_96a2ca5071a443009ee4794dbfe2b53a~mv2.jpg/v1/fill/w_598,h_598,al_c,lg_1,q_80,enc_avif,quality_auto/Victory%20Platz.jpg" />
        <div className="flex flex-col gap-y-3">
          <h2 className="font-menu text-xl md:text-2xl font-bold mb-0 text-white mt-0 !m-0">
            Sucursal García Lavín
          </h2>
          <div className="flex items-start gap-2 text-sm text-gray-200">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-gold" />
            <span>Av. Andrés García Lavín, San Ramón Norte. Dentro de la Plaza Victory Platz.</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-200">
            <Clock className="w-4 h-4 mt-0.5 flex-shrink-0 text-gold" />
            <div className="flex flex-col">
              <span>Domingo a Jueves: 12 PM a 1 AM</span>
              <span>Viernes y Sábado: 12 PM a 1 AM</span>
            </div>
          </div>
          <p className="text-sm text-white font-medium mt-1">¡Abierto desde el mediodía todos los días!</p>
          <div className="flex-1 flex items-end justify-center md:justify-end mr-0 md:mr-4 gap-3">
            <a href="tel:9995182637" className="hover:scale-110 transition-transform">
              <img src={phoneIcon} alt="Llamar" className="w-8 h-8" />
            </a>
            <a href="https://api.whatsapp.com/send?phone=529995182637&text=Hola%20quisiera%20ordenar%20en%20VictoryPlatz" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform">
              <img src={whatsappIcon} alt="WhatsApp" className="w-8 h-8" />
            </a>
          </div>
        </div>
      </div>
}, {
  id: "prolongacion-montejo",
  label: "Prol. Montejo",
  content: <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full">
        <img alt="Sucursal Prolongación Paseo de Montejo" className="rounded-lg w-full h-48 md:h-60 object-cover mt-0 !m-0 shadow-[0_0_20px_rgba(0,0,0,0.2)] border-none" src="https://static.wixstatic.com/media/634cb5_6a8fea28b9bf4a5fbc910631c745aef7~mv2.jpg/v1/fill/w_598,h_598,al_c,lg_1,q_80,enc_avif,quality_auto/Prolongaci%C3%B3n%20Paseo%20de%20Montejo.jpg" />
        <div className="flex flex-col gap-y-3">
          <h2 className="font-menu text-xl md:text-2xl font-bold mb-0 text-white mt-0 !m-0">
            Prol. Paseo de Montejo
          </h2>
          <div className="flex items-start gap-2 text-sm text-gray-200">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-gold" />
            <span>C. 34 No. 382-C x 35 y 37 Col. Emiliano Zapata Norte</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-200">
            <Clock className="w-4 h-4 mt-0.5 flex-shrink-0 text-gold" />
            <div className="flex flex-col">
              <span>Lunes a Jueves: 6 PM a 1 AM</span>
              <span>Viernes y Sábado: 12 PM a 1 AM</span>
              <span>Domingos: 12 PM a 1 AM</span>
            </div>
          </div>
          <div className="flex-1 flex items-end justify-center md:justify-end mr-0 md:mr-4 gap-3">
            <a href="tel:9999440342" className="hover:scale-110 transition-transform">
              <img src={phoneIcon} alt="Llamar" className="w-8 h-8" />
            </a>
            <a href="https://api.whatsapp.com/send?phone=529999440342&text=Hola%20quisiera%20ordenar%20en%20Montejo" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform">
              <img src={whatsappIcon} alt="WhatsApp" className="w-8 h-8" />
            </a>
          </div>
        </div>
      </div>
}, {
  id: "francisco-montejo",
  label: "Fco. de Montejo",
  content: <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full">
        <img src={branchFcoMontejo} alt="Sucursal Francisco de Montejo" className="rounded-lg w-full h-48 md:h-60 object-cover mt-0 !m-0 shadow-[0_0_20px_rgba(0,0,0,0.2)] border-none" />
        <div className="flex flex-col gap-y-3">
          <h2 className="font-menu text-xl md:text-2xl font-bold mb-0 text-white mt-0 !m-0">
            Francisco de Montejo
          </h2>
          <div className="flex items-start gap-2 text-sm text-gray-200">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-gold" />
            <span>C. 50 Esquina x 53-B, Fraccionamiento Francisco de Montejo</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-200">
            <Clock className="w-4 h-4 mt-0.5 flex-shrink-0 text-gold" />
            <div className="flex flex-col">
              <span>Lunes a Viernes: 6 PM a 12 AM</span>
              <span>Sábados y Domingos: 12 PM a 12 AM</span>
            </div>
          </div>
          <div className="flex-1 flex items-end justify-center md:justify-end mr-0 md:mr-4 gap-3">
            <a href="tel:9999537122" className="hover:scale-110 transition-transform">
              <img src={phoneIcon} alt="Llamar" className="w-8 h-8" />
            </a>
            <a href="https://api.whatsapp.com/send?phone=529999537122&text=Hola%20quisiera%20ordenar%20en%20Fco.%20de%20Montejo" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform">
              <img src={whatsappIcon} alt="WhatsApp" className="w-8 h-8" />
            </a>
          </div>
        </div>
      </div>
}, {
  id: "galerias",
  label: "Galerías",
  content: <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full">
        <img src={branchGalerias} alt="Sucursal Galerías Mérida" className="rounded-lg w-full h-48 md:h-60 object-cover mt-0 !m-0 shadow-[0_0_20px_rgba(0,0,0,0.2)] border-none" />
        <div className="flex flex-col gap-y-3">
          <h2 className="font-menu text-xl md:text-2xl font-bold mb-0 text-white mt-0 !m-0">
            Galerías Mérida
          </h2>
          <div className="flex items-start gap-2 text-sm text-gray-200">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-gold" />
            <div className="flex flex-col">
              <span>Food Court (planta alta) de Plaza Galerías</span>
              <span>C.60 No. 299-A Carretera Mérida-Progreso Km 0.5</span>
              <span>Col. Revolución Cordemex</span>
            </div>
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-200">
            <Clock className="w-4 h-4 mt-0.5 flex-shrink-0 text-gold" />
            <span>Lunes a Domingo: 12 PM a 9 PM</span>
          </div>
        </div>
      </div>
}, {
  id: "chicxulub",
  label: "Chicxulub",
  content: <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full">
        <div className="relative">
          <img src={branchChicxulub} alt="Sucursal Chicxulub" className="rounded-lg w-full h-48 md:h-60 object-cover mt-0 !m-0 shadow-[0_0_20px_rgba(0,0,0,0.2)] border-none" />
          {/* Sticker Banner */}
          <div className="absolute top-2 right-2 md:top-4 md:right-4 bg-yellow-400 px-3 py-2 md:px-4 md:py-3 rounded-lg shadow-lg animate-wiggle"
               style={{ boxShadow: '3px 3px 10px rgba(0,0,0,0.3)' }}>
            <span className="text-red-600 font-bold text-[10px] md:text-xs leading-tight block text-center uppercase">
              CERRADO<br/>NOS VEMOS<br/>EN SEMANA<br/>SANTA
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-y-3">
          <h2 className="font-menu text-xl md:text-2xl font-bold mb-0 text-white mt-0 !m-0">
            Sucursal Chicxulub
          </h2>
          <div className="flex items-start gap-2 text-sm text-gray-200">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-gold" />
            <span>C.19 x 22 y 24 Chicxulub, Progreso, a una cuadra de la Feria de Chicxulub</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-200">
            <Clock className="w-4 h-4 mt-0.5 flex-shrink-0 text-gold" />
            <div className="flex flex-col">
              <span>Lunes a Domingo: 6 PM a 1 AM</span>
              <span className="text-xs text-gray-300">Abierto Semana Santa y temporada de verano (Julio y Agosto)</span>
            </div>
          </div>
          <div className="flex-1 flex items-end justify-center md:justify-end mr-0 md:mr-4 gap-3">
            <a href="tel:9686884195" className="hover:scale-110 transition-transform">
              <img src={phoneIcon} alt="Llamar" className="w-8 h-8" />
            </a>
            <a href="https://api.whatsapp.com/send?phone=529696884195&text=Hola%20quisiera%20ordenar%20en%20Chicxulub" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform">
              <img src={whatsappIcon} alt="WhatsApp" className="w-8 h-8" />
            </a>
          </div>
        </div>
      </div>
}, {
  id: "pensiones",
  label: "Pensiones",
  content: <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full">
        <img src={branchPensiones} alt="Sucursal Pensiones" className="rounded-lg w-full h-48 md:h-60 object-cover mt-0 !m-0 shadow-[0_0_20px_rgba(0,0,0,0.2)] border-none" />
        <div className="flex flex-col gap-y-3">
          <h2 className="font-menu text-xl md:text-2xl font-bold mb-0 text-white mt-0 !m-0">
            Sucursal Pensiones
          </h2>
          <div className="flex items-start gap-2 text-sm text-gray-200">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-gold" />
            <span>Calle 52 No 37 Por Avenida 7, Residencial Pensiones, cerca de Plaza las Américas</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-200">
            <Clock className="w-4 h-4 mt-0.5 flex-shrink-0 text-gold" />
            <div className="flex flex-col">
              <span>Lunes a Sábado: 6 PM a 12 AM</span>
              <span>Domingos: 12 PM a 12 AM</span>
            </div>
          </div>
          <p className="text-xs text-gray-300 italic">Servicio a domicilio únicamente de viernes a domingo</p>
          <div className="flex-1 flex items-end justify-center md:justify-end mr-0 md:mr-4 gap-3">
            <a href="tel:9999875410" className="hover:scale-110 transition-transform">
              <img src={phoneIcon} alt="Llamar" className="w-8 h-8" />
            </a>
            <a href="https://api.whatsapp.com/send?phone=529999875410&text=Hola%20quisiera%20ordenar%20en%20Pensiones" target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform">
              <img src={whatsappIcon} alt="WhatsApp" className="w-8 h-8" />
            </a>
          </div>
        </div>
      </div>
}];
const BranchesSection = memo(() => {
  return <section className="relative bg-primary pt-4 pb-4">
      {/* Animated Wave shape at top - covering the video */}
      <div className="absolute top-0 left-0 right-0 overflow-hidden leading-none transform -translate-y-[99%] z-10">
        <svg className="relative block w-[200%] h-16 md:h-24" viewBox="0 0 2880 100" preserveAspectRatio="none" style={{
        animation: 'waveSlide 12s linear infinite'
      }}>
          <path d="M0,100 L0,50 C360,100 720,0 1080,50 C1440,100 1800,0 2160,50 C2520,100 2880,0 2880,50 L2880,100 Z" className="fill-primary" style={{
          opacity: 0.4
        }} />
          <path d="M0,100 L0,60 C360,20 720,80 1080,40 C1440,0 1800,60 2160,20 C2520,80 2880,40 2880,60 L2880,100 Z" className="fill-primary" style={{
          opacity: 0.6
        }} />
          <path d="M0,100 L0,70 C360,40 720,90 1080,60 C1440,30 1800,80 2160,50 C2520,90 2880,60 2880,70 L2880,100 Z" className="fill-primary" />
        </svg>
      </div>

      {/* Promo image above title */}
      <div className="relative flex justify-center mb-6 overflow-visible">
        {/* Left edge promo box image */}
        <img 
          src={promoBoxTshirt} 
          alt="Caja El Mejor Pastor" 
          loading="lazy"
          className="absolute left-0 top-0 h-40 md:h-[18rem] object-contain z-10"
          style={{ 
            animation: 'float 3s ease-in-out infinite',
            marginLeft: '-4rem'
          }}
        />
        <img 
          src={tshirtPromo} 
          alt="Los Taquitos de PM - El Mejor Pastor" 
          loading="lazy"
          className="w-full max-w-xs md:max-w-sm object-contain drop-shadow-2xl"
          style={{ animation: 'float 3s ease-in-out infinite' }}
        />
        {/* Right edge tshirt image - desktop only */}
        <img 
          src={promoTshirtBack} 
          alt="Playera Los Taquitos de PM" 
          loading="lazy"
          className="hidden md:block absolute top-0 h-[36rem] object-contain z-10"
          style={{ 
            animation: 'float 3s ease-in-out infinite',
            right: '-12rem'
          }}
        />
      </div>

      {/* Mascot image on the left edge */}
      <img 
        src={mascotTaco} 
        alt="Mascota Los Taquitos de PM" 
        loading="lazy"
        className="absolute object-contain z-10 h-32 top-[24rem] -left-6 md:h-[28rem] md:top-[22rem] md:left-0"
      />

      {/* Hand with taco on the right edge */}
      <img 
        src={handTaco} 
        alt="Mano con taco" 
        loading="lazy"
        className="absolute object-contain z-10 h-36 top-[28rem] -right-10 md:h-[24rem] md:top-[26rem] md:-right-16"
      />

      <div id="sucursales" className="container px-4 scroll-mt-20">
        <div className="text-center mb-8">
          <WordPullUp 
            words="Nuestras Sucursales" 
            className="text-4xl md:text-5xl text-white mb-4"
          />
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ delay: 0.5 }}
            className="text-white/80 text-lg max-w-2xl mx-auto"
          >
            Visítanos en cualquiera de nuestras ubicaciones en Mérida
          </motion.p>
        </div>

        <motion.div 
          initial={{ opacity: 0, x: 60 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{
            duration: 0.8, 
            delay: 0.2,
            ease: [0.25, 0.1, 0.25, 1]
          }}
          className="flex justify-center"
        >
          <AnimatedTabs tabs={branchTabs} defaultTab="altabrisa" className="max-w-full md:max-w-4xl" />
        </motion.div>

        {/* Hand with taco image at bottom - close to waves */}
        <div className="flex justify-center -mb-[5rem]">
          <img 
            src={handsBox} 
            alt="Mano sosteniendo taco" 
            loading="lazy"
            className="w-full max-w-xs md:max-w-sm object-contain drop-shadow-2xl"
            style={{ animation: 'float 3s ease-in-out infinite' }}
          />
        </div>
      </div>
    </section>;
});

BranchesSection.displayName = 'BranchesSection';

export default BranchesSection;
