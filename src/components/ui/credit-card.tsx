"use client"

import * as React from "react"
import { motion, useMotionValue, useTransform } from "framer-motion"
import { Eye, EyeOff, Wifi } from "lucide-react"
import { cn } from "@/lib/utils"
import logoVisa from '@/assets/logo-visa.png';
import logoMastercard from '@/assets/logo-mastercard.png';
import logoAmex from '@/assets/logo-amex.png';

const PERSPECTIVE = 1000
const CARD_ANIMATION_DURATION = 0.6
const INITIAL_DELAY = 0.2

interface CreditCardProps extends React.HTMLAttributes<HTMLDivElement> {
  cardNumber?: string
  cardHolder?: string
  expiryDate?: string
  cvv?: string
  cardBrand?: 'visa' | 'mastercard' | 'amex' | 'unknown'
  variant?: "gradient" | "dark" | "glass" | "visa" | "mastercard" | "amex"
  compact?: boolean
  onDelete?: () => void
}

export default function CreditCard({
  cardNumber = "•••• •••• •••• ••••",
  cardHolder = "NOMBRE",
  expiryDate = "MM/YY",
  cvv = "•••",
  cardBrand = "unknown",
  variant = "gradient",
  compact = false,
  className,
}: CreditCardProps) {
  const [isVisible, setIsVisible] = React.useState(false)
  const [isFlipped, setIsFlipped] = React.useState(false)
  const [isClicked, setIsClicked] = React.useState(false)
  
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotateX = useTransform(y, [-100, 100], [10, -10])
  const rotateY = useTransform(x, [-100, 100], [-10, 10])

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (compact) return
    const rect = event.currentTarget.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    x.set(event.clientX - centerX)
    y.set(event.clientY - centerY)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  const getMaskedNumber = (number: string) => {
    const cleaned = number.replace(/\s/g, '')
    const lastFour = cleaned.slice(-4)
    return `•••• •••• •••• ${lastFour}`
  }

  const getCardBrandLogo = () => {
    switch (cardBrand) {
      case 'visa':
        return <img src={logoVisa} alt="Visa" className="h-6 object-contain" />
      case 'mastercard':
        return <img src={logoMastercard} alt="Mastercard" className="h-8 object-contain" />
      case 'amex':
        return <img src={logoAmex} alt="American Express" className="h-6 object-contain" />
      default:
        return <span className="text-xl font-bold italic text-white/70">CARD</span>
    }
  }

  const variantStyles: Record<string, string> = {
    gradient: "bg-gradient-to-br from-violet-600 via-purple-600 to-pink-600",
    dark: "bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900",
    glass: "bg-white/15 dark:bg-white/10 backdrop-blur-xl border border-white/20",
    visa: "bg-gradient-to-br from-blue-700 via-blue-600 to-blue-800",
    mastercard: "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900",
    amex: "bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500",
  }

  const actualVariant = variant === "gradient" ? (cardBrand !== "unknown" ? cardBrand : "gradient") : variant

  if (compact) {
    return (
      <motion.div
        className={cn(
          "rounded-xl p-3 flex items-center gap-3 shadow-lg cursor-pointer",
          variantStyles[actualVariant],
          className
        )}
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="w-10 h-7 bg-white rounded flex items-center justify-center p-1 shrink-0">
          {cardBrand === 'visa' && <img src={logoVisa} alt="Visa" className="w-full h-full object-contain" />}
          {cardBrand === 'mastercard' && <img src={logoMastercard} alt="Mastercard" className="w-full h-full object-contain" />}
          {cardBrand === 'amex' && <img src={logoAmex} alt="Amex" className="w-full h-full object-contain" />}
        </div>
        <span className="text-white font-medium text-sm tracking-wider flex-1">
          {getMaskedNumber(cardNumber)}
        </span>
      </motion.div>
    )
  }

  return (
    <motion.div
      className={cn("relative w-full aspect-[1.6/1]", className)}
      style={{ perspective: PERSPECTIVE }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: CARD_ANIMATION_DURATION }}
    >
      <motion.div
        className="relative w-full h-full cursor-pointer"
        style={{ 
          transformStyle: "preserve-3d",
          rotateX: compact ? 0 : rotateX,
          rotateY: isFlipped ? 180 : (compact ? 0 : rotateY),
        }}
        animate={{ 
          scale: isClicked ? 0.95 : 1,
        }}
        transition={{ duration: 0.6, type: "spring", stiffness: 100, damping: 20 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={() => {
          setIsClicked(true)
          setTimeout(() => setIsClicked(false), 200)
          setTimeout(() => setIsFlipped(!isFlipped), 100)
        }}
      >
        {/* Front of card */}
        <motion.div
          className={cn(
            "absolute inset-0 rounded-2xl p-5 shadow-2xl",
            variantStyles[actualVariant],
            "backface-hidden"
          )}
          style={{ 
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden"
          }}
        >
          {/* Card shimmer effect */}
          <div className="absolute inset-0 rounded-2xl overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0"
              animate={{
                x: ["-100%", "100%"],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                repeatDelay: 3,
                ease: "linear",
              }}
            />
          </div>

          {/* Card content */}
          <div className="relative h-full flex flex-col justify-between text-white">
            {/* Top section */}
            <div className="flex justify-between items-start">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: INITIAL_DELAY }}
                className="flex items-center gap-3"
              >
                <div className="w-10 h-7 rounded bg-gradient-to-br from-amber-400 to-yellow-600 shadow-inner" />
                <Wifi className="w-5 h-5 rotate-90 text-white/70" />
              </motion.div>

              <motion.button
                className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ 
                  delay: 0.4,
                  type: "spring",
                  stiffness: 200,
                  damping: 15
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setIsVisible(!isVisible)
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </motion.button>
            </div>

            {/* Card number */}
            <motion.div
              className="text-lg font-mono tracking-wider"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {isVisible ? cardNumber : getMaskedNumber(cardNumber)}
            </motion.div>

            {/* Bottom section */}
            <div className="flex justify-between items-end">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="text-[10px] opacity-70 mb-0.5">TITULAR</div>
                <div className="font-medium text-xs tracking-wide uppercase">{cardHolder}</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <div className="text-[10px] opacity-70 mb-0.5">EXPIRA</div>
                <div className="font-medium text-xs">{isVisible ? expiryDate : "••/••"}</div>
              </motion.div>

              <motion.div
                className="bg-white rounded px-2 py-1"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ 
                  delay: 0.6,
                  type: "spring",
                  stiffness: 200
                }}
              >
                {getCardBrandLogo()}
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Back of card */}
        <motion.div
          className={cn(
            "absolute inset-0 rounded-2xl shadow-2xl",
            variantStyles[actualVariant],
            "backface-hidden"
          )}
          style={{ 
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)"
          }}
        >
          {/* Magnetic strip */}
          <div className="absolute top-6 left-0 right-0 h-10 bg-black/80" />
          
          {/* Signature panel */}
          <div className="absolute top-20 left-4 right-4 bg-white/90 h-8 rounded flex items-center justify-end px-3">
            <motion.div 
              className="text-black font-mono font-bold text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {isVisible ? cvv : "•••"}
            </motion.div>
          </div>

          {/* Card info */}
          <div className="absolute bottom-4 left-4 right-4 text-white text-[10px] space-y-1 opacity-70">
            <p>Esta tarjeta es propiedad del banco emisor</p>
            <p>Servicio al cliente: 1-800-CARD</p>
          </div>
          
          {/* Brand logo on back */}
          <div className="absolute bottom-4 right-4 bg-white rounded px-2 py-1">
            {getCardBrandLogo()}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
