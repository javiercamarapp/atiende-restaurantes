-- WhatsApp al CLIENTE en cambios de estado del pedido, reusando el mismo
-- trigger/mecanismo de outbox que ya encola el correo a staff
-- (enqueue_order_email_outbox / messaging_outbox) y el mismo dispatcher que
-- ya sabe enviar WhatsApp (messaging-dispatcher, usado hoy solo para la
-- conversación del agente). Antes de esto messaging_outbox solo tenía canal
-- email para eventos de pedido.
--
-- El teléfono: orders.customer_phone es SIEMPRE el número nacional de México
-- de 10 dígitos, sin importar el origen del pedido (web/voz/whatsapp) — ver
-- normalizePhone()/canonicalizeMexicanPhone() en create-order-core.ts, que
-- recortan a los últimos 10 dígitos incluso cuando el pedido lo creó el
-- propio agente de WhatsApp (el wa_id completo vive en whatsapp_conversations
-- y en el payload del canal whatsapp de la conversación, no en orders). El
-- dispatcher llama a Graph API con el "to" tal cual viene en el payload —
-- aquí reconstruimos el E.164 real de México (52 + 10 dígitos) antes de
-- encolar, igual que ya hace canonicalizeMexicanPhone en sentido inverso.
--
-- Alcance: no se manda WhatsApp en el evento "nuevo" (INSERT). El cliente ya
-- recibe confirmación en el canal donde hizo el pedido (la respuesta del
-- propio agente si fue por WhatsApp, o la pantalla/llamada si fue web/voz);
-- un segundo mensaje ahí sería ruido duplicado, no señal nueva. Los cambios
-- de estado posteriores sí son información nueva, así que se cubren todos
-- los que ya tenían correo a staff (preparando/en_camino/entregado/
-- completado/cancelado/problema) — el pedido explícitamente cubre al menos
-- los primeros tres, y separar el resto no vale la pena.
--
-- Función y trigger renombrados (email -> status) porque ahora hacen más que
-- encolar correo; no hay Supabase de producción activo para este repo
-- todavía, así que renombrar es gratis.
drop trigger if exists orders_enqueue_email_outbox on public.orders;
drop function if exists public.enqueue_order_email_outbox();

create or replace function public.enqueue_order_status_outbox()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_event text;
  v_status_customer_event boolean;
  v_customer_digits text;
  v_branch text;
  v_whatsapp_body text;
begin
  if tg_op = 'INSERT' then
    v_event := 'nuevo';
  elsif new.status is distinct from old.status
    and new.status in ('preparando','en_camino','entregado','completado','cancelado','problema') then
    v_event := new.status;
  end if;

  if v_event is not null then
    perform public.enqueue_messaging_outbox(
      new.restaurant_id, 'email', 'order.' || v_event,
      'order:' || new.id::text || ':status:' || v_event,
      jsonb_build_object('order_id', new.id::text, 'evento', v_event));
  end if;

  v_status_customer_event := tg_op = 'UPDATE' and new.status is distinct from old.status
    and new.status in ('preparando','en_camino','entregado','completado','cancelado','problema');

  if v_status_customer_event then
    v_customer_digits := regexp_replace(coalesce(new.customer_phone, ''), '\D', '', 'g');
    -- Un pedido con teléfono mal formado (dato legado o de prueba) no debe
    -- tronar la transición de estado completa: simplemente no se manda el
    -- WhatsApp del cliente (el correo a staff arriba sí se encoló igual).
    if length(v_customer_digits) = 10 then
      v_branch := nullif(trim(coalesce(new.branch, '')), '');
      v_whatsapp_body := case new.status
        when 'preparando' then 'Tu pedido #' || new.order_number
          || case when v_branch is not null then ' en ' || v_branch else '' end
          || ' ya está en preparación.'
        when 'en_camino' then 'Tu pedido #' || new.order_number || ' va en camino.'
        when 'entregado' then 'Tu pedido #' || new.order_number || ' fue entregado. ¡Gracias por tu compra!'
        when 'completado' then 'Tu pedido #' || new.order_number || ' fue completado. ¡Gracias por tu compra'
          || case when v_branch is not null then ' en ' || v_branch else '' end || '!'
        when 'cancelado' then 'Tu pedido #' || new.order_number || ' fue cancelado.'
        when 'problema' then 'Hubo un problema con tu pedido #' || new.order_number
          || '. Nos pondremos en contacto contigo.'
      end;
      perform public.enqueue_messaging_outbox(
        new.restaurant_id, 'whatsapp', 'order.' || new.status || '.customer',
        'order:' || new.id::text || ':status:' || new.status,
        jsonb_build_object('to', '52' || v_customer_digits, 'body', v_whatsapp_body));
    end if;
  end if;

  return new;
end; $$;

create trigger orders_enqueue_status_outbox after insert or update of status on public.orders
for each row execute function public.enqueue_order_status_outbox();

revoke all on function public.enqueue_order_status_outbox() from public, anon, authenticated;
