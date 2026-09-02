import { Instagram, Facebook, MapPin, Phone, Mail } from 'lucide-react';
import logo from '@/assets/logo.avif';

const Footer = () => {
  return (
    <footer className="text-white relative">
      {/* Wave transition from background to footer */}
      <div className="w-full overflow-hidden leading-[0]">
        <svg 
          className="relative block w-[200%] h-24 md:h-40" 
          viewBox="0 0 2880 100" 
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ animation: 'waveSlide 15s linear infinite' }}
        >
          {/* Blue wave layers with gradient opacity */}
          <path 
            d="M0,30 C360,80 720,0 1080,30 C1440,80 1800,0 2160,30 C2520,80 2880,0 2880,30 L2880,100 L0,100 Z" 
            fill="hsl(var(--primary))"
            opacity="0.4"
          />
          <path 
            d="M0,45 C360,10 720,70 1080,35 C1440,0 1800,55 2160,20 C2520,70 2880,35 2880,45 L2880,100 L0,100 Z" 
            fill="hsl(var(--primary))"
            opacity="0.6"
          />
          <path 
            d="M0,55 C360,30 720,80 1080,50 C1440,20 1800,70 2160,40 C2520,80 2880,50 2880,55 L2880,100 L0,100 Z" 
            fill="hsl(var(--primary))"
          />
          {/* Terracotta wave layers with gradient opacity */}
          <path 
            d="M0,65 C360,95 720,40 1080,70 C1440,100 1800,45 2160,75 C2520,100 2880,50 2880,65 L2880,100 L0,100 Z" 
            fill="hsl(var(--terracotta))"
            opacity="0.4"
          />
          <path 
            d="M0,75 C360,50 720,90 1080,65 C1440,40 1800,85 2160,60 C2520,90 2880,65 2880,75 L2880,100 L0,100 Z" 
            fill="hsl(var(--terracotta))"
            opacity="0.6"
          />
          <path 
            d="M0,85 C360,60 720,95 1080,75 C1440,55 1800,92 2160,70 C2520,95 2880,75 2880,85 L2880,100 L0,100 Z" 
            fill="hsl(var(--terracotta))"
          />
        </svg>
      </div>
      
      {/* Footer content with terracotta background */}
      <div className="bg-terracotta pb-8">
        <div className="container pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Brand */}
            <div className="flex justify-center md:justify-start">
              <div className="flex items-center gap-2 mb-4">
                <img src={logo} alt="Los Taquitos de PM" className="h-16 w-auto" />
              </div>
            </div>

            {/* Contacto */}
            <div>
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <Mail className="w-4 h-4 text-white" />
                Contacto
              </h4>
              <ul className="space-y-3 text-sm text-white/70">
                <li>
                  <a href="mailto:recursos.humanos@lostaquitosdepm.com" className="hover:text-white transition-colors">
                    recursos.humanos@lostaquitosdepm.com
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-3 h-3" />
                  Tel. Oficinas: 9.23.51.10 / 9.23.55.63 / 9.28.59.90
                </li>
                <li className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Matriz: Calle 69 # 596 x 78 y 80 Col. Centro, Mérida, Yucatán, México. C.P. 97000</span>
                </li>
              </ul>
            </div>

            {/* Social */}
            <div>
              <h4 className="font-semibold mb-4">Síguenos</h4>
              <div className="flex gap-4">
              <a 
                href="https://www.instagram.com/taquitosdepm/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                  <Instagram className="w-5 h-5" />
                </a>
              <a 
                href="https://www.facebook.com/lostaquitosdepm/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <Facebook className="w-5 h-5" />
              </a>
              </div>
            </div>
          </div>

          <div className="border-t border-white/20 pt-8 text-center text-sm text-white/50">
            <p>© {new Date().getFullYear()} Los Taquitos de PM. Todos los derechos reservados. By Kairos Solutions AI</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;