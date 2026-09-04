-- 69000 ya pudo aplicarse con CASCADE y permisos UPDATE/DELETE. Corregir
-- explícitamente ese esquema: CREATE TABLE IF NOT EXISTS no lo actualiza.
alter table public.voice_preview_sessions
  drop constraint if exists voice_preview_sessions_created_by_fkey;
alter table public.voice_preview_sessions alter column created_by drop not null;
alter table public.voice_preview_sessions
  add constraint voice_preview_sessions_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.voice_preview_sessions
  drop constraint if exists voice_preview_conversation_id_not_blank;
alter table public.voice_preview_sessions
  add constraint voice_preview_conversation_id_not_blank
  check (conversation_id ~* '^conv_[a-z0-9]{10,190}$');

alter table public.voice_preview_sessions enable row level security;
revoke all on public.voice_preview_sessions from public, anon, authenticated, service_role;
grant select, insert on public.voice_preview_sessions to service_role;
