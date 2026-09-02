-- Conversation state for the WhatsApp order-taking agent. Unlike a phone call
-- (which ElevenLabs keeps "live" for the duration), WhatsApp messages arrive one
-- at a time via webhook, so we need to persist the running message history per
-- phone number between requests.
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  branch_id UUID REFERENCES public.branches(id),
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  order_id UUID REFERENCES public.orders(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

-- No public policies on purpose: this table is only ever read/written by the
-- whatsapp-webhook Edge Function using the service role key (bypasses RLS).
-- Admins can look at conversations for support/debugging.
CREATE POLICY "Admins can view whatsapp conversations"
ON public.whatsapp_conversations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_whatsapp_conversations_updated_at
BEFORE UPDATE ON public.whatsapp_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
