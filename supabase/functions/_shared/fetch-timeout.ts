export class ProviderTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Provider request exceeded ${timeoutMs}ms`)
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 30_000,
  implementation: typeof globalThis.fetch = globalThis.fetch,
): Promise<Response> {
  const controller = new AbortController()
  const signal = init.signal
    ? AbortSignal.any([init.signal, controller.signal])
    : controller.signal
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await implementation(input, { ...init, signal })
  } catch (error) {
    if (controller.signal.aborted) throw new ProviderTimeoutError(timeoutMs)
    throw error
  } finally {
    clearTimeout(timer)
  }
}
