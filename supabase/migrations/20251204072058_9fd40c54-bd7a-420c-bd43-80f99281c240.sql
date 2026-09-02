-- Add nombre and telefono columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS nombre TEXT,
ADD COLUMN IF NOT EXISTS telefono TEXT;

-- Update the trigger function to save nombre and telefono from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, nombre, telefono)
  VALUES (
    NEW.id, 
    NEW.email,
    NEW.raw_user_meta_data ->> 'nombre',
    NEW.raw_user_meta_data ->> 'telefono'
  );
  RETURN NEW;
END;
$$;