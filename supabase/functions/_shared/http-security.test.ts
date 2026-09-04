import {
  actorHash,
  constantTimeEqual,
  corsHeaders,
  HttpInputError,
  originAllowed,
  preflightResponse,
  readJson,
  requestActor,
} from "./http-security.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

Deno.test("secret comparison rejects missing and wrong values", () => {
  assert(!constantTimeEqual(null, "secret"), "missing secret was accepted");
  assert(!constantTimeEqual("wrong", "secret"), "wrong secret was accepted");
  assert(constantTimeEqual("secret", "secret"), "valid secret was rejected");
});

Deno.test("origin allowlist is exact and server-to-server remains valid", () => {
  const allowed = ["https://useatiende.ai"];
  assert(
    originAllowed("https://useatiende.ai", allowed),
    "known origin rejected",
  );
  assert(
    !originAllowed("https://useatiende.ai.evil.test", allowed),
    "suffix origin accepted",
  );
  assert(originAllowed(null, allowed), "server request rejected");
});

Deno.test("production panel origins are allowed without accepting arbitrary previews", () => {
  assert(originAllowed("https://app.useatiende.ai"), "software domain rejected");
  assert(!originAllowed("https://app.useatiende.ai.evil.test"), "lookalike software domain accepted");
  assert(
    originAllowed("https://atiende-restaurantes.vercel.app"),
    "canonical production origin rejected",
  );
  assert(
    originAllowed("https://atiende-restaurantes-likida.vercel.app"),
    "production alias rejected",
  );
  assert(
    originAllowed("https://atiende-restaurantes-git-main-likida.vercel.app"),
    "main alias rejected",
  );
  assert(
    !originAllowed("https://atiende-restaurantes-evil-likida.vercel.app"),
    "arbitrary deployment origin accepted",
  );
});

Deno.test("disallowed CORS origin is never reflected", () => {
  const headers = corsHeaders(
    new Request("https://edge.test", {
      headers: { Origin: "https://evil.test" },
    }),
  );
  assert(
    !("Access-Control-Allow-Origin" in headers),
    "disallowed origin was reflected",
  );
});

Deno.test("disallowed preflight returns 403", async () => {
  const response = preflightResponse(
    new Request("https://edge.test", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.test" },
    }),
  );
  assert(response.status === 403, `unexpected status ${response.status}`);
  assert(
    (await response.json()).error === "Origen no permitido",
    "unexpected response body",
  );
});

Deno.test("readJson rejects invalid JSON with a safe 400", async () => {
  try {
    await readJson(
      new Request("https://edge.test", { method: "POST", body: "{" }),
    );
    throw new Error("invalid JSON was accepted");
  } catch (error) {
    assert(
      error instanceof HttpInputError && error.status === 400,
      "wrong invalid-json error",
    );
  }
});

Deno.test("readJson enforces the byte limit", async () => {
  try {
    await readJson(
      new Request("https://edge.test", {
        method: "POST",
        body: JSON.stringify({ value: "123456" }),
      }),
      4,
    );
    throw new Error("oversized body was accepted");
  } catch (error) {
    assert(
      error instanceof HttpInputError && error.status === 413,
      "wrong payload-limit error",
    );
  }
});

Deno.test("actor hash is deterministic and does not contain PII", async () => {
  const actor = "203.0.113.4:+529999999999";
  const first = await actorHash(actor);
  const second = await actorHash(actor);
  assert(first === second, "hash is not deterministic");
  assert(/^[0-9a-f]{64}$/.test(first), "hash format is invalid");
  assert(!first.includes("999999"), "hash contains source PII");
});

Deno.test("rate actor ignores attacker-controlled forwarded prefixes", () => {
  const req = new Request("https://edge.test", {
    headers: { "x-forwarded-for": "198.51.100.7, 203.0.113.9" },
  });
  assert(requestActor(req) === "203.0.113.9:", "untrusted forwarded prefix selected");
});
