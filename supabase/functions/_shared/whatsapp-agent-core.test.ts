import * as whatsappCore from "./whatsapp-agent-core.ts"

function functionTool(name: string) {
  const tools = whatsappCore.TOOLS as Array<Record<string, unknown>>
  return tools.find((tool) =>
    (tool.function as { name?: string } | undefined)?.name === name
  ) as {
    function?: {
      parameters?: {
        properties?: Record<string, {
          items?: { properties?: Record<string, unknown> }
        }>
      }
    }
  } | undefined
}

Deno.test("WhatsApp always explains bistec packs and unlimited individual pastor quantities", () => {
  const rules = (whatsappCore as Record<string, unknown>).ORDER_QUANTITY_RULES
  if (typeof rules !== "string") {
    throw new Error("ORDER_QUANTITY_RULES is not implemented")
  }
  for (const requiredText of [
    "siempre que mencionen tacos de bistec",
    "órdenes de 3",
    "cualquier cantidad entera positiva",
    "para cada estilo o renglón de tacos",
    "tortilla de maíz o de harina",
    "mayor de edad",
    "nunca cierres un turno",
    "prohibido preguntar efectivo/tarjeta",
    "cotizar_pedido",
  ]) {
    if (!rules.toLowerCase().includes(requiredText)) {
      throw new Error(`missing hard quantity rule: ${requiredText}`)
    }
  }
})

Deno.test("WhatsApp quotes and creates with customer-requested quantities", () => {
  const quoteTool = functionTool("cotizar_pedido")
  if (!quoteTool) throw new Error("cotizar_pedido tool is not implemented")
  const createTool = functionTool("crear_pedido")
  if (!createTool) throw new Error("crear_pedido tool is missing")

  for (const [name, tool] of [["cotizar_pedido", quoteTool], ["crear_pedido", createTool]] as const) {
    const itemProperties = tool.function?.parameters?.properties?.items?.items
      ?.properties ?? {}
    if (!("requested_quantity" in itemProperties)) {
      throw new Error(`${name} must require requested_quantity`)
    }
    if ("quantity" in itemProperties) {
      throw new Error(`${name} must not expose ambiguous quantity`)
    }
    if (!("tortilla" in itemProperties)) {
      throw new Error(`${name} must carry the tortilla choice per taco line`)
    }
    const properties = tool.function?.parameters?.properties ?? {}
    if (!("adult_confirmed" in properties)) {
      throw new Error(`${name} must carry explicit adult confirmation`)
    }
  }
})

Deno.test("every reply to a bistec request states that orders contain three tacos", () => {
  const enforceNotice = (whatsappCore as Record<string, unknown>)
    .enforceBistecPackNotice
  if (typeof enforceNotice !== "function") {
    throw new Error("enforceBistecPackNotice is not implemented")
  }
  const result = (enforceNotice as (
    reply: string,
    messages: Array<{ role: string; content: string }>,
  ) => string)(
    "¡Claro! ¿Me compartes tu nombre, por favor?",
    [{ role: "user", content: "Quiero cuatro tacos de bistec" }],
  )
  if (!result.toLowerCase().includes("órdenes de 3")) {
    throw new Error(`missing deterministic bistec notice: ${result}`)
  }
})

Deno.test("an agent turn preserves the caller history so the full turn can be appended", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (() =>
    Promise.resolve(new Response(JSON.stringify({
      choices: [{ message: { role: "assistant", content: "Respuesta QA" } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }))) as typeof fetch

  const configChain = {
    select() {
      return this
    },
    eq() {
      return this
    },
    maybeSingle() {
      return Promise.resolve({ data: null, error: null })
    },
  }
  const supabase = {
    from() {
      return configChain
    },
    rpc() {
      return Promise.resolve({ data: "test-openrouter-key", error: null })
    },
  }
  const messages = [{ role: "user", content: "Hola" }]
  try {
    const result = await whatsappCore.runAgentTurn(
      supabase,
      messages,
      "widget-qa-test",
      { is_new: true },
      whatsappCore.RESTAURANT_ID,
    )
    if (messages.length !== 1) {
      throw new Error(`caller history was mutated to ${messages.length} messages`)
    }
    if (result.updatedMessages.length !== 2) {
      throw new Error(
        `expected user + assistant in returned history, got ${result.updatedMessages.length}`,
      )
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})

Deno.test("a transient primary-provider failure retries once with the cross-provider backup", async () => {
  const originalFetch = globalThis.fetch
  const models: string[] = []
  let attempt = 0
  globalThis.fetch = ((_: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"))
    models.push(body.model)
    attempt++
    if (attempt === 1) return Promise.resolve(new Response("busy", { status: 503 }))
    return Promise.resolve(new Response(JSON.stringify({
      choices: [{ message: { role: "assistant", content: "Respaldo activo" } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }))
  }) as typeof fetch

  const configChain = {
    select() { return this },
    eq() { return this },
    maybeSingle() { return Promise.resolve({ data: null, error: null }) },
  }
  const supabase = {
    from() { return configChain },
    rpc() { return Promise.resolve({ data: "test-openrouter-key", error: null }) },
  }
  try {
    const result = await whatsappCore.runAgentTurn(
      supabase,
      [{ role: "user", content: "Hola" }],
      "widget-qa-fallback",
      { is_new: true },
      whatsappCore.RESTAURANT_ID,
    )
    const expected = [whatsappCore.MODEL_DEFAULT, whatsappCore.MODEL_RESPALDO]
    if (JSON.stringify(models) !== JSON.stringify(expected)) {
      throw new Error(`expected model cascade ${expected}, got ${models}`)
    }
    if (result.reply !== "Respaldo activo") {
      throw new Error(`unexpected backup reply: ${result.reply}`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})
