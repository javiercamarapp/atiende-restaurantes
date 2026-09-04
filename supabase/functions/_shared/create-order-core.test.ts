import { createOrderCore, OrderValidationError } from "./create-order-core.ts"
import * as orderCore from "./create-order-core.ts"

async function rejectsValidation(payload: unknown) {
  try {
    await createOrderCore(null, payload as never)
    throw new Error("payload was accepted")
  } catch (error) {
    if (!(error instanceof OrderValidationError)) throw error
  }
}

Deno.test("order rejects non-object and missing identity", async () => {
  await rejectsValidation(null)
  await rejectsValidation({})
})

Deno.test("order rejects oversized customer-controlled fields", async () => {
  await rejectsValidation({
    branch_slug: "test",
    customer_name: "x".repeat(161),
    customer_phone: "9991111111",
    items: [{ product_id: "p", quantity: 1 }],
  })
})

Deno.test("order rejects excessive item count and quantities", async () => {
  const base = {
    branch_slug: "test",
    customer_name: "Test",
    customer_phone: "9991111111",
  }
  await rejectsValidation({ ...base, items: Array.from({ length: 101 }, () => ({ product_id: "p", quantity: 1 })) })
  await rejectsValidation({ ...base, items: [{ product_id: "p", quantity: 101 }] })
})

Deno.test("quote converts requested pieces into menu units and computes the exact total", () => {
  const buildQuote = (orderCore as Record<string, unknown>)
    .buildOrderQuoteFromProducts
  if (typeof buildQuote !== "function") {
    throw new Error("buildOrderQuoteFromProducts is not implemented")
  }

  const quote = buildQuote(
    [
      { product_id: "pastor", requested_quantity: 8, tortilla: "maiz" },
      { product_id: "bistec", requested_quantity: 3, tortilla: "harina" },
      { product_id: "quesobich", requested_quantity: 1 },
      { product_id: "coca", requested_quantity: 10 },
    ],
    [
      {
        id: "pastor",
        name: "Taco Al Pastor (individual)",
        price: 42,
        pack_size: 1,
      },
      {
        id: "bistec",
        name: "Tacos de Bistec de Res (orden de 3)",
        price: 194,
        pack_size: 3,
      },
      {
        id: "quesobich",
        name: "Quesobich de Queso",
        price: 206,
        pack_size: 1,
      },
      {
        id: "coca",
        name: "Coca-Cola",
        price: 53,
        pack_size: null,
      },
    ],
  ) as {
    total: number
    items: Array<{ product_id: string; quantity: number }>
  }

  if (quote.total !== 1266) {
    throw new Error(`expected total 1266, got ${quote.total}`)
  }
  const expectedItems = [
    { product_id: "pastor", quantity: 8, tortilla: "maiz" },
    { product_id: "bistec", quantity: 1, tortilla: "harina" },
    { product_id: "quesobich", quantity: 1 },
    { product_id: "coca", quantity: 10 },
  ]
  if (JSON.stringify(quote.items) !== JSON.stringify(expectedItems)) {
    throw new Error(
      `expected normalized menu units ${JSON.stringify(expectedItems)}, got ${JSON.stringify(quote.items)}`,
    )
  }
})

Deno.test("quote rejects every non-multiple for an order of three", () => {
  const buildQuote = (orderCore as Record<string, unknown>)
    .buildOrderQuoteFromProducts
  if (typeof buildQuote !== "function") {
    throw new Error("buildOrderQuoteFromProducts is not implemented")
  }

  for (const requested_quantity of [1, 2, 4, 5]) {
    try {
      buildQuote(
        [{ product_id: "bistec", requested_quantity, tortilla: "maiz" }],
        [{
          id: "bistec",
          name: "Tacos de Bistec de Res (orden de 3)",
          price: 194,
          pack_size: 3,
        }],
      )
      throw new Error(`accepted invalid requested quantity ${requested_quantity}`)
    } catch (error) {
      if (!(error instanceof OrderValidationError)) throw error
      if (!error.message.includes("órdenes de 3")) {
        throw new Error(`unexpected validation message: ${error.message}`)
      }
    }
  }
})

Deno.test("quote blocks every taco line until its tortilla is confirmed", () => {
  const buildQuote = (orderCore as Record<string, unknown>)
    .buildOrderQuoteFromProducts as (
      items: Array<Record<string, unknown>>,
      products: Array<Record<string, unknown>>,
    ) => unknown
  let rejected = false
  try {
    buildQuote(
      [{ product_id: "pastor", requested_quantity: 8 }],
      [{
        id: "pastor",
        name: "Taco Al Pastor (individual)",
        price: 42,
        pack_size: 1,
      }],
    )
  } catch (error) {
    if (!(error instanceof OrderValidationError)) throw error
    if (!error.message.includes("maíz o harina")) throw error
    rejected = true
  }
  if (!rejected) throw new Error("accepted a taco line without tortilla")
})

Deno.test("quote never persists a tortilla on products that are not tacos", () => {
  const buildQuote = (orderCore as Record<string, unknown>)
    .buildOrderQuoteFromProducts as (
      items: Array<Record<string, unknown>>,
      products: Array<Record<string, unknown>>,
    ) => { items: Array<Record<string, unknown>>; lines: Array<Record<string, unknown>> }
  const quote = buildQuote(
    [{ product_id: "coca", requested_quantity: 10, tortilla: "maiz" }],
    [{
      id: "coca",
      name: "Coca-Cola",
      price: 53,
      pack_size: null,
    }],
  )
  if ("tortilla" in quote.items[0] || quote.lines[0].tortilla !== null) {
    throw new Error(`persisted tortilla on a drink: ${JSON.stringify(quote)}`)
  }
})

Deno.test("voice preview mode is trusted only from the authenticated tool", () => {
  const isTrustedPreview = (orderCore as Record<string, unknown>)
    .isTrustedVoicePreview
  if (typeof isTrustedPreview !== "function") {
    throw new Error("isTrustedVoicePreview is not implemented")
  }
  const check = isTrustedPreview as (
    authorized: boolean,
    value: unknown,
  ) => boolean
  for (const value of [true, "true", "TRUE"]) {
    if (!check(true, value)) throw new Error(`rejected trusted value ${value}`)
    if (check(false, value)) throw new Error(`accepted untrusted value ${value}`)
  }
  for (const value of [false, "false", undefined, 1]) {
    if (check(true, value)) throw new Error(`accepted invalid value ${value}`)
  }
})

Deno.test("alcohol requires an explicit adult confirmation but zero-alcohol drinks do not", () => {
  const buildQuote = (orderCore as Record<string, unknown>)
    .buildOrderQuoteFromProducts as (
      items: Array<Record<string, unknown>>,
      products: Array<Record<string, unknown>>,
      options?: Record<string, unknown>,
    ) => unknown
  const cerveza = [{
    id: "sol",
    name: "Sol",
    price: 80,
    pack_size: null,
    requires_adult_confirmation: true,
  }]
  try {
    buildQuote([{ product_id: "sol", requested_quantity: 2 }], cerveza)
    throw new Error("accepted alcohol without an adult confirmation")
  } catch (error) {
    if (!(error instanceof OrderValidationError)) throw error
    if (!error.message.includes("mayor de edad")) throw error
  }

  buildQuote(
    [{ product_id: "sol", requested_quantity: 2 }],
    cerveza,
    { adult_confirmed: true },
  )
  buildQuote(
    [{ product_id: "heineken-cero", requested_quantity: 1 }],
    [{
      id: "heineken-cero",
      name: "Heineken 0.0",
      price: 80,
      pack_size: null,
      requires_adult_confirmation: false,
    }],
  )
})

Deno.test("only successful orders are eligible for customer recommendations", () => {
  const eligible = (orderCore as Record<string, unknown>)
    .isOrderEligibleForRecommendations
  if (typeof eligible !== "function") {
    throw new Error("isOrderEligibleForRecommendations is not implemented")
  }
  const check = eligible as (status: unknown) => boolean
  for (const status of [
    "pending",
    "preparando",
    "en_camino",
    "entregado",
    "completado",
  ]) {
    if (!check(status)) throw new Error(`rejected eligible status ${status}`)
  }
  for (const status of ["cancelado", "problema", "cancelled", null]) {
    if (check(status)) throw new Error(`recommended ineligible status ${status}`)
  }
})

Deno.test("product search ignores spoken quantities and category filler", () => {
  const tokenize = (orderCore as Record<string, unknown>)
    .tokenizeForProductSearch
  if (typeof tokenize !== "function") {
    throw new Error("tokenizeForProductSearch is not implemented")
  }
  const tokens = (tokenize as (query: string) => string[])(
    "quiero dos cervezas Sol",
  )
  if (JSON.stringify(tokens) !== JSON.stringify(["sol"])) {
    throw new Error(`expected a single product token, got ${tokens}`)
  }
  const zeroAlcohol = (tokenize as (query: string) => string[])(
    "dos Heineken cero punto cero",
  )
  if (JSON.stringify(zeroAlcohol) !== JSON.stringify(["heineken", "0.0"])) {
    throw new Error(`expected spoken 0.0 normalization, got ${zeroAlcohol}`)
  }
})
