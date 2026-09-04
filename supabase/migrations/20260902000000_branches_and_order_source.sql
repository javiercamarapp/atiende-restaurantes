-- Branches (sucursales) as real data instead of hardcoded JSX
CREATE TABLE public.branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL DEFAULT 'be3fbdeb-80e7-4e7b-9b44-22b476c08298'
    REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  lat NUMERIC(9,6),
  lng NUMERIC(9,6),
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.branches
  ADD CONSTRAINT branches_restaurant_slug_key UNIQUE (restaurant_id, slug);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Branches are viewable by everyone"
ON public.branches FOR SELECT
USING (true);

CREATE POLICY "Admins can insert branches"
ON public.branches FOR INSERT TO authenticated
WITH CHECK (public.is_restaurant_staff(auth.uid(), restaurant_id) OR public.is_superadmin(auth.uid()));

CREATE POLICY "Admins can update branches"
ON public.branches FOR UPDATE TO authenticated
USING (public.is_restaurant_staff(auth.uid(), restaurant_id) OR public.is_superadmin(auth.uid()))
WITH CHECK (public.is_restaurant_staff(auth.uid(), restaurant_id) OR public.is_superadmin(auth.uid()));

CREATE POLICY "Admins can delete branches"
ON public.branches FOR DELETE TO authenticated
USING (public.is_restaurant_staff(auth.uid(), restaurant_id) OR public.is_superadmin(auth.uid()));

CREATE TRIGGER update_branches_updated_at
BEFORE UPDATE ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with the real 7 branches: phone + coords were already hardcoded in
-- src/components/Header.tsx's `sucursales` array; addresses and the corrected/
-- confirmed phone numbers come straight from https://www.lostaquitosdepm.com/contacto
-- (scraped 2026-09-02). Chicxulub is not listed on that /contacto page at all —
-- its phone below is carried over from Header.tsx only and should be confirmed
-- with the restaurant before the voice agent quotes it.
INSERT INTO public.branches (name, slug, phone, address, lat, lng, display_order) VALUES
  ('Altabrisa',        'altabrisa',      '999 518 2857',
    'C. 4 279, Vista Alegre Nte., dentro de la Plaza Victory Altabrisa', 21.0156, -89.5982, 1),
  ('García Lavín',      'garcia-lavin',   '999 518 2637',
    'Av. 32 Andrés García Lavín, San Ramón Norte', 21.0205, -89.6150, 2),
  ('Prol. Montejo',     'prol-montejo',   '999 944 0342',
    'Calle 34 No. 382-C x 35 y 37, Col. Emiliano Zapata Norte', 21.0280, -89.6100, 3),
  ('Fco. de Montejo',   'fco-montejo',    '999 953 7122',
    'Calle 50 esquina x 53-B, Fracc. Francisco de Montejo', 21.0350, -89.6050, 4),
  ('Galerías',          'galerias',       '999 941 9612',
    'Calle 60 No. 299-A, Carretera Mérida-Progreso Km 0.5, Col. Revolución Cordemex — Plaza Galerías Mérida (food court, planta alta)', 21.0400, -89.5900, 5),
  ('Chicxulub',         'chicxulub',      '968 688 4195',
    NULL, 21.2960, -89.6020, 6),
  ('Pensiones',         'pensiones',      '999 987 5410',
    'Calle 52 No. 37 por Av. 7, Residencial Pensiones, cerca de Plaza Las Américas', 20.9800, -89.6300, 7);

ALTER TABLE public.branches ALTER COLUMN restaurant_id DROP DEFAULT;

-- orders: link to a real branch, and record where the order came from
ALTER TABLE public.orders
  ADD COLUMN branch_id UUID REFERENCES public.branches(id),
  ADD COLUMN source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'voice', 'whatsapp', 'admin')),
  ADD COLUMN call_transcript TEXT,
  ADD COLUMN call_recording_url TEXT;

-- Standardize on the status vocabulary already used by the admin/repartidor panels
ALTER TABLE public.orders
  ALTER COLUMN status SET DEFAULT 'pending';

COMMENT ON COLUMN public.orders.status IS
  'pending -> preparando -> en_camino -> entregado (also: cancelado)';

-- Lets the customer-facing tracker poll an order's status by id without exposing
-- the whole `orders` table (which has no public SELECT policy on purpose, since it
-- holds customer PII). Order ids are random UUIDs, so knowing one is equivalent to
-- having the tracking link — same trust model as a guest order-tracking link on any
-- e-commerce site.
CREATE FUNCTION public.get_order_status(_order_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT status FROM public.orders WHERE id = _order_id
$$;

GRANT EXECUTE ON FUNCTION public.get_order_status(UUID) TO anon, authenticated;
