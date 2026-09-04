import { correlationId, sanitizeMetadata } from "./observability.ts"

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

Deno.test("correlation id accepts bounded trace and rejects hostile input", () => {
  const accepted = correlationId(new Request("https://edge.test", {
    headers: { "x-correlation-id": "trace-12345678" },
  }))
  assert(accepted === "trace-12345678", "valid trace changed")
  const generated = correlationId(new Request("https://edge.test", {
    headers: { "x-correlation-id": "bad trace value" },
  }))
  assert(/^[0-9a-f-]{36}$/.test(generated), "invalid trace was trusted")
})

Deno.test("structured metadata drops PII and secrets", () => {
  const safe = sanitizeMetadata({
    status: 503,
    phone: "+529999999999",
    Authorization: "Bearer secret",
    message: "provider timeout",
    nested: { token: "hidden" },
  })
  assert(safe.status === 503 && safe.message === "provider timeout", "safe fields lost")
  assert(!("phone" in safe) && !("Authorization" in safe) && !("nested" in safe), "sensitive metadata survived")
})
