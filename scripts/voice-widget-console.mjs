import { createInterface } from "node:readline";
import { Conversation } from "@elevenlabs/client";

const agentId = process.env.ATIENDE_VOICE_AGENT_ID;
if (!agentId) {
  throw new Error("Falta ATIENDE_VOICE_AGENT_ID");
}

const modoPrueba = process.env.ATIENDE_VOICE_TEST_MODE !== "false";
const saludo = process.env.ATIENDE_VOICE_GREETING ?? "Buenos días";
let closed = false;

const conversation = await Conversation.startSession({
  agentId,
  textOnly: true,
  dynamicVariables: {
    modo_prueba: modoPrueba ? "true" : "false",
    saludo,
  },
  toolMockConfig: {
    mockingStrategy: "none",
    fallbackStrategy: "call_real_tool",
  },
  onConnect: ({ conversationId }) => {
    console.log(`CONECTADO ${conversationId}`);
  },
  onMessage: ({ role, message }) => {
    console.log(`${role === "agent" ? "AGENTE" : "CLIENTE"}: ${message}`);
  },
  onAgentToolResponse: (event) => {
    const toolName = event.tool_name ?? event.name ?? "desconocida";
    const isError = event.is_error === true || Boolean(event.error);
    console.log(`HERRAMIENTA ${toolName}: ${isError ? "ERROR" : "OK"}`);
  },
  onError: (message) => {
    console.error(`ERROR: ${message}`);
  },
  onDisconnect: (details) => {
    closed = true;
    console.log(`DESCONECTADO ${details.reason}`);
  },
});

const input = createInterface({ input: process.stdin, terminal: false });
input.on("line", async (line) => {
  const text = line.trim();
  if (!text) return;
  if (text === ":quit") {
    if (!closed) await conversation.endSession();
    input.close();
    return;
  }
  if (closed) {
    console.error("ERROR: la conversación ya terminó");
    return;
  }
  conversation.sendUserMessage(text);
});

process.on("SIGINT", async () => {
  if (!closed) await conversation.endSession();
  process.exit(130);
});
