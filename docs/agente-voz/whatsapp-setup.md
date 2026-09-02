# Agente por WhatsApp — demo con el sandbox de Twilio

Mismo cerebro que el agente de voz (mismas reglas de negocio, mismo `create-order`), pero por
chat. El código ya está en `supabase/functions/whatsapp-webhook/`. Esto es lo que falta para
que conteste de verdad:

## 1. Cuenta y sandbox de Twilio (5-10 min, sin verificación de negocio)

1. Crea una cuenta en Twilio (o usa la que ya tengas).
2. En la consola: **Messaging → Try it out → Send a WhatsApp message** — te da un número
   sandbox compartido (ej. `+1 415 523 8886`) y un código tipo `join palabra-clave`.
3. Desde el celular con el que vas a hacer la demo, mándale por WhatsApp ese `join
   palabra-clave` al número sandbox. Así ese número queda autorizado a recibir mensajes del
   agente durante la demo (el sandbox solo habla con números que se "unieron" así).
4. En **Sandbox settings → "When a message comes in"**, pega esta URL como webhook (método POST):
   `https://okvxavwijqacomgtyyou.supabase.co/functions/v1/whatsapp-webhook`

## 2. Secretos a configurar en Supabase (Project Settings → Edge Functions → Secrets, o `supabase secrets set`)

| secreto | de dónde sale |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com — clave de API de Claude |
| `TWILIO_ACCOUNT_SID` | consola de Twilio |
| `TWILIO_AUTH_TOKEN` | consola de Twilio |
| `TWILIO_WHATSAPP_FROM` | el número del sandbox con formato `whatsapp:+14155238886` |
| `CLAUDE_MODEL` (opcional) | por defecto usa `claude-haiku-4-5-20251001` (barato y rápido, alcanza para tomar pedidos) |

## 3. Desplegar la función

```
supabase functions deploy whatsapp-webhook
supabase functions deploy create-order
```

## 4. Qué esperar en el demo

- Es el número **sandbox compartido de Twilio**, no un número de WhatsApp con la marca del
  restaurante — para eso sí hace falta verificar el negocio con Meta (días, no horas). Como
  demo de "mira, ya funciona" es perfectamente honesto mostrarlo así; solo acláralo al
  restaurante para que no esperen que ese número siga funcionando después sin la verificación
  real.
- Cada número de celular que quiera probarlo tiene que mandar el `join <palabra>` una vez antes
  de poder chatear con el agente — es una limitación del sandbox, no del código.
- El bot mantiene la conversación en la tabla `whatsapp_conversations` (una fila por número de
  teléfono) — si algo sale raro a media prueba, esa tabla es el primer lugar para ver qué se
  dijeron.
