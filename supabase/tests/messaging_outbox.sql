-- Contrato local: no llama proveedores; solo prueba el ledger y sus fences.
do $$
declare r uuid := '51000000-0000-0000-0000-000000000001';
  first_id uuid; second_id uuid; j public.messaging_outbox; stale boolean;
begin
  insert into public.restaurants(id, name, slug) values (r, 'Outbox Test', 'outbox-test') on conflict (id) do nothing;
  select public.enqueue_messaging_outbox(r, 'whatsapp', 'reply', 'test:1', '{"to":"+521","body":"hola"}') into first_id;
  select public.enqueue_messaging_outbox(r, 'whatsapp', 'reply', 'test:1', '{"to":"+521","body":"hola"}') into second_id;
  if first_id <> second_id then raise exception 'replay created duplicate'; end if;
  select * into j from public.claim_messaging_outbox_batch('sql-test', 10, 60) where id = first_id;
  if j.status <> 'processing' or j.attempts <> 1 then raise exception 'claim failed'; end if;
  select public.complete_messaging_outbox(first_id, gen_random_uuid(), 'sent') into stale;
  if stale then raise exception 'stale fence was accepted'; end if;
  if not public.complete_messaging_outbox(first_id, j.fence_token, 'sent') then raise exception 'valid fence rejected'; end if;
  if (select status from public.messaging_outbox where id = first_id) <> 'sent' then raise exception 'not sent'; end if;
  perform public.enqueue_messaging_outbox(r, 'email', 'order.nuevo', 'test:dead', '{"order_id":"x","evento":"nuevo"}');
  select * into j from public.claim_messaging_outbox_batch('sql-test', 10, 60) where dedupe_key = 'test:dead';
  for i in 1..8 loop
    if i > 1 then update public.messaging_outbox set available_at = now() where id = j.id; select * into j from public.claim_messaging_outbox_batch('sql-test', 10, 60) where id = j.id; end if;
    perform public.complete_messaging_outbox(j.id, j.fence_token, 'failed', 'synthetic', 1, 8);
  end loop;
  if (select status from public.messaging_outbox where dedupe_key = 'test:dead') <> 'dead' then raise exception 'DLQ not reached'; end if;
end $$;
