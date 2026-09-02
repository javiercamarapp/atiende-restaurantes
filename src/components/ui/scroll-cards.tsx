import { FC } from "react";
import { motion } from "framer-motion";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

// Types
interface iCardItem {
  title: string;
  description: string;
  tag: string;
  src: string;
  link: string;
  color: string;
  textColor: string;
}
interface iCardProps extends Omit<iCardItem, "link" | "tag"> {
  i: number;
}

// Components
const Card: FC<iCardProps> = ({
  title,
  description,
  color,
  textColor,
  i,
  src
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 60 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: false, amount: 0.3 }}
      transition={{ 
        duration: 0.8, 
        delay: i * 0.15,
        ease: [0.25, 0.1, 0.25, 1]
      }}
      className="flex items-center justify-center px-2"
    >
      <div className="relative flex flex-col h-[300px] w-full max-w-[700px] py-12 px-10 md:px-12
        md:h-[400px] items-center justify-center mx-auto 
        shadow-md rounded-2xl overflow-hidden" style={{
        backgroundColor: color
      }}>
        <span className="font-bold relative text-5xl md:text-7xl mt-5 z-10"></span>
        
        <div className="absolute inset-0 z-0">
          <img className="w-full h-full object-contain" src={src} alt={title} />
        </div>
      </div>
    </motion.div>
  );
};

/**
 * CardSlide component displays a series of cards in a carousel layout
 */
interface iCardSlideProps {
  items: iCardItem[];
}
const CardsParallax: FC<iCardSlideProps> = ({
  items
}) => {
  return <div className="pb-8 px-4 md:px-12">
      <Carousel opts={{
      align: "center",
      loop: true
    }} plugins={[Autoplay({
      delay: 3000
    })]} className="w-full">
        <CarouselContent className="-ml-2 md:-ml-4">
          {items.map((project, i) => <CarouselItem key={`p_${i}`} className="pl-2 md:pl-4 md:basis-1/2 lg:basis-1/2">
              <Card {...project} i={i} />
            </CarouselItem>)}
        </CarouselContent>
      </Carousel>
    </div>;
};
export { CardsParallax, type iCardItem };