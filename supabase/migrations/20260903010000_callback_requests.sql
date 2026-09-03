-- Cierra un hueco real: ambos agentes (voz y WhatsApp) siempre prometieron
-- "anotar el contacto" cuando la llamada/mensaje no es para hacer un pedido
-- (quejas, facturación, empleo), pero no existía ninguna tabla ni herramienta
-- que de verdad lo guardara — se quedaba en una promesa vacía.
create table if not exists public.callback_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid,
  customer_name text not null,
  customer_phone text not null,
  reason text,
  message text,
  source text not null default 'voice' check (source in ('voice','whatsapp','web','admin')),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.callback_requests enable row level security;
create policy "Restaurant staff can view their callback requests"
  on public.callback_requests for select
  using (true);
create policy "Service role can insert callback requests"
  on public.callback_requests for insert
  with check (true);
