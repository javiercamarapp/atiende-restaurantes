create table if not exists public.whatsapp_inbound_events (
  message_id text primary key check (length(message_id) between 1 and 255),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  phone_hash text not null check (phone_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'processing' check (status in ('processing', 'processed', 'failed')),
  attempts integer not null default 1 check (attempts > 0),
  claimed_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error_class text check (last_error_class is null or length(last_error_class) <= 120)
);

create table if not exists public.whatsapp_conversation_leases (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  phone_hash text not null check (phone_hash ~ '^[0-9a-f]{64}$'),
  owner_message_id text not null check (length(owner_message_id) between 1 and 255),
  locked_until timestamptz not null,
  primary key (restaurant_id, phone_hash)
);

alter table public.whatsapp_inbound_events enable row level security;
alter table public.whatsapp_conversation_leases enable row level security;
revoke all on public.whatsapp_inbound_events, public.whatsapp_conversation_leases from public, anon, authenticated;
grant select, insert, update, delete on public.whatsapp_inbound_events, public.whatsapp_conversation_leases to service_role;

create or replace function public.claim_whatsapp_message(
  p_restaurant_id uuid,
  p_message_id text,
  p_phone_hash text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_message_id is null or length(p_message_id) not between 1 and 255 or p_phone_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  insert into public.whatsapp_inbound_events(message_id, restaurant_id, phone_hash)
  values (p_message_id, p_restaurant_id, p_phone_hash)
  on conflict (message_id) do update
    set status = 'processing',
        attempts = whatsapp_inbound_events.attempts + 1,
        claimed_at = now(),
        last_error_class = null
  where whatsapp_inbound_events.restaurant_id = excluded.restaurant_id
    and (
      whatsapp_inbound_events.status = 'failed'
      or (whatsapp_inbound_events.status = 'processing' and whatsapp_inbound_events.claimed_at < now() - interval '5 minutes')
    );
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create or replace function public.claim_whatsapp_conversation(
  p_restaurant_id uuid,
  p_phone_hash text,
  p_message_id text,
  p_lease_seconds integer default 120
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_phone_hash !~ '^[0-9a-f]{64}$' or length(p_message_id) not between 1 and 255 or p_lease_seconds not between 1 and 300 then return false; end if;
  insert into public.whatsapp_conversation_leases(restaurant_id, phone_hash, owner_message_id, locked_until)
  values (p_restaurant_id, p_phone_hash, p_message_id, now() + make_interval(secs => p_lease_seconds))
  on conflict (restaurant_id, phone_hash) do update
    set owner_message_id = excluded.owner_message_id,
        locked_until = excluded.locked_until
  where whatsapp_conversation_leases.locked_until < now();
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create or replace function public.finish_whatsapp_message(
  p_restaurant_id uuid,
  p_message_id text,
  p_phone_hash text,
  p_status text,
  p_error_class text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('processed', 'failed') then raise exception 'invalid status'; end if;
  update public.whatsapp_inbound_events
  set status = p_status,
      processed_at = case when p_status = 'processed' then now() else null end,
      last_error_class = left(p_error_class, 120)
  where message_id = p_message_id and restaurant_id = p_restaurant_id and phone_hash = p_phone_hash;
  delete from public.whatsapp_conversation_leases
  where restaurant_id = p_restaurant_id and phone_hash = p_phone_hash and owner_message_id = p_message_id;
end;
$$;

revoke all on function public.claim_whatsapp_message(uuid,text,text) from public, anon, authenticated;
revoke all on function public.claim_whatsapp_conversation(uuid,text,text,integer) from public, anon, authenticated;
revoke all on function public.finish_whatsapp_message(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.claim_whatsapp_message(uuid,text,text) to service_role;
grant execute on function public.claim_whatsapp_conversation(uuid,text,text,integer) to service_role;
grant execute on function public.finish_whatsapp_message(uuid,text,text,text,text) to service_role;
