create table public.operational_events (
  id bigint generated always as identity primary key,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  correlation_id text not null check (length(correlation_id) between 8 and 128),
  component text not null check (length(component) between 1 and 80),
  event_name text not null check (length(event_name) between 1 and 120),
  severity text not null check (severity in ('info','warn','error')),
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 3600000),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 4096)
);
alter table public.operational_events enable row level security;
create policy "Tenant managers can view operational events"
  on public.operational_events for select to authenticated
  using (restaurant_id is not null and (
    public.can_manage_restaurant(auth.uid(), restaurant_id) or public.is_superadmin(auth.uid())
  ));
revoke all on public.operational_events from public, anon, authenticated;
grant select on public.operational_events to authenticated;
grant select, insert, delete on public.operational_events to service_role;
create index operational_events_tenant_time_idx
  on public.operational_events(restaurant_id, created_at desc);
create index operational_events_alert_idx
  on public.operational_events(event_name, severity, created_at desc);

create or replace function public.record_operational_event(
  p_restaurant_id uuid, p_correlation_id text, p_component text,
  p_event_name text, p_severity text, p_duration_ms integer default null,
  p_metadata jsonb default '{}'
) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if current_user not in ('postgres', 'service_role') then
    raise insufficient_privilege using message = 'service role required'; end if;
  if p_metadata::text ~* '(authorization|bearer |token|secret|password|customer_phone|address|email)' then
    raise exception 'sensitive metadata rejected'; end if;
  insert into public.operational_events(
    restaurant_id, correlation_id, component, event_name, severity, duration_ms, metadata
  ) values (
    p_restaurant_id, p_correlation_id, p_component, p_event_name, p_severity,
    p_duration_ms, coalesce(p_metadata, '{}')
  ) returning id into v_id;
  return v_id;
end $$;

create or replace function public.operational_alert_snapshot(
  p_restaurant_id uuid, p_window_minutes integer default 10
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_events integer; v_errors integer; v_timeouts integer; v_dead integer; v_oldest integer;
begin
  if not (public.can_manage_restaurant(auth.uid(), p_restaurant_id) or public.is_superadmin(auth.uid()))
    then raise insufficient_privilege using message = 'not authorized'; end if;
  if p_window_minutes not between 1 and 1440 then raise exception 'invalid window'; end if;
  select count(*), count(*) filter(where severity='error'),
    count(*) filter(where event_name ilike '%timeout%') into v_events,v_errors,v_timeouts
  from public.operational_events where restaurant_id=p_restaurant_id
    and created_at >= now()-make_interval(mins=>p_window_minutes);
  select count(*) filter(where status='dead'),
    coalesce(extract(epoch from now()-min(created_at))::integer,0)
    into v_dead,v_oldest from public.messaging_outbox
    where restaurant_id=p_restaurant_id and status in ('pending','failed','dead');
  return jsonb_build_object(
    'events',v_events,'errors',v_errors,'timeouts',v_timeouts,
    'error_rate',case when v_events=0 then 0 else round(v_errors::numeric/v_events,4) end,
    'outbox_dead',v_dead,'outbox_oldest_seconds',v_oldest,
    'alerts',jsonb_build_array(
      jsonb_build_object('name','error_rate','firing',v_events>=5 and v_errors::numeric/v_events>0.01),
      jsonb_build_object('name','provider_timeouts','firing',v_timeouts>=5),
      jsonb_build_object('name','outbox_dead','firing',v_dead>0),
      jsonb_build_object('name','outbox_backlog','firing',v_oldest>600)
    )
  );
end $$;

revoke all on function public.record_operational_event(uuid,text,text,text,text,integer,jsonb) from public,anon,authenticated;
revoke all on function public.operational_alert_snapshot(uuid,integer) from public,anon;
grant execute on function public.record_operational_event(uuid,text,text,text,text,integer,jsonb) to service_role;
grant execute on function public.operational_alert_snapshot(uuid,integer) to authenticated;
