-- Add 'repartidor' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'repartidor';

-- Create trigger function to assign repartidor role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if user signed up as repartidor
  IF (NEW.raw_user_meta_data ->> 'isRepartidor')::boolean = true THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'repartidor')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    -- Assign default 'user' role for regular customers
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger for role assignment (runs after admin check)
DROP TRIGGER IF EXISTS on_auth_user_role_assignment ON auth.users;
CREATE TRIGGER on_auth_user_role_assignment
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();