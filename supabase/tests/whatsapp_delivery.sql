begin;

insert into public.restaurants(id, name, slug)
values ('51000000-0000-0000-0000-000000000001', 'WhatsApp Test', 'whatsapp-test');

do $$
declare
  v_restaurant uuid := '51000000-0000-0000-0000-000000000001';
  v_hash text := repeat('a', 64);
begin
  if not public.claim_whatsapp_message(v_restaurant, 'wamid.1', v_hash) then raise exception 'first message claim failed'; end if;
  if public.claim_whatsapp_message(v_restaurant, 'wamid.1', v_hash) then raise exception 'duplicate message claim succeeded'; end if;
  if not public.claim_whatsapp_conversation(v_restaurant, v_hash, 'wamid.1', 120) then raise exception 'first conversation lease failed'; end if;
  if public.claim_whatsapp_conversation(v_restaurant, v_hash, 'wamid.2', 120) then raise exception 'overlapping conversation lease succeeded'; end if;
  perform public.finish_whatsapp_message(v_restaurant, 'wamid.1', v_hash, 'failed', 'SyntheticFailure');
  if not public.claim_whatsapp_message(v_restaurant, 'wamid.1', v_hash) then raise exception 'failed message was not reclaimable'; end if;
  if not public.claim_whatsapp_conversation(v_restaurant, v_hash, 'wamid.1', 120) then raise exception 'lease was not released'; end if;
  perform public.finish_whatsapp_message(v_restaurant, 'wamid.1', v_hash, 'processed', null);
  if public.claim_whatsapp_message(v_restaurant, 'wamid.1', v_hash) then raise exception 'processed message was reclaimed'; end if;
end;
$$;

rollback;
