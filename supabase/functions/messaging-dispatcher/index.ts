// Dispatcher server-to-server del outbox. Solo acepta el secreto interno y
// usa el fence_token emitido por SQL: un worker viejo nunca puede completar
// el trabajo reclamado por otro worker.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0"
import { fetchWithTimeout as fetch } from "../_shared/fetch-timeout.ts"
import { secretMatches } from "../_shared/http-security.ts"
import {
  correlationHeaders,
  correlationId,
  logEvent,
} from "../_shared/observability.ts"

const GRAPH_API_VERSION = "v25.0"
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

async function secret(name: string) {
  const { data } = await supabase.rpc("get_secret", { secret_name: name })
  return data as string | null
}

async function recordEvent(
  restaurantId: string,
  requestId: string,
  eventName: string,
  severity: "info" | "warn" | "error",
  metadata: Record<string, unknown>,
) {
  const { error } = await supabase.rpc("record_operational_event", {
    p_restaurant_id: restaurantId,
    p_correlation_id: requestId,
    p_component: "messaging-dispatcher",
    p_event_name: eventName,
    p_severity: severity,
    p_metadata: metadata,
  })
  if (error) logEvent("warn", "observability.persist_failed", requestId, { error_class: error.code ?? "DatabaseError" })
}

Deno.serve(async (req) => {
  const requestId = correlationId(req)
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...correlationHeaders(requestId) },
  })
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405)
  if (!secretMatches(req, "x-atiende-internal-secret", "INTERNAL_WEBHOOK_SECRET")) {
    logEvent("warn", "dispatcher.unauthorized", requestId)
    return respond({ error: "Unauthorized" }, 401)
  }
  const worker = req.headers.get("x-atiende-worker") || crypto.randomUUID()
  const { data: jobs, error } = await supabase.rpc("claim_messaging_outbox_batch", {
    p_worker_id: worker, p_limit: 20, p_lease_seconds: 120,
  })
  if (error) {
    logEvent("error", "dispatcher.claim_failed", requestId, { error_class: error.code ?? "DatabaseError" })
    return respond({ error: "Unable to claim outbox" }, 503)
  }
  let sent = 0
  for (const job of jobs ?? []) {
    let failure: string | null = null
    try {
      const payload = job.payload ?? {}
      if (job.channel === "whatsapp") {
        const token = await secret("WHATSAPP_ACCESS_TOKEN")
        const phoneNumberId = await secret("WHATSAPP_PHONE_NUMBER_ID")
        if (!token || !phoneNumberId) throw new Error("WhatsApp credentials unavailable")
        const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ messaging_product: "whatsapp", to: payload.to, type: "text", text: { body: payload.body } }),
        })
        if (!response.ok) throw new Error(`WhatsApp provider status ${response.status}`)
      } else if (job.channel === "email") {
        const endpoint = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-order-notification`
        const response = await fetch(endpoint, {
          method: "POST", headers: { "Content-Type": "application/json", "x-atiende-internal-secret": Deno.env.get("INTERNAL_WEBHOOK_SECRET") ?? "" },
          body: JSON.stringify(payload),
        })
        if (!response.ok) throw new Error(`email dispatcher status ${response.status}`)
      } else throw new Error("Unsupported outbox channel")
      const { data: completed } = await supabase.rpc("complete_messaging_outbox", {
        p_id: job.id, p_fence_token: job.fence_token, p_status: "sent",
      })
      if (!completed) throw new Error("stale outbox fence")
      sent++
      logEvent("info", "dispatcher.sent", requestId, { channel: job.channel, job_id: job.id })
      await recordEvent(job.restaurant_id, requestId, "dispatcher.sent", "info", {
        channel: job.channel,
        job_id: job.id,
      })
    } catch (err) {
      failure = err instanceof Error ? err.message : "dispatch failure"
      logEvent("error", "dispatcher.failed", requestId, {
        channel: job.channel,
        job_id: job.id,
        error_class: err instanceof Error ? err.constructor.name : "UnknownError",
      })
      await recordEvent(job.restaurant_id, requestId, "dispatcher.failed", "error", {
        channel: job.channel,
        job_id: job.id,
        error_class: err instanceof Error ? err.constructor.name : "UnknownError",
      })
      await supabase.rpc("complete_messaging_outbox", {
        p_id: job.id, p_fence_token: job.fence_token, p_status: "failed",
        p_error: failure, p_retry_seconds: Math.min(3600, 2 ** Math.min(job.attempts, 10) * 10), p_max_attempts: 8,
      })
    }
  }
  return respond({ claimed: jobs?.length ?? 0, sent })
})
