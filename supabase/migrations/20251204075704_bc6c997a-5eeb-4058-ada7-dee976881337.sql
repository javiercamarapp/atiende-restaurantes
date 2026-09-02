-- Create payment methods table
CREATE TABLE public.payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('card', 'paypal', 'mercado_pago')),
  card_brand TEXT, -- visa, mastercard, amex
  card_last_four TEXT,
  card_holder_name TEXT,
  card_expiry TEXT,
  paypal_email TEXT,
  mercado_pago_email TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- Users can view their own payment methods
CREATE POLICY "Users can view own payment methods"
ON public.payment_methods
FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own payment methods
CREATE POLICY "Users can insert own payment methods"
ON public.payment_methods
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own payment methods
CREATE POLICY "Users can update own payment methods"
ON public.payment_methods
FOR UPDATE
USING (user_id = auth.uid());

-- Users can delete their own payment methods
CREATE POLICY "Users can delete own payment methods"
ON public.payment_methods
FOR DELETE
USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_payment_methods_updated_at
BEFORE UPDATE ON public.payment_methods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();