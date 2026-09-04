-- Conversation state for the WhatsApp order-taking agent. Unlike a phone call
-- (which ElevenLabs keeps "live" for the duration), WhatsApp messages arrive one
-- at a time via webhook, so we need to persist the running message history per
-- phone number between requests.
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  branch_id UUID REFERENCES public.branches(id),
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  order_id UUID REFERENCES public.orders(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, phone)
);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

-- No public policies on purpose: this table is only ever read/written by the
-- whatsapp-webhook Edge Function using the service role key (bypasses RLS).
-- Admins can look at conversations for support/debugging.
CREATE POLICY "Admins can view whatsapp conversations"
ON public.whatsapp_conversations FOR SELECT TO authenticated
USING (public.is_restaurant_staff(auth.uid(), restaurant_id) OR public.is_superadmin(auth.uid()));

CREATE TRIGGER update_whatsapp_conversations_updated_at
BEFORE UPDATE ON public.whatsapp_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.whatsapp_append_turn(
  p_restaurant_id UUID,
  p_phone TEXT,
  p_new_messages JSONB,
  p_status TEXT DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_messages JSONB;
BEGIN
  IF p_phone IS NULL OR btrim(p_phone) = '' OR jsonb_typeof(p_new_messages) <> 'array' THEN
    RAISE EXCEPTION 'invalid whatsapp turn';
  END IF;

  INSERT INTO public.whatsapp_conversations (
    restaurant_id, phone, messages, status, order_id, branch_id
  )
  VALUES (
    p_restaurant_id,
    p_phone,
    p_new_messages,
    COALESCE(p_status, 'active'),
    p_order_id,
    p_branch_id
  )
  ON CONFLICT (restaurant_id, phone) DO UPDATE
  SET messages = whatsapp_conversations.messages || EXCLUDED.messages,
      status = COALESCE(p_status, whatsapp_conversations.status),
      order_id = COALESCE(p_order_id, whatsapp_conversations.order_id),
      branch_id = COALESCE(p_branch_id, whatsapp_conversations.branch_id),
      updated_at = now()
  RETURNING messages INTO v_messages;

  RETURN v_messages;
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_append_turn(UUID, TEXT, JSONB, TEXT, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_append_turn(UUID, TEXT, JSONB, TEXT, UUID, UUID)
  TO service_role;
