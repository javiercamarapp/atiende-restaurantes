-- Switches independientes por sucursal para activar/desactivar cada canal
-- de agente de IA (voz vía ElevenLabs, WhatsApp) sin afectar al otro.
-- Ya aplicada en vivo contra el proyecto okvxavwijqacomgtyyou; este archivo
-- deja la migración versionada en el repo.
alter table public.branches
  add column if not exists voice_agent_active boolean not null default true,
  add column if not exists whatsapp_agent_active boolean not null default true;

comment on column public.branches.voice_agent_active is 'Si el agente de voz de ElevenLabs debe atender llamadas de esta sucursal.';
comment on column public.branches.whatsapp_agent_active is 'Si el agente de WhatsApp debe atender mensajes de esta sucursal.';
