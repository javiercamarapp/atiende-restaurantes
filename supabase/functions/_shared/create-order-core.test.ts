import { createOrderCore, OrderValidationError } from "./create-order-core.ts"

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
