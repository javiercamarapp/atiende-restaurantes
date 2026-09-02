-- Add unique constraint on user_id for upsert to work
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);