-- Alta de repartidores desde el admin (ModalRepartidor.tsx + Edge Function
-- crear-repartidor): hoy "profiles"/"user_roles" solo traen campos genéricos
-- de cualquier usuario (nombre, teléfono, email) — un repartidor real
-- necesita datos operativos propios (vehículo, licencia, contacto de
-- emergencia, fecha de nacimiento para validar mayoría de edad). Se separan
-- en su propia tabla, 1:1 con auth.users, en vez de ensuciar "profiles"
-- (que también usan clientes/admins sin ninguno de estos campos).

CREATE TABLE public.repartidor_perfil (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo text NOT NULL,
  telefono text NOT NULL,
  correo text NOT NULL,
  fecha_nacimiento date NOT NULL
    CHECK (fecha_nacimiento <= (CURRENT_DATE - INTERVAL '18 years')),
  tipo_vehiculo text NOT NULL CHECK (tipo_vehiculo IN ('moto', 'bicicleta', 'auto')),
  placas text,
  numero_licencia text,
  direccion text NOT NULL,
  contacto_emergencia_nombre text NOT NULL,
  contacto_emergencia_telefono text NOT NULL,
  fecha_alta timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.repartidor_perfil ENABLE ROW LEVEL SECURITY;

-- Los admins administran el alta completa (el INSERT real lo hace la Edge
-- Function crear-repartidor con service role, que ignora RLS, pero se
-- declaran las políticas igual para que el admin pueda leer/editar después
-- desde el navegador, mismo patrón que "Admins can insert customers" en
-- 20251204073618).
CREATE POLICY "Admins can view repartidor profiles"
  ON public.repartidor_perfil FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert repartidor profiles"
  ON public.repartidor_perfil FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update repartidor profiles"
  ON public.repartidor_perfil FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Un repartidor puede ver su propio perfil operativo (útil a futuro para
-- una pantalla "Mi perfil" en el panel de repartidor).
CREATE POLICY "Repartidores can view their own profile"
  ON public.repartidor_perfil FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_repartidor_perfil
  BEFORE UPDATE ON public.repartidor_perfil
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
