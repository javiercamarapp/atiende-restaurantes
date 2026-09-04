const CORRELATION_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/
const SENSITIVE_KEY = /(authorization|token|secret|password|phone|address|email|payload|body)/i

export function correlationId(req: Request): string {
  const incoming = req.headers.get("x-correlation-id")?.trim() ?? ""
  return CORRELATION_PATTERN.test(incoming) ? incoming : crypto.randomUUID()
}

export function correlationHeaders(id: string): Record<string, string> {
  return { "X-Correlation-Id": id }
}

function safeValue(value: unknown): unknown {
  if (typeof value === "string") return value.slice(0, 240)
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value
  return undefined
}

export function sanitizeMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => !SENSITIVE_KEY.test(key))
      .map(([key, value]) => [key.slice(0, 80), safeValue(value)])
      .filter(([, value]) => value !== undefined),
  )
}

export function logEvent(
  level: "info" | "warn" | "error",
  event: string,
  correlation: string,
  metadata: Record<string, unknown> = {},
) {
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event: event.slice(0, 120),
    correlation_id: correlation,
    ...sanitizeMetadata(metadata),
  })
  if (level === "error") console.error(record)
  else if (level === "warn") console.warn(record)
  else console.info(record)
}
