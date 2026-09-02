import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Plus, CreditCard, Trash2, Loader2, DollarSign, Check, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { User } from '@supabase/supabase-js';
import logoVisa from '@/assets/logo-visa.png';
import logoMastercard from '@/assets/logo-mastercard.png';
import logoAmex from '@/assets/logo-amex.png';

type PaymentMethod = {
  id: string;
  type: 'card';
  card_brand?: string;
  card_last_four?: string;
  card_holder_name?: string;
  card_expiry?: string;
  is_default: boolean;
};

type View = 'list' | 'add-card';

interface PaymentMethodsSheetProps {
  user: User | null;
  trigger: React.ReactNode;
}

const PaymentMethodsSheet = ({ user, trigger }: PaymentMethodsSheetProps) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('list');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Card form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchPaymentMethods(user.id);
    }
  }, [open, user]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setView('list');
      resetForm();
    }
  };

  const fetchPaymentMethods = async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'card')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPaymentMethods(data as PaymentMethod[]);
    }
    setLoading(false);
  };

  const detectCardBrand = (number: string): string => {
    const cleaned = number.replace(/\s/g, '');
    if (/^4/.test(cleaned)) return 'visa';
    if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) return 'mastercard';
    if (/^3[47]/.test(cleaned)) return 'amex';
    return 'unknown';
  };

  // Luhn algorithm to validate card numbers
  const isValidLuhn = (number: string): boolean => {
    const cleaned = number.replace(/\s/g, '');
    if (!/^\d+$/.test(cleaned)) return false;
    
    let sum = 0;
    let isEven = false;
    
    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned[i], 10);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  };

  const validateCardNumber = (number: string): { valid: boolean; error?: string } => {
    const cleaned = number.replace(/\s/g, '');
    const brand = detectCardBrand(cleaned);
    
    // Check minimum length
    if (cleaned.length < 13) {
      return { valid: false, error: 'Número de tarjeta muy corto' };
    }
    
    // Check length based on brand
    if (brand === 'amex' && cleaned.length !== 15) {
      return { valid: false, error: 'American Express debe tener 15 dígitos' };
    }
    if ((brand === 'visa' || brand === 'mastercard') && cleaned.length !== 16) {
      return { valid: false, error: 'Visa/Mastercard debe tener 16 dígitos' };
    }
    if (brand === 'unknown') {
      return { valid: false, error: 'Tipo de tarjeta no soportado' };
    }
    
    // Luhn validation
    if (!isValidLuhn(cleaned)) {
      return { valid: false, error: 'Número de tarjeta inválido' };
    }
    
    return { valid: true };
  };

  const currentBrand = detectCardBrand(cardNumber);

  // Real-time validation status
  const cardNumberValidation = useMemo(() => {
    const cleaned = cardNumber.replace(/\s/g, '');
    if (cleaned.length === 0) return { status: 'empty' as const };
    if (cleaned.length < 13) return { status: 'typing' as const };
    return validateCardNumber(cleaned).valid 
      ? { status: 'valid' as const } 
      : { status: 'invalid' as const, error: validateCardNumber(cleaned).error };
  }, [cardNumber]);

  const expiryValidation = useMemo(() => {
    if (cardExpiry.length === 0) return { status: 'empty' as const };
    if (cardExpiry.length < 5) return { status: 'typing' as const };
    const [month, year] = cardExpiry.split('/');
    const monthNum = parseInt(month);
    if (monthNum < 1 || monthNum > 12) return { status: 'invalid' as const };
    const expiryDate = new Date(2000 + parseInt(year), monthNum - 1);
    return expiryDate >= new Date() 
      ? { status: 'valid' as const } 
      : { status: 'invalid' as const };
  }, [cardExpiry]);

  const cvvValidation = useMemo(() => {
    if (cardCvv.length === 0) return { status: 'empty' as const };
    const requiredLength = currentBrand === 'amex' ? 4 : 3;
    if (cardCvv.length < requiredLength) return { status: 'typing' as const };
    return { status: 'valid' as const };
  }, [cardCvv, currentBrand]);

  const getBrandDisplayName = (brand: string): string => {
    switch (brand) {
      case 'visa': return 'VISA';
      case 'mastercard': return 'Mastercard';
      case 'amex': return 'American Express';
      default: return '';
    }
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const groups = cleaned.match(/.{1,4}/g) || [];
    return groups.join(' ').substr(0, 19);
  };

  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.substr(0, 2) + '/' + cleaned.substr(2, 2);
    }
    return cleaned;
  };

  const handleSaveCard = async () => {
    if (!user) return;
    const cleanedNumber = cardNumber.replace(/\s/g, '');
    
    // Validate card number with Luhn algorithm
    const cardValidation = validateCardNumber(cleanedNumber);
    if (!cardValidation.valid) {
      toast.error(cardValidation.error || 'Número de tarjeta inválido');
      return;
    }
    
    if (!cardHolder.trim()) {
      toast.error('Ingresa el nombre del titular');
      return;
    }
    if (cardExpiry.length < 5) {
      toast.error('Fecha de expiración inválida');
      return;
    }
    
    // Validate expiry date is in the future
    const [month, year] = cardExpiry.split('/');
    const expiryDate = new Date(2000 + parseInt(year), parseInt(month) - 1);
    if (expiryDate < new Date()) {
      toast.error('La tarjeta está expirada');
      return;
    }
    
    const brand = detectCardBrand(cleanedNumber);
    const cvvLength = brand === 'amex' ? 4 : 3;
    if (cardCvv.length < cvvLength) {
      toast.error(`CVV debe tener ${cvvLength} dígitos`);
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('payment_methods').insert({
      user_id: user.id,
      type: 'card',
      card_brand: detectCardBrand(cleanedNumber),
      card_last_four: cleanedNumber.slice(-4),
      card_holder_name: cardHolder,
      card_expiry: cardExpiry,
      is_default: paymentMethods.length === 0,
    });

    if (error) {
      toast.error('No se pudo guardar la tarjeta');
    } else {
      toast.success('Tarjeta guardada');
      resetForm();
      fetchPaymentMethods(user.id);
      setView('list');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from('payment_methods').delete().eq('id', id);
    if (!error) {
      toast.success('Tarjeta eliminada');
      fetchPaymentMethods(user.id);
    }
  };

  const resetForm = () => {
    setCardNumber('');
    setCardHolder('');
    setCardExpiry('');
    setCardCvv('');
    setIsFlipped(false);
  };

  const getCardBrandIcon = (brand?: string) => {
    switch (brand) {
      case 'visa':
        return (
          <div className="w-12 h-8 bg-white rounded flex items-center justify-center p-1">
            <img src={logoVisa} alt="Visa" className="w-full h-full object-contain" />
          </div>
        );
      case 'mastercard':
        return (
          <div className="w-12 h-8 bg-white rounded flex items-center justify-center p-1">
            <img src={logoMastercard} alt="Mastercard" className="w-full h-full object-contain" />
          </div>
        );
      case 'amex':
        return (
          <div className="w-12 h-8 bg-white rounded flex items-center justify-center p-1">
            <img src={logoAmex} alt="American Express" className="w-full h-full object-contain" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
        );
    }
  };

  const getCardBrandLogoForPreview = (brand: string) => {
    switch (brand) {
      case 'visa':
        return <img src={logoVisa} alt="Visa" className="h-6 object-contain" />;
      case 'mastercard':
        return <img src={logoMastercard} alt="Mastercard" className="h-6 object-contain" />;
      case 'amex':
        return <img src={logoAmex} alt="American Express" className="h-6 object-contain" />;
      default:
        return null;
    }
  };

  const getCardBackground = (brand?: string) => {
    switch (brand) {
      case 'visa':
        return 'bg-gradient-to-r from-blue-800 to-blue-600';
      case 'mastercard':
        return 'bg-gradient-to-r from-gray-900 to-gray-700';
      case 'amex':
        return 'bg-gradient-to-r from-blue-700 to-blue-500';
      default:
        return 'bg-gradient-to-r from-gray-700 to-gray-500';
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" hideCloseButton className="w-80 bg-primary border-l border-primary-foreground/10 p-0 rounded-l-3xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-primary-foreground/10 flex items-center justify-between">
            {view !== 'list' ? (
              <button onClick={() => setView('list')} className="text-primary-foreground">
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <button onClick={() => setOpen(false)} className="text-primary-foreground">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-lg font-bold text-primary-foreground">
              {view === 'list' ? 'Métodos de pago' : 'Agregar tarjeta'}
            </h2>
            {view === 'list' ? (
              <button
                onClick={() => setView('add-card')}
                className="w-8 h-8 rounded-full bg-terracotta flex items-center justify-center"
              >
                <Plus className="w-4 h-4 text-white" />
              </button>
            ) : (
              <div className="w-8" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary-foreground" />
              </div>
            ) : (
              <>
                {/* List View */}
                {view === 'list' && (
                  <div className="space-y-4">
                    {/* Wallet with cards */}
                    <div className="relative h-[280px]">
                      {/* Wallet/Card Holder - BEHIND the cards */}
                      <div 
                        className="absolute left-0 right-0 top-0 bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl shadow-xl overflow-hidden h-[220px]"
                        style={{ zIndex: 0 }}
                      >
                        {/* Wallet texture - leather effect */}
                        <div className="absolute inset-0 opacity-30" style={{
                          backgroundImage: `repeating-linear-gradient(
                            0deg,
                            transparent,
                            transparent 3px,
                            rgba(255,255,255,0.02) 3px,
                            rgba(255,255,255,0.02) 6px
                          )`
                        }} />
                        {/* Wallet stitching line at top */}
                        <div className="absolute top-3 inset-x-4 h-px bg-gray-600/50 rounded-full"></div>
                        <div className="absolute top-4 inset-x-4 h-px bg-gray-700/30 rounded-full"></div>
                        
                        {/* Wallet brand text */}
                        <div className="absolute bottom-4 right-4 text-gray-600/40 text-xs font-medium tracking-widest">
                          WALLET
                        </div>
                      </div>

                      {/* Payment method cards - stacked like a card holder */}
                      {paymentMethods.length === 0 ? (
                        <div className="absolute inset-x-4 top-4 text-center py-8">
                          <CreditCard className="w-10 h-10 mx-auto text-gray-600 mb-2" />
                          <p className="text-gray-500 text-sm">No tienes tarjetas</p>
                        </div>
                      ) : (
                        paymentMethods.map((method, index) => (
                          <motion.div
                            key={method.id}
                            className={`absolute left-4 right-4 rounded-xl p-3 flex items-center gap-3 shadow-xl cursor-pointer ${getCardBackground(method.card_brand)}`}
                            style={{ 
                              top: `${8 + (paymentMethods.length - 1 - index) * 18}px`,
                              zIndex: paymentMethods.length - index
                            }}
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            whileHover={{ 
                              y: -25, 
                              scale: 1.02,
                              zIndex: 100,
                              transition: { duration: 0.2 }
                            }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSelectedCardId(selectedCardId === method.id ? null : method.id)}
                          >
                            {/* Card chip effect */}
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-4 rounded-sm bg-gradient-to-br from-amber-300 to-yellow-500 opacity-80" />
                            
                            <div className="w-10 h-7 bg-white rounded flex items-center justify-center p-1 shrink-0 ml-8 shadow-sm">
                              {method.card_brand === 'visa' && <img src={logoVisa} alt="Visa" className="w-full h-full object-contain" />}
                              {method.card_brand === 'mastercard' && <img src={logoMastercard} alt="Mastercard" className="w-full h-full object-contain" />}
                              {method.card_brand === 'amex' && <img src={logoAmex} alt="Amex" className="w-full h-full object-contain" />}
                              {!method.card_brand && <CreditCard className="w-4 h-4 text-gray-600" />}
                            </div>
                            <span className="text-white font-mono text-sm tracking-wider flex-1">
                              •••• •••• •••• {method.card_last_four}
                            </span>
                          </motion.div>
                        ))
                      )}
                    </div>

                    {/* Cash option - separate below wallet */}
                    <motion.div 
                      className="rounded-2xl p-4 bg-gradient-to-br from-emerald-400 to-green-500 shadow-lg cursor-pointer"
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-10">
                        <DollarSign className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-white text-xl font-bold">Efectivo</span>
                    </motion.div>

                    {/* Selected card expanded view - below Efectivo */}
                    {selectedCardId && paymentMethods.find(m => m.id === selectedCardId) && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`rounded-2xl p-4 shadow-lg ${getCardBackground(paymentMethods.find(m => m.id === selectedCardId)?.card_brand)}`}
                      >
                        <div className="flex items-center gap-3 mb-10">
                          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="w-10 h-7 bg-white rounded flex items-center justify-center p-1">
                              {paymentMethods.find(m => m.id === selectedCardId)?.card_brand === 'visa' && <img src={logoVisa} alt="Visa" className="w-full h-full object-contain" />}
                              {paymentMethods.find(m => m.id === selectedCardId)?.card_brand === 'mastercard' && <img src={logoMastercard} alt="Mastercard" className="w-full h-full object-contain" />}
                              {paymentMethods.find(m => m.id === selectedCardId)?.card_brand === 'amex' && <img src={logoAmex} alt="Amex" className="w-full h-full object-contain" />}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              handleDelete(selectedCardId);
                              setSelectedCardId(null);
                            }}
                            className="w-10 h-10 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center transition-colors"
                          >
                            <Trash2 className="w-5 h-5 text-white" />
                          </button>
                        </div>
                        <span className="text-white text-xl font-bold font-mono tracking-wider">
                          •••• •••• •••• {paymentMethods.find(m => m.id === selectedCardId)?.card_last_four}
                        </span>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Add Card View */}
                {view === 'add-card' && (
                  <>
                    <div className="mb-6 aspect-[1.6/1] [perspective:1000px]">
                      <div 
                        className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
                      >
                        {/* Front of card */}
                        <div className={`absolute inset-0 rounded-xl p-4 flex flex-col justify-between [backface-visibility:hidden] ${getCardBackground(currentBrand)}`}>
                          <div className="flex justify-between items-start">
                            <div className="w-8 h-6 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded"></div>
                            {currentBrand !== 'unknown' && (
                              <div className="bg-white rounded px-2 py-1">
                                {getCardBrandLogoForPreview(currentBrand)}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-white font-mono text-sm tracking-wider mb-1">
                              {cardNumber || 'XXXX XXXX XXXX XXXX'}
                            </p>
                            <div className="flex justify-between">
                              <p className="text-white/70 text-xs uppercase">
                                {cardHolder || 'NOMBRE'}
                              </p>
                              <p className="text-white/70 text-xs">{cardExpiry || 'MM/YY'}</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Back of card */}
                        <div className={`absolute inset-0 rounded-xl flex flex-col [backface-visibility:hidden] [transform:rotateY(180deg)] ${getCardBackground(currentBrand)}`}>
                          <div className="w-full h-10 bg-black/40 mt-4"></div>
                          <div className="flex-1 p-4 flex flex-col justify-center">
                            <div className="bg-white/90 h-8 rounded flex items-center justify-end pr-3">
                              <span className="font-mono text-gray-800 text-sm tracking-wider">
                                {cardCvv || 'CVV'}
                              </span>
                            </div>
                            <p className="text-white/60 text-xs mt-2 text-center">
                              Código de seguridad
                            </p>
                          </div>
                          {currentBrand !== 'unknown' && (
                            <div className="absolute bottom-3 right-3 bg-white rounded px-2 py-1">
                              {getCardBrandLogoForPreview(currentBrand)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label className="text-primary-foreground/60 text-xs flex items-center gap-2">
                          Número
                          {cardNumberValidation.status === 'valid' && (
                            <Check className="w-3 h-3 text-green-400" />
                          )}
                          {cardNumberValidation.status === 'invalid' && (
                            <AlertCircle className="w-3 h-3 text-red-400" />
                          )}
                        </Label>
                        <div className="relative">
                          <Input
                            value={cardNumber}
                            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                            placeholder="XXXX XXXX XXXX XXXX"
                            className={`border-0 border-b rounded-none bg-transparent text-primary-foreground placeholder:text-primary-foreground/40 focus-visible:ring-0 h-8 text-sm pr-8 ${
                              cardNumberValidation.status === 'valid' ? 'border-green-400' :
                              cardNumberValidation.status === 'invalid' ? 'border-red-400' :
                              'border-primary-foreground/20'
                            }`}
                            maxLength={19}
                          />
                          {cardNumberValidation.status === 'valid' && (
                            <Check className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
                          )}
                          {cardNumberValidation.status === 'invalid' && (
                            <AlertCircle className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                          )}
                        </div>
                        {cardNumberValidation.status === 'invalid' && 'error' in cardNumberValidation && (
                          <p className="text-red-400 text-xs mt-1">{cardNumberValidation.error}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-primary-foreground/60 text-xs">Nombre</Label>
                          <Input
                            value={cardHolder}
                            onChange={(e) => setCardHolder(e.target.value)}
                            placeholder="Nombre completo"
                            className="border-0 border-b border-primary-foreground/20 rounded-none bg-transparent text-primary-foreground placeholder:text-primary-foreground/40 focus-visible:ring-0 h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-primary-foreground/60 text-xs flex items-center gap-2">
                            Expira
                            {expiryValidation.status === 'valid' && (
                              <Check className="w-3 h-3 text-green-400" />
                            )}
                            {expiryValidation.status === 'invalid' && (
                              <AlertCircle className="w-3 h-3 text-red-400" />
                            )}
                          </Label>
                          <Input
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                            placeholder="MM/YY"
                            className={`border-0 border-b rounded-none bg-transparent text-primary-foreground placeholder:text-primary-foreground/40 focus-visible:ring-0 h-8 text-sm ${
                              expiryValidation.status === 'valid' ? 'border-green-400' :
                              expiryValidation.status === 'invalid' ? 'border-red-400' :
                              'border-primary-foreground/20'
                            }`}
                            maxLength={5}
                          />
                        </div>
                      </div>

                      <div className="w-1/2">
                        <Label className="text-primary-foreground/60 text-xs flex items-center gap-2">
                          CVV
                          {cvvValidation.status === 'valid' && (
                            <Check className="w-3 h-3 text-green-400" />
                          )}
                        </Label>
                        <Input
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          onFocus={() => setIsFlipped(true)}
                          onBlur={() => setIsFlipped(false)}
                          placeholder={currentBrand === 'amex' ? 'XXXX' : 'XXX'}
                          type="text"
                          className={`border-0 border-b rounded-none bg-transparent text-primary-foreground placeholder:text-primary-foreground/40 focus-visible:ring-0 h-8 text-sm ${
                            cvvValidation.status === 'valid' ? 'border-green-400' :
                            'border-primary-foreground/20'
                          }`}
                          maxLength={currentBrand === 'amex' ? 4 : 3}
                        />
                      </div>
                    </div>

                    <Button
                      onClick={handleSaveCard}
                      disabled={saving || cardNumberValidation.status !== 'valid' || !cardHolder.trim() || expiryValidation.status !== 'valid' || cvvValidation.status !== 'valid'}
                      variant="terracotta"
                      className="w-full mt-6"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Guardar tarjeta
                    </Button>

                    <p className="text-primary-foreground/40 text-xs text-center mt-4">
                      Solo guardamos los últimos 4 dígitos de tu tarjeta por seguridad
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PaymentMethodsSheet;
