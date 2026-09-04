-- Customer memory: lets both the voice agent and the WhatsApp agent recognize
-- a returning caller/chatter by phone number, greet them by name, offer their
-- saved address, and reference what they ordered last time. This is real
-- persistent memory (a CRM record), not model retraining — see the note in
-- docs/agente-voz/system-prompt.md about what "aprende y mejora" means here.

CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  order_count INTEGER NOT NULL DEFAULT 0,
  last_order_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, phone)
);

CREATE TABLE public.customer_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  label TEXT,
  address TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (customer_id, address)
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

-- PII (phone, address) — no public policies on purpose. Only the Edge Functions
-- (service role, bypasses RLS) and admins can read this.
CREATE POLICY "Admins can view customers" ON public.customers
  FOR SELECT TO authenticated USING (
    public.is_restaurant_staff(auth.uid(), restaurant_id) OR public.is_superadmin(auth.uid())
  );
CREATE POLICY "Admins can view customer addresses" ON public.customer_addresses
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_addresses.customer_id
        AND (public.is_restaurant_staff(auth.uid(), c.restaurant_id) OR public.is_superadmin(auth.uid()))
    )
  );

CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link orders to the customer record that placed them.
ALTER TABLE public.orders ADD COLUMN customer_id UUID REFERENCES public.customers(id);
