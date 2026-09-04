import { extractMetaTextMessages } from "./meta-batch.ts"

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

Deno.test("Meta batch preserves entry/change/message order and rejects invalid events", () => {
  const payload = { entry: [
    { changes: [{ value: { messages: [
      { id: "m1", from: "529999999999", type: "text", text: { body: "uno" } },
      { id: "image", from: "529999999999", type: "image" },
    ] } }] },
    { changes: [
      { value: { statuses: [{ id: "status" }] } },
      { value: { messages: [
        { id: "m2", from: "529999999999", type: "text", text: { body: "dos" } },
        { id: "m3", from: "bad", type: "text", text: { body: "tres" } },
      ] } },
    ] },
  ] }
  const messages = extractMetaTextMessages(payload)
  assert(messages.map((message) => message.id).join(",") === "m1,m2", "batch order/filter failed")
})

Deno.test("Meta batch soak extracts 25k messages deterministically", () => {
  const messages = Array.from({ length: 50 }, (_, index) => ({
    id: `m-${index}`,
    from: "529999999999",
    type: "text",
    text: { body: `pedido ${index}` },
  }))
  const payload = { entry: [{ changes: [{ value: { messages } }] }] }
  const started = performance.now()
  let total = 0
  for (let run = 0; run < 500; run++) total += extractMetaTextMessages(payload).length
  assert(total === 25_000, "soak lost messages")
  assert(performance.now() - started < 2_000, "batch parser exceeded local budget")
})
