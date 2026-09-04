-- The forward-upgrade path may create restaurant_staff on an installation
-- where the clean-bootstrap migration never ran. Enforce the same boundary.
alter table public.restaurant_staff enable row level security;

revoke update on table public.restaurant_staff from authenticated;
grant select on table public.restaurant_staff to authenticated;
grant update (
  notify_nuevo,
  notify_preparando,
  notify_en_camino,
  notify_entregado,
  notify_cancelado,
  notify_queja,
  notify_escalar
) on table public.restaurant_staff to authenticated;
