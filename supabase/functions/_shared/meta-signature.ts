function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

function constantTimeHexEqual(actual: string, expected: string): boolean {
  const length = Math.max(actual.length, expected.length)
  let difference = actual.length ^ expected.length
  for (let index = 0; index < length; index += 1) {
    difference |=
      (actual.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0)
  }
  return difference === 0
}

export async function verifyMetaSignature(
  rawBody: Uint8Array,
  signatureHeader: string | null,
  appSecret: string | null,
): Promise<boolean> {
  if (!signatureHeader?.startsWith("sha256=") || !appSecret) return false
  const supplied = signatureHeader.slice("sha256=".length).toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(supplied)) return false
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const expected = hex(await crypto.subtle.sign("HMAC", key, rawBody))
  return constantTimeHexEqual(supplied, expected)
}
