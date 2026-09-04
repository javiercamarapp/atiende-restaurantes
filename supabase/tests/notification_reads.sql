begin;

insert into auth.users(id, email, raw_user_meta_data, created_at, updated_at) values
  ('68000000-0000-0000-0000-000000000001', 'notification-a@example.invalid', '{}', now(), now()),
  ('68000000-0000-0000-0000-000000000002', 'notification-b@example.invalid', '{}', now(), now());
insert into public.restaurants(id, name, slug) values
  ('68000000-0000-0000-0000-000000000010', 'Notifications A', 'notifications-a'),
  ('68000000-0000-0000-0000-000000000020', 'Notifications B', 'notifications-b');
insert into public.restaurant_staff(id, restaurant_id, user_id, role) values
  ('68000000-0000-0000-0000-000000000011', '68000000-0000-0000-0000-000000000010', '68000000-0000-0000-0000-000000000001', 'admin'),
  ('68000000-0000-0000-0000-000000000021', '68000000-0000-0000-0000-000000000020', '68000000-0000-0000-0000-000000000002', 'admin');
insert into public.orders(id, customer_name, customer_phone, customer_address, branch, total, status, items, restaurant_id) values
  ('68000000-0000-0000-0000-000000000091', 'Notification order', '9990000001', 'QA', 'QA', 42, 'pending', '[]', '68000000-0000-0000-0000-000000000010');
insert into public.callback_requests(id, restaurant_id, customer_name, customer_phone, reason, source) values
  ('68000000-0000-0000-0000-000000000092', '68000000-0000-0000-0000-000000000010', 'Notification callback', '9990000002', 'queja de prueba', 'voice');

set local role authenticated;
select set_config('request.jwt.claim.sub', '68000000-0000-0000-0000-000000000001', true);

insert into public.notification_reads(user_id, restaurant_id, notification_key) values
  ('68000000-0000-0000-0000-000000000001', '68000000-0000-0000-0000-000000000010', 'recibidos:68000000-0000-0000-0000-000000000099');

do $$
declare v_count integer;
begin
  select count(*) into v_count from public.notification_reads;
  if v_count <> 1 then raise exception 'user cannot read own notification state'; end if;
  if public.notification_unread_count('68000000-0000-0000-0000-000000000010') <> 3 then
    raise exception 'order plus complaint/escalation must produce three unread categories';
  end if;
  perform public.mark_all_notifications_read('68000000-0000-0000-0000-000000000010');
  if public.notification_unread_count('68000000-0000-0000-0000-000000000010') <> 0 then
    raise exception 'mark-all must clear the same event universe used by the bell';
  end if;

  begin
    insert into public.notification_reads(user_id, restaurant_id, notification_key) values
      ('68000000-0000-0000-0000-000000000001', '68000000-0000-0000-0000-000000000020', 'recibidos:68000000-0000-0000-0000-000000000098');
    raise exception 'cross-tenant notification read unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.notification_unread_count('68000000-0000-0000-0000-000000000020');
    raise exception 'cross-tenant unread count unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.mark_all_notifications_read('68000000-0000-0000-0000-000000000020');
    raise exception 'cross-tenant mark-all unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.notification_reads(user_id, restaurant_id, notification_key) values
      ('68000000-0000-0000-0000-000000000002', '68000000-0000-0000-0000-000000000010', 'recibidos:68000000-0000-0000-0000-000000000097');
    raise exception 'another user notification read unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.notification_reads(user_id, restaurant_id, notification_key) values
      ('68000000-0000-0000-0000-000000000001', '68000000-0000-0000-0000-000000000010', 'categoria-invalida:68000000-0000-0000-0000-000000000096');
    raise exception 'invalid notification category unexpectedly succeeded';
  exception when check_violation then null;
  end;
end;
$$;

rollback;
