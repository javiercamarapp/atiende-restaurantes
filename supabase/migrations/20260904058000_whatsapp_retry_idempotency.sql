alter table public.whatsapp_inbound_events
  add column if not exists user_message_appended boolean not null default false;

alter table public.callback_requests
  add column if not exists source_event_id text;
alter table public.callback_requests
  drop constraint if exists callback_requests_source_event_id_length;
alter table public.callback_requests
  add constraint callback_requests_source_event_id_length
  check (source_event_id is null or length(source_event_id) between 1 and 255);
alter table public.callback_requests
  drop constraint if exists callback_requests_tenant_source_event_key;
alter table public.callback_requests
  add constraint callback_requests_tenant_source_event_key
  unique (restaurant_id, source_event_id);

create or replace function public.append_whatsapp_user_message_once(
  p_restaurant_id uuid,
  p_message_id text,
  p_phone text,
  p_new_message jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appended boolean;
  v_messages jsonb;
begin
  select user_message_appended into v_appended
  from public.whatsapp_inbound_events
  where restaurant_id = p_restaurant_id and message_id = p_message_id
  for update;
  if not found then raise exception 'inbound event not claimed'; end if;

  if v_appended then
    select messages into v_messages from public.whatsapp_conversations
    where restaurant_id = p_restaurant_id and phone = p_phone;
    return coalesce(v_messages, '[]'::jsonb);
  end if;

  v_messages := public.whatsapp_append_turn(
    p_restaurant_id, p_phone, jsonb_build_array(p_new_message), null, null, null
  );
  update public.whatsapp_inbound_events
  set user_message_appended = true
  where restaurant_id = p_restaurant_id and message_id = p_message_id;
  return v_messages;
end;
$$;

revoke all on function public.append_whatsapp_user_message_once(uuid,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.append_whatsapp_user_message_once(uuid,text,text,jsonb)
  to service_role;
