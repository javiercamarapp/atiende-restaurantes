import { verifyMetaSignature } from "./meta-signature.ts"

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const body = new TextEncoder().encode('{"entry":[]}')
const valid =
  "sha256=5c12cee8c89f16c81647beec6d874ab35c12af18787cc4bbbd623e650ce7ecf5"

Deno.test("Meta signature accepts a known valid HMAC", async () => {
  assert(
    await verifyMetaSignature(body, valid, "test-secret"),
    "valid signature rejected",
  )
})

Deno.test(
  "Meta signature rejects absent, malformed and forged values",
  async () => {
    assert(
      !(await verifyMetaSignature(body, null, "test-secret")),
      "missing signature accepted",
    )
    assert(
      !(await verifyMetaSignature(body, "sha1=abc", "test-secret")),
      "wrong algorithm accepted",
    )
    assert(
      !(await verifyMetaSignature(
        body,
        `sha256=${"0".repeat(64)}`,
        "test-secret",
      )),
      "forged signature accepted",
    )
    assert(
      !(await verifyMetaSignature(body, valid, null)),
      "missing app secret accepted",
    )
  },
)
