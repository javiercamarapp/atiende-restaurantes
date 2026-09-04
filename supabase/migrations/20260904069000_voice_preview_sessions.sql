-- El widget interno usa el mismo agente que las llamadas públicas. Marcar la
-- conversación desde una sesión admin permite simular crear_pedido sin
-- depender de variables dinámicas obligatorias (que impiden iniciar llamadas
-- públicas) ni de un booleano elegido por el LLM.
create table if not exists public.voice_preview_sessions (
  conversation_id text primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  agent_id text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  constraint voice_preview_conversation_id_not_blank
    check (length(btrim(conversation_id)) between 10 and 200),
  constraint voice_preview_agent_id_not_blank
    check (length(btrim(agent_id)) between 10 and 200),
  constraint voice_preview_expiry_after_creation check (expires_at > created_at)
);

create index if not exists voice_preview_sessions_expiry_idx
  on public.voice_preview_sessions (expires_at);

alter table public.voice_preview_sessions enable row level security;
revoke all on public.voice_preview_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.voice_preview_sessions to service_role;
