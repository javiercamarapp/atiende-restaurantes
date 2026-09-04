begin;

insert into auth.users(id, email, raw_user_meta_data, created_at, updated_at) values
  ('69000000-0000-0000-0000-000000000001', 'preview-admin@example.invalid', '{}', now(), now());
insert into public.restaurants(id, name, slug) values
  ('69000000-0000-0000-0000-000000000010', 'Preview A', 'preview-test-a'),
  ('69000000-0000-0000-0000-000000000020', 'Preview B', 'preview-test-b');

set local role service_role;
insert into public.voice_preview_sessions(conversation_id, restaurant_id, agent_id, created_by)
values ('conv_1234567890abcdefghij', '69000000-0000-0000-0000-000000000010', 'agent_1234567890abcdefghij', '69000000-0000-0000-0000-000000000001');

-- El mismo UPSERT usado por el endpoint ignora conflictos, incluso cruzados.
insert into public.voice_preview_sessions(conversation_id, restaurant_id, agent_id, created_by)
values ('conv_1234567890abcdefghij', '69000000-0000-0000-0000-000000000020', 'agent_other1234567890', '69000000-0000-0000-0000-000000000001')
on conflict (conversation_id) do nothing;

do $$
begin
  if (select restaurant_id from public.voice_preview_sessions where conversation_id = 'conv_1234567890abcdefghij')
      <> '69000000-0000-0000-0000-000000000010'::uuid then
    raise exception 'preview marker changed tenants';
  end if;
  begin
    update public.voice_preview_sessions set restaurant_id = '69000000-0000-0000-0000-000000000020'
    where conversation_id = 'conv_1234567890abcdefghij';
    raise exception 'service role can overwrite a preview marker';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.voice_preview_sessions where conversation_id = 'conv_1234567890abcdefghij';
    raise exception 'service role can erase a preview marker';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.voice_preview_sessions(conversation_id, restaurant_id, agent_id, created_by)
    values ('not-a-conversation', '69000000-0000-0000-0000-000000000010', 'agent_1234567890abcdefghij', '69000000-0000-0000-0000-000000000001');
    raise exception 'invalid conversation id was stored';
  exception when check_violation then null;
  end;
end;
$$;

set local role authenticated;
do $$
begin
  begin
    perform 1 from public.voice_preview_sessions;
    raise exception 'browser can read private preview markers';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
delete from auth.users where id = '69000000-0000-0000-0000-000000000001';
do $$
begin
  if not exists (select 1 from public.voice_preview_sessions where conversation_id = 'conv_1234567890abcdefghij' and created_by is null) then
    raise exception 'removing an admin erased a preview marker';
  end if;
end;
$$;

rollback;
