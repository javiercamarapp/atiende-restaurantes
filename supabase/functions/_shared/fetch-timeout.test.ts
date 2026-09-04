import { fetchWithTimeout, ProviderTimeoutError } from "./fetch-timeout.ts"

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

Deno.test("provider fetch returns a timely response", async () => {
  const response = await fetchWithTimeout(
    "https://provider.invalid",
    {},
    50,
    async () => new Response("ok", { status: 200 }),
  )
  assert(response.status === 200, "timely response was not returned")
})

Deno.test("provider fetch aborts and classifies a timeout", async () => {
  try {
    await fetchWithTimeout(
      "https://provider.invalid",
      {},
      5,
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
        }),
    )
    throw new Error("hung provider request completed")
  } catch (error) {
    assert(error instanceof ProviderTimeoutError, "timeout was not classified")
  }
})
