// Dispatcher server-to-server del outbox. Solo acepta el secreto interno y
// usa el fence_token emitido por SQL: un worker viejo nunca puede completar
// el trabajo reclamado por otro worker.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { fetchWithTimeout as fetch } from "../_shared/fetch-timeout.ts"

const GRAPH_API_VERSION = "v25.0"
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

async function secret(name: string) {
  const { data } = await supabase.rpc("get_secret", { secret_name: name })
  return data as string | null
}

Deno.serve(async (req) => {
  if (req.method !== "POST" || req.headers.get("x-atiende-internal-secret") !== Deno.env.get("INTERNAL_WEBHOOK_SECRET")) {
    return new Response("Unauthorized", { status: 401 })
  }
  const worker = req.headers.get("x-atiende-worker") || crypto.randomUUID()
  const { data: jobs, error } = await supabase.rpc("claim_messaging_outbox_batch", {
    p_worker_id: worker, p_limit: 20, p_lease_seconds: 120,
  })
  if (error) return new Response("Unable to claim outbox", { status: 503 })
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
    } catch (err) {
      failure = err instanceof Error ? err.message : "dispatch failure"
      await supabase.rpc("complete_messaging_outbox", {
        p_id: job.id, p_fence_token: job.fence_token, p_status: "failed",
        p_error: failure, p_retry_seconds: Math.min(3600, 2 ** Math.min(job.attempts, 10) * 10), p_max_attempts: 8,
      })
    }
  }
  return new Response(JSON.stringify({ claimed: jobs?.length ?? 0, sent }), {
    headers: { "Content-Type": "application/json" },
  })
})
