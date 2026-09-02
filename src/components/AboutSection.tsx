const AboutSection = () => {
  return (
    <section id="about" className="relative pt-[1cm] pb-[1cm] bg-terracotta">
      {/* Wave shape at top */}
      <div className="absolute top-0 left-0 right-0 overflow-hidden leading-none transform -translate-y-[99%]">
        <svg 
          className="relative block w-full h-16 md:h-24 rotate-180" 
          viewBox="0 0 1200 120" 
          preserveAspectRatio="none"
        >
          <path 
            d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z" 
            className="fill-terracotta"
          ></path>
        </svg>
      </div>
      <div className="container">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-5xl mb-6 block">✨</span>
          
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
            Nuestra Historia
          </h2>
          
          <p className="text-lg text-white/80 mb-8 leading-relaxed">
            El Taco Árabe nació de la fusión cultural entre los inmigrantes libaneses y la rica 
            tradición culinaria mexicana. En 1933, en las calles de Puebla, se creó esta deliciosa 
            combinación: carne de cerdo adobada con especias del Medio Oriente, servida en pan árabe 
            y acompañada de los sabores que solo México puede ofrecer.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <span className="text-4xl block mb-4">🏆</span>
              <h3 className="font-display text-xl font-bold text-white mb-2">Tradición</h3>
              <p className="text-white/70 text-sm">
                Más de 90 años de historia y sabor auténtico
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <span className="text-4xl block mb-4">🌿</span>
              <h3 className="font-display text-xl font-bold text-white mb-2">Ingredientes</h3>
              <p className="text-white/70 text-sm">
                Productos frescos y de la más alta calidad
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <span className="text-4xl block mb-4">❤️</span>
              <h3 className="font-display text-xl font-bold text-white mb-2">Pasión</h3>
              <p className="text-white/70 text-sm">
                Cada taco preparado con amor y dedicación
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
