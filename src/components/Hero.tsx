import { Button } from '@/components/ui/button';
import heroDesktop from '@/assets/hero-desktop-new.png';
import heroLogo from '@/assets/hero-logo.avif';

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-primary">
      {/* Background Video - Mobile */}
      <video 
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover md:hidden"
      >
        <source src="/videos/hero-mobile.mp4" type="video/mp4" />
      </video>
      {/* Background Image - Desktop */}
      <img 
        src={heroDesktop}
        alt="El Taco Árabe - El mejor pastor"
        loading="eager"
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover hidden md:block"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-foreground/10 via-transparent to-foreground/30" />

      {/* Content */}
      <div className="relative z-10 container text-center px-4">
        <div className="max-w-3xl mx-auto mt-48 md:mt-[40vh] mb-32 md:mb-40">
          {/* Mobile Logo */}
          <img 
            src={heroLogo} 
            alt="Los Taquitos de PM" 
            className="md:hidden w-96 mx-auto mb-8"
          />
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up opacity-0 stagger-4">
            <Button 
              variant="ghost"
              size="xl"
              className="bg-terracotta hover:bg-terracotta text-white font-semibold shadow-card hover:shadow-elevated hover:-translate-y-1 transition-all"
              onClick={() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Pedir a domicilio
            </Button>
            <Button 
              variant="ghost"
              size="xl"
              className="bg-primary hover:bg-primary text-primary-foreground font-semibold shadow-card hover:shadow-elevated hover:-translate-y-1 transition-all"
              onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Nuestra Historia
            </Button>
          </div>
        </div>
      </div>

    </section>
  );
};

export default Hero;
