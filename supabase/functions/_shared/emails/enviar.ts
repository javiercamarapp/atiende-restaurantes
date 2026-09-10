// Envío real, vía Resend, de un correo ya construido (asunto/html/texto) por
// alguna plantilla de plantillas.ts. Mismo proveedor y misma forma de
// llamada que ya usa send-order-notification/index.ts — se separa aquí para
// que cualquier disparador nuevo (bienvenida, etc.) la reuse sin duplicar la
// llamada a la API de Resend.
import { fetchWithTimeout as fetch } from "../fetch-timeout.ts";

export interface CorreoConstruido {
  asunto: string;
  html: string;
  texto: string;
}

// Se lanza cuando el correo no se pudo enviar (proveedor sin configurar o
// Resend respondió con error). Deliberadamente NO se atrapa aquí adentro:
// quien dispara un correo decide qué tan crítico es. Los disparadores
// best-effort (altas de cuenta) la atrapan y solo loguean — nunca bloquean
// ni revierten la operación principal por esto.
export class CorreoNoEnviadoError extends Error {}

export async function enviarCorreo(
  correo: CorreoConstruido,
  destinatarios: string[],
  idempotencyKey: string,
): Promise<void> {
  if (destinatarios.length === 0) return;

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const RESEND_FROM = Deno.env.get("RESEND_FROM") ??
    "atiende.ai <notificaciones@useatiende.ai>";
  if (!RESEND_API_KEY) {
    throw new CorreoNoEnviadoError(
      "Proveedor de correo no configurado (RESEND_API_KEY)",
    );
  }

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
      // Resend retiene idempotency keys 24 h — cierra la ventana normal de
      // reintento "el proveedor aceptó pero el worker se cayó antes de
      // responder" para este efecto.
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: destinatarios,
      subject: correo.asunto,
      html: correo.html,
      text: correo.texto,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new CorreoNoEnviadoError(`Resend respondió ${resp.status}: ${body}`);
  }
}
