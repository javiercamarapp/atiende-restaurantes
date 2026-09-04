-- Outbox versionado para efectos externos. La clave de deduplicación es por
-- tenant/canal/evento y permanece aun después de enviar (replay seguro).
create table if not exists public.messaging_outbox (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'email')),
  event_type text not null check (length(event_type) between 1 and 80),
  dedupe_key text not null check (length(dedupe_key) between 1 and 255),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','dead')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  fence_token uuid,
  last_error text check (last_error is null or length(last_error) <= 500),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, channel, dedupe_key)
);
create index if not exists messaging_outbox_dispatch_idx
  on public.messaging_outbox (status, available_at, created_at);
alter table public.messaging_outbox enable row level security;
revoke all on public.messaging_outbox from public, anon, authenticated;
grant select, insert, update on public.messaging_outbox to service_role;

create or replace function public.enqueue_messaging_outbox(
  p_restaurant_id uuid, p_channel text, p_event_type text,
  p_dedupe_key text, p_payload jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_channel not in ('whatsapp','email') then raise exception 'invalid outbox channel'; end if;
  insert into public.messaging_outbox(restaurant_id, channel, event_type, dedupe_key, payload)
  values (p_restaurant_id, p_channel, p_event_type, p_dedupe_key, p_payload)
  on conflict (restaurant_id, channel, dedupe_key) do update
    set payload = excluded.payload, event_type = excluded.event_type, updated_at = now()
    where messaging_outbox.status in ('pending','failed');
  select id into v_id from public.messaging_outbox
    where restaurant_id = p_restaurant_id and channel = p_channel and dedupe_key = p_dedupe_key;
  return v_id;
end; $$;

create or replace function public.claim_messaging_outbox_batch(
  p_worker_id text, p_limit integer default 20, p_lease_seconds integer default 120
) returns setof public.messaging_outbox
language plpgsql security definer set search_path = public as $$
begin
  if p_worker_id is null or length(p_worker_id) not between 1 and 120
    or p_limit not between 1 and 100 or p_lease_seconds not between 10 and 900 then
    raise exception 'invalid outbox claim parameters';
  end if;
  return query
  with candidates as (
    select id from public.messaging_outbox
    where (status = 'pending' or status = 'failed' or
      (status = 'processing' and lease_until < now()))
      and available_at <= now() and status <> 'dead'
    order by created_at, id for update skip locked limit p_limit
  )
  update public.messaging_outbox o
    set status = 'processing', attempts = o.attempts + 1,
        lease_until = now() + make_interval(secs => p_lease_seconds),
        fence_token = gen_random_uuid(), updated_at = now()
  from candidates c where o.id = c.id
  returning o.*;
end; $$;

create or replace function public.complete_messaging_outbox(
  p_id uuid, p_fence_token uuid, p_status text, p_error text default null,
  p_retry_seconds integer default 60, p_max_attempts integer default 8
) returns boolean language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if p_status not in ('sent','failed') then raise exception 'invalid outbox completion'; end if;
  update public.messaging_outbox set
    status = case when p_status = 'sent' then 'sent'
      when attempts >= p_max_attempts then 'dead' else 'failed' end,
    available_at = case when p_status = 'failed' and attempts < p_max_attempts
      then now() + make_interval(secs => greatest(1, least(p_retry_seconds, 86400))) else available_at end,
    lease_until = null, last_error = left(p_error, 500),
    sent_at = case when p_status = 'sent' then now() else sent_at end, updated_at = now()
  where id = p_id and status = 'processing' and fence_token = p_fence_token;
  get diagnostics v_count = row_count;
  return v_count = 1;
end; $$;

revoke all on function public.enqueue_messaging_outbox(uuid,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.claim_messaging_outbox_batch(text,integer,integer) from public, anon, authenticated;
revoke all on function public.complete_messaging_outbox(uuid,uuid,text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.enqueue_messaging_outbox(uuid,text,text,text,jsonb) to service_role;
grant execute on function public.claim_messaging_outbox_batch(text,integer,integer) to service_role;
grant execute on function public.complete_messaging_outbox(uuid,uuid,text,text,integer,integer) to service_role;

create or replace function public.enqueue_order_email_outbox()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' or new.status is distinct from old.status)
    and new.status in ('pending','preparando','en_camino','entregado','completado','cancelado','problema') then
    perform public.enqueue_messaging_outbox(
      new.restaurant_id, 'email', 'order.' || new.status,
      'order:' || new.id::text || ':status:' || new.status,
      jsonb_build_object('order_id', new.id::text, 'evento', new.status));
  end if;
  return new;
end; $$;
drop trigger if exists orders_enqueue_email_outbox on public.orders;
create trigger orders_enqueue_email_outbox after insert or update of status on public.orders
for each row execute function public.enqueue_order_email_outbox();
revoke all on function public.enqueue_order_email_outbox() from public, anon, authenticated;
