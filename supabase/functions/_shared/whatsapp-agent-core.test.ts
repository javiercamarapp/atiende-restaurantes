import * as whatsappCore from "./whatsapp-agent-core.ts";

function functionTool(name: string) {
  const tools = whatsappCore.TOOLS as Array<Record<string, unknown>>;
  return tools.find((tool) =>
    (tool.function as { name?: string } | undefined)?.name === name
  ) as {
    function?: {
      parameters?: {
        properties?: Record<string, {
          items?: { properties?: Record<string, unknown> };
        }>;
      };
    };
  } | undefined;
}

Deno.test("WhatsApp always explains bistec packs and unlimited individual pastor quantities", () => {
  const rules = (whatsappCore as Record<string, unknown>).ORDER_QUANTITY_RULES;
  if (typeof rules !== "string") {
    throw new Error("ORDER_QUANTITY_RULES is not implemented");
  }
  for (
    const requiredText of [
      "siempre que mencionen tacos de bistec",
      "órdenes de 3",
      "cualquier cantidad entera positiva",
      "para cada estilo o renglón de tacos",
      "tortilla de maíz o de harina",
      "mayor de edad",
      "nunca cierres un turno",
      "prohibido preguntar efectivo/tarjeta",
      "cotizar_pedido",
    ]
  ) {
    if (!rules.toLowerCase().includes(requiredText)) {
      throw new Error(`missing hard quantity rule: ${requiredText}`);
    }
  }
});

Deno.test("WhatsApp quotes and creates with customer-requested quantities", () => {
  const quoteTool = functionTool("cotizar_pedido");
  if (!quoteTool) throw new Error("cotizar_pedido tool is not implemented");
  const createTool = functionTool("crear_pedido");
  if (!createTool) throw new Error("crear_pedido tool is missing");

  for (
    const [name, tool] of [["cotizar_pedido", quoteTool], [
      "crear_pedido",
      createTool,
    ]] as const
  ) {
    const itemProperties = tool.function?.parameters?.properties?.items?.items
      ?.properties ?? {};
    if (!("requested_quantity" in itemProperties)) {
      throw new Error(`${name} must require requested_quantity`);
    }
    if (!("product_name" in itemProperties)) {
      throw new Error(
        `${name} must carry the exact product name as an ID recovery key`,
      );
    }
    if ("quantity" in itemProperties) {
      throw new Error(`${name} must not expose ambiguous quantity`);
    }
    if (!("tortilla" in itemProperties)) {
      throw new Error(`${name} must carry the tortilla choice per taco line`);
    }
    const properties = tool.function?.parameters?.properties ?? {};
    if (!("adult_confirmed" in properties)) {
      throw new Error(`${name} must carry explicit adult confirmation`);
    }
  }
  const createProperties = createTool.function?.parameters?.properties ?? {};
  for (const field of ["requested_complements", "omit_default_complements"]) {
    if (!(field in createProperties)) {
      throw new Error(`crear_pedido must carry ${field}`);
    }
  }
});

Deno.test("WhatsApp treats default and request-only complements as free kitchen metadata", () => {
  const prompt = String(
    (whatsappCore as Record<string, unknown>).BASE_SYSTEM_PROMPT ?? "",
  )
    .toLowerCase();
  for (
    const text of [
      "salsa verde, salsa roja, limones y cebolla",
      "salsa habanero y crema de ajo",
      "no llames a buscar_producto",
      "sin costo",
    ]
  ) {
    if (!prompt.includes(text)) {
      throw new Error(`missing complement rule: ${text}`);
    }
  }
});

Deno.test("every reply to a bistec request states that orders contain three tacos", () => {
  const enforceNotice = (whatsappCore as Record<string, unknown>)
    .enforceBistecPackNotice;
  if (typeof enforceNotice !== "function") {
    throw new Error("enforceBistecPackNotice is not implemented");
  }
  const result = (enforceNotice as (
    reply: string,
    messages: Array<{ role: string; content: string }>,
  ) => string)(
    "¡Claro! ¿Me compartes tu nombre, por favor?",
    [{ role: "user", content: "Quiero cuatro tacos de bistec" }],
  );
  if (!result.toLowerCase().includes("órdenes de 3")) {
    throw new Error(`missing deterministic bistec notice: ${result}`);
  }

  const kilo = enforceNotice(
    "Claro, buscaré el producto.",
    [{ role: "user", content: "Quiero un kilo de bistec" }],
  );
  if (kilo.toLowerCase().includes("órdenes de 3")) {
    throw new Error(`applied taco pack rule to a kilo: ${kilo}`);
  }
});

Deno.test("stored legacy prompts cannot remove current identity and complement rules", async () => {
  const originalFetch = globalThis.fetch;
  let receivedSystemPrompt = "";
  globalThis.fetch = ((_: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    receivedSystemPrompt = String(body.messages?.[0]?.content ?? "");
    return Promise.resolve(
      new Response(
        JSON.stringify({
          choices: [{
            message: { role: "assistant", content: "Respuesta QA" },
          }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  }) as typeof fetch;
  const configChain = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve({
        data: {
          system_prompt: "PROMPT ANTIGUO SIN REGLAS NUEVAS",
          tone_style: "calido_cercano",
          llm_model: whatsappCore.MODEL_DEFAULT,
          temperature: 0,
        },
        error: null,
      });
    },
  };
  const supabase = {
    from() {
      return configChain;
    },
    rpc() {
      return Promise.resolve({ data: "test-openrouter-key", error: null });
    },
  };
  try {
    await whatsappCore.runAgentTurn(
      supabase,
      [{ role: "user", content: "Hola" }],
      "widget-qa-legacy-prompt",
      { is_new: true },
      whatsappCore.RESTAURANT_ID,
    );
    for (
      const expected of [
        "corrección más reciente",
        "salsa habanero",
        "crema de ajo",
        "requested_complements",
      ]
    ) {
      if (!receivedSystemPrompt.toLowerCase().includes(expected)) {
        throw new Error(`hard rule missing from runtime prompt: ${expected}`);
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("provider failure never denies an order that was already created", () => {
  if (
    !whatsappCore.providerFailureReply("order-123").includes(
      "ya quedó registrado",
    )
  ) {
    throw new Error("successful order was presented as a provider failure");
  }
  if (!whatsappCore.providerFailureReply(null).includes("problema técnico")) {
    throw new Error("missing safe fallback before order creation");
  }
});

Deno.test("an agent turn preserves the caller history so the full turn can be appended", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          choices: [{
            message: { role: "assistant", content: "Respuesta QA" },
          }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )) as typeof fetch;

  const configChain = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve({ data: null, error: null });
    },
  };
  const supabase = {
    from() {
      return configChain;
    },
    rpc() {
      return Promise.resolve({ data: "test-openrouter-key", error: null });
    },
  };
  const messages = [{ role: "user", content: "Hola" }];
  try {
    const result = await whatsappCore.runAgentTurn(
      supabase,
      messages,
      "widget-qa-test",
      { is_new: true },
      whatsappCore.RESTAURANT_ID,
    );
    if (messages.length !== 1) {
      throw new Error(
        `caller history was mutated to ${messages.length} messages`,
      );
    }
    if (result.updatedMessages.length !== 2) {
      throw new Error(
        `expected user + assistant in returned history, got ${result.updatedMessages.length}`,
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("a transient primary-provider failure retries once with the cross-provider backup", async () => {
  const originalFetch = globalThis.fetch;
  const models: string[] = [];
  let attempt = 0;
  globalThis.fetch = ((_: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    models.push(body.model);
    attempt++;
    if (attempt === 1) {
      return Promise.resolve(new Response("busy", { status: 503 }));
    }
    return Promise.resolve(
      new Response(
        JSON.stringify({
          choices: [{
            message: { role: "assistant", content: "Respaldo activo" },
          }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  }) as typeof fetch;

  const configChain = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve({ data: null, error: null });
    },
  };
  const supabase = {
    from() {
      return configChain;
    },
    rpc() {
      return Promise.resolve({ data: "test-openrouter-key", error: null });
    },
  };
  try {
    const result = await whatsappCore.runAgentTurn(
      supabase,
      [{ role: "user", content: "Hola" }],
      "widget-qa-fallback",
      { is_new: true },
      whatsappCore.RESTAURANT_ID,
    );
    const expected = [whatsappCore.MODEL_DEFAULT, whatsappCore.MODEL_RESPALDO];
    if (JSON.stringify(models) !== JSON.stringify(expected)) {
      throw new Error(`expected model cascade ${expected}, got ${models}`);
    }
    if (result.reply !== "Respaldo activo") {
      throw new Error(`unexpected backup reply: ${result.reply}`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
