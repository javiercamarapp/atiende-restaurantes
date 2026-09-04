begin;
insert into auth.users(id, aud, role, email, encrypted_password) values
 ('66000000-0000-0000-0000-000000000001','authenticated','authenticated','privacy-owner@test.invalid',''),
 ('66000000-0000-0000-0000-000000000002','authenticated','authenticated','privacy-outsider@test.invalid','');
insert into public.restaurants(id,name,slug) values
 ('66100000-0000-0000-0000-000000000001','Privacy A','privacy-a'),
 ('66100000-0000-0000-0000-000000000002','Privacy B','privacy-b');
insert into public.restaurant_staff(restaurant_id,user_id,role) values
 ('66100000-0000-0000-0000-000000000001','66000000-0000-0000-0000-000000000001','owner');
insert into public.customers(id,restaurant_id,phone,name) values
 ('66200000-0000-0000-0000-000000000001','66100000-0000-0000-0000-000000000001','+529999000001','Persona privada'),
 ('66200000-0000-0000-0000-000000000002','66100000-0000-0000-0000-000000000002','+529999000002','Otra persona');
insert into public.customer_addresses(customer_id,address) values
 ('66200000-0000-0000-0000-000000000001','Dirección privada 1');
insert into public.orders(id,restaurant_id,customer_id,customer_name,customer_phone,customer_address,total,items,status)
 values ('66300000-0000-0000-0000-000000000001','66100000-0000-0000-0000-000000000001','66200000-0000-0000-0000-000000000001','Persona privada','+529999000001','Dirección privada 1',10,'[]','entregado');
insert into public.whatsapp_conversations(restaurant_id,phone,messages) values
 ('66100000-0000-0000-0000-000000000001','+5219999000001','[{"role":"user","content":"dato privado"}]');
select public.enqueue_messaging_outbox(
 '66100000-0000-0000-0000-000000000001','whatsapp','reply','privacy:1',
 '{"to":"5219999000001","body":"respuesta privada"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','66000000-0000-0000-0000-000000000001',true);
do $$ declare payload jsonb; begin
  payload := public.export_customer_data('66100000-0000-0000-0000-000000000001','66200000-0000-0000-0000-000000000001');
  if payload #>> '{customer,name}' <> 'Persona privada'
    or jsonb_array_length(payload->'orders') <> 1
    or jsonb_array_length(payload->'whatsapp_conversations') <> 1
    or jsonb_array_length(payload->'pending_messages') <> 1 then raise exception 'export incomplete'; end if;
  begin
    perform public.export_customer_data('66100000-0000-0000-0000-000000000002','66200000-0000-0000-0000-000000000002');
    raise exception 'cross-tenant export succeeded';
  exception when insufficient_privilege then null; end;
  perform public.erase_customer_data('66100000-0000-0000-0000-000000000001','66200000-0000-0000-0000-000000000001');
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.customers where id='66200000-0000-0000-0000-000000000001') then raise exception 'customer survived'; end if;
  if exists(select 1 from public.orders where id='66300000-0000-0000-0000-000000000001' and (customer_id is not null or customer_name <> 'Cliente eliminado' or customer_address is not null)) then raise exception 'PII survived'; end if;
  if exists(select 1 from public.whatsapp_conversations where restaurant_id='66100000-0000-0000-0000-000000000001') then raise exception 'conversation PII survived'; end if;
  if exists(select 1 from public.messaging_outbox where restaurant_id='66100000-0000-0000-0000-000000000001' and payload ?| array['to','body']) then raise exception 'outbox PII survived'; end if;
  if (select count(*) from public.privacy_requests where restaurant_id='66100000-0000-0000-0000-000000000001') <> 2 then raise exception 'audit missing'; end if;
end $$;
rollback;
