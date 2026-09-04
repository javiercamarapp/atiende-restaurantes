-- Recrear el esquema original ya desplegado dentro de una transacción; la
-- prueba incluida hace ROLLBACK de todos los cambios y datos de prueba.
begin;

alter table public.voice_preview_sessions drop constraint voice_preview_sessions_created_by_fkey;
alter table public.voice_preview_sessions alter column created_by set not null;
alter table public.voice_preview_sessions add constraint voice_preview_sessions_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete cascade;
alter table public.voice_preview_sessions drop constraint voice_preview_conversation_id_not_blank;
alter table public.voice_preview_sessions add constraint voice_preview_conversation_id_not_blank
  check (length(btrim(conversation_id)) between 10 and 200);
grant select, insert, update, delete on public.voice_preview_sessions to service_role;

\ir ../migrations/20260904069500_voice_preview_sessions_hardening.sql
\ir voice_preview_sessions.sql
