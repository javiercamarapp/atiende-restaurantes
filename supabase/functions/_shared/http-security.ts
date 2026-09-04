const DEFAULT_ORIGINS = [
  "https://www.useatiende.ai",
  "https://useatiende.ai",
  "http://localhost:5173",
  "http://localhost:4173",
];

export class HttpInputError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function configuredOrigins(): string[] {
  return (Deno.env.get("ALLOWED_ORIGINS") ?? DEFAULT_ORIGINS.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function originAllowed(
  origin: string | null,
  allowed = configuredOrigins(),
): boolean {
  return origin === null || allowed.includes(origin);
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-atiende-tool-secret, x-atiende-internal-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (origin && originAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export function preflightResponse(req: Request): Response {
  if (!originAllowed(req.headers.get("Origin"))) {
    return jsonResponse(req, { error: "Origen no permitido" }, 403);
  }
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export function constantTimeEqual(
  actual: string | null,
  expected: string | undefined,
): boolean {
  if (!actual || !expected) return false;
  const encoder = new TextEncoder();
  const actualBytes = encoder.encode(actual);
  const expectedBytes = encoder.encode(expected);
  const length = Math.max(actualBytes.length, expectedBytes.length);
  let difference = actualBytes.length ^ expectedBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (actualBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
  }
  return difference === 0;
}

export function secretMatches(
  req: Request,
  header: string,
  envName: string,
): boolean {
  return constantTimeEqual(req.headers.get(header), Deno.env.get(envName));
}

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
  extra: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
      ...extra,
    },
  });
}

export async function actorHash(actor: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(actor),
  );
  return Array.from(new Uint8Array(bytes)).map((b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

export function requestActor(req: Request, secondary = ""): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${forwarded || "unknown"}:${secondary.slice(0, 128)}`;
}

// deno-lint-ignore no-explicit-any
export async function consumeRateLimit(
  supabase: any,
  scope: string,
  actor: string,
  maxRequests: number,
  windowSeconds: number,
) {
  const hash = await actorHash(actor);
  const { data, error } = await supabase.rpc("consume_api_rate_limit", {
    p_scope: scope,
    p_actor_hash: hash,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  });
  return { allowed: error === null && data === true, error };
}

export async function readJson<T = unknown>(
  req: Request,
  maxBytes = 64 * 1024,
): Promise<T> {
  const length = Number(req.headers.get("content-length") ?? 0);
  if (!Number.isFinite(length) || length < 0 || length > maxBytes) {
    throw new HttpInputError("Payload demasiado grande", 413);
  }
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw new HttpInputError("Payload demasiado grande", 413);
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpInputError("JSON inválido", 400);
  }
}
