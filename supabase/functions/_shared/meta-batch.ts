export type MetaTextMessage = {
  id: string
  from: string
  type: "text"
  text: { body: string }
}

export function extractMetaTextMessages(payload: unknown): MetaTextMessage[] {
  const root = payload as { entry?: unknown }
  if (!Array.isArray(root?.entry)) return []
  const result: MetaTextMessage[] = []
  for (const entry of root.entry) {
    const changes = (entry as { changes?: unknown })?.changes
    if (!Array.isArray(changes)) continue
    for (const change of changes) {
      const messages = (change as { value?: { messages?: unknown } })?.value?.messages
      if (!Array.isArray(messages)) continue
      for (const candidate of messages) {
        const message = candidate as Partial<MetaTextMessage>
        if (
          message.type === "text" && typeof message.id === "string" &&
          message.id.length >= 1 && message.id.length <= 255 &&
          typeof message.from === "string" && /^\d{7,20}$/.test(message.from) &&
          typeof message.text?.body === "string" &&
          message.text.body.trim().length >= 1 && message.text.body.length <= 4000
        ) result.push(message as MetaTextMessage)
      }
    }
  }
  return result
}
