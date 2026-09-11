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

Deno.test("enforceQuotedTotal corrects a hallucinated total next to the word total", () => {
  const corrected = whatsappCore.enforceQuotedTotal(
    "¡Listo! Tu pedido quedó registrado, el total es $185.00.",
    193.5,
  );
  if (!corrected.includes("$193.50")) {
    throw new Error(`hallucinated total was not corrected: ${corrected}`);
  }
  if (corrected.includes("$185.00")) {
    throw new Error(`hallucinated total survived the correction: ${corrected}`);
  }
});

Deno.test("enforceQuotedTotal corrects a hallucinated total stated in words (pesos)", () => {
  const corrected = whatsappCore.enforceQuotedTotal(
    "El total son 150 pesos.",
    162,
  );
  if (!corrected.includes("$162.00")) {
    throw new Error(`hallucinated worded total was not corrected: ${corrected}`);
  }
});

Deno.test("enforceQuotedTotal leaves a correct total untouched", () => {
  const original = "Tu total es $193.50, ¿cómo vas a pagar?";
  const result = whatsappCore.enforceQuotedTotal(original, 193.5);
  if (result !== original) {
    throw new Error(`a correct total was rewritten unnecessarily: ${result}`);
  }
});

Deno.test("enforceQuotedTotal never touches per-item prices unrelated to the word total", () => {
  const original =
    "Los tacos de pastor están a $18 cada uno, ¿cuántos quieres?";
  const result = whatsappCore.enforceQuotedTotal(original, 193.5);
  if (result !== original) {
    throw new Error(
      `a per-item price with no "total" nearby was altered: ${result}`,
    );
  }
});

Deno.test("enforceQuotedTotal is a no-op without a known real total yet", () => {
  const original = "¿Cuántos tacos de bistec quieres?";
  const result = whatsappCore.enforceQuotedTotal(original, null);
  if (result !== original) {
    throw new Error(`reply was altered with no real total to check against: ${result}`);
  }
});

// Base de datos real (mock) que deja a quoteOrderCore hacer su trabajo real
// de verdad — 3 refrescos individuales a $62 = $186 real. La prueba deja al
// LLM (mockeado) alucinar $999 en el texto libre del turno siguiente y
// verifica que safeReply lo corrija con el total real que sí calculó
// quoteOrderCore, no el que dijo el modelo.
function fakeSupabaseForQuotedTotalTest() {
  const genericChain = {
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
  return {
    from(table: string) {
      if (table === "branches") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle() {
            return Promise.resolve({
              data: {
                id: "branch-1",
                name: "Altabrisa",
                is_active: true,
                restaurant_id: whatsappCore.RESTAURANT_ID,
              },
              error: null,
            });
          },
        };
      }
      if (table === "branch_products") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          in() {
            return Promise.resolve({
              data: [{
                price: 62,
                is_available: true,
                products: {
                  id: "11111111-1111-4111-8111-111111111111",
                  name: "Refresco de cola",
                  description: "individual",
                  categories: { name: "Bebidas" },
                },
              }],
              error: null,
            });
          },
        };
      }
      return genericChain;
    },
    rpc() {
      return Promise.resolve({ data: "test-openrouter-key", error: null });
    },
  };
}

Deno.test("a full agent turn overrides a hallucinated total with the real cotizar_pedido total", async () => {
  const originalFetch = globalThis.fetch;
  let call = 0;
  globalThis.fetch = (() => {
    call++;
    if (call === 1) {
      // Primer turno: el modelo pide cotizar_pedido.
      return Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{
              message: {
                role: "assistant",
                content: null,
                tool_calls: [{
                  id: "call-1",
                  function: {
                    name: "cotizar_pedido",
                    arguments: JSON.stringify({
                      branch_slug: "altabrisa",
                      items: [{
                        product_id: "11111111-1111-4111-8111-111111111111",
                        product_name: "Refresco de cola",
                        requested_quantity: 3,
                      }],
                    }),
                  },
                }],
              },
            }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    // Segundo turno: ya con el total REAL ($186) en el resultado de la
    // herramienta, el modelo alucina otra cifra distinta en el texto libre.
    return Promise.resolve(
      new Response(
        JSON.stringify({
          choices: [{
            message: {
              role: "assistant",
              content: "¡Listo! El total de tu pedido es $999.00, ¿cómo pagas?",
            },
          }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  }) as typeof fetch;
  try {
    const result = await whatsappCore.runAgentTurn(
      fakeSupabaseForQuotedTotalTest(),
      [{ role: "user", content: "Quiero 3 refrescos de cola" }],
      "widget-qa-total-guard",
      { is_new: true },
      whatsappCore.RESTAURANT_ID,
    );
    if (result.reply.includes("$999.00")) {
      throw new Error(
        `hallucinated total reached the customer unchanged: ${result.reply}`,
      );
    }
    if (!result.reply.includes("$186.00")) {
      throw new Error(
        `reply was not corrected to the real cotizar_pedido total: ${result.reply}`,
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("pendingQuestionForMissingData asks for colonia before a branch is resolved", () => {
  const question = whatsappCore.pendingQuestionForMissingData(null, null);
  if (!question || !question.includes("colonia")) {
    throw new Error(`expected a colonia question, got: ${question}`);
  }
});

Deno.test("pendingQuestionForMissingData asks a generic next step once a branch is known", () => {
  const question = whatsappCore.pendingQuestionForMissingData("branch-1", null);
  if (!question || question.includes("colonia")) {
    throw new Error(`expected a generic next-step question, got: ${question}`);
  }
});

Deno.test("pendingQuestionForMissingData has nothing pending once the order was created", () => {
  const question = whatsappCore.pendingQuestionForMissingData("branch-1", "order-1");
  if (question !== null) {
    throw new Error(`expected no pending question after order creation, got: ${question}`);
  }
});

Deno.test("enforcePendingQuestion appends the concrete pending question to a closing statement", () => {
  const result = whatsappCore.enforcePendingQuestion(
    "Voy a revisar tu pedido.",
    null,
    null,
  );
  if (!result.includes("colonia")) {
    throw new Error(`stalling reply was not forced into a concrete question: ${result}`);
  }
});

Deno.test("enforcePendingQuestion leaves a reply that already asks something untouched", () => {
  const original = "¿Me confirmas tu dirección de entrega?";
  const result = whatsappCore.enforcePendingQuestion(original, null, null);
  if (result !== original) {
    throw new Error(`a reply that already asks a question was rewritten: ${result}`);
  }
});

Deno.test("enforcePendingQuestion never appends once the order already exists", () => {
  const original = "¡Gracias! Tu pedido va en camino.";
  const result = whatsappCore.enforcePendingQuestion(original, "branch-1", "order-1");
  if (result !== original) {
    throw new Error(`a post-order closing statement was altered: ${result}`);
  }
});

Deno.test("a stalling reply with no tool call and no branch resolved gets a concrete question forced in", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          choices: [{
            message: {
              role: "assistant",
              // Justo el patrón que la regla dura ya prohíbe por prompt pero
              // nada hacía cumplir: cerrar el turno con una afirmación
              // ("voy a revisar") en vez de una pregunta concreta.
              content: "Voy a revisar los productos disponibles.",
            },
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
  try {
    const result = await whatsappCore.runAgentTurn(
      supabase,
      [{ role: "user", content: "Hola, quiero pedir" }],
      "widget-qa-pending-question",
      { is_new: true },
      whatsappCore.RESTAURANT_ID,
    );
    if (!/[?¿]/.test(result.reply)) {
      throw new Error(
        `a stalling non-question reply reached the customer unchanged: ${result.reply}`,
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("classifyHighRiskIntent detects a cancellation request", () => {
  const match = whatsappCore.classifyHighRiskIntent(
    "hola quiero cancelar mi pedido porfa",
  );
  if (match?.intent !== "cancelacion") {
    throw new Error(`expected cancelacion, got: ${JSON.stringify(match)}`);
  }
});

Deno.test("classifyHighRiskIntent detects a duplicate charge complaint", () => {
  const match = whatsappCore.classifyHighRiskIntent(
    "oigan me cobraron dos veces el mismo pedido",
  );
  if (match?.intent !== "cobro_duplicado") {
    throw new Error(`expected cobro_duplicado, got: ${JSON.stringify(match)}`);
  }
});

Deno.test("classifyHighRiskIntent detects urgency", () => {
  const match = whatsappCore.classifyHighRiskIntent("es urgente, necesito ayuda");
  if (match?.intent !== "urgencia") {
    throw new Error(`expected urgencia, got: ${JSON.stringify(match)}`);
  }
});

Deno.test("classifyHighRiskIntent detects an ARCO/privacy rights request", () => {
  const match = whatsappCore.classifyHighRiskIntent(
    "quiero borrar mis datos de su sistema",
  );
  if (match?.intent !== "privacidad_arco") {
    throw new Error(`expected privacidad_arco, got: ${JSON.stringify(match)}`);
  }
});

Deno.test("classifyHighRiskIntent does not misfire on a normal order message", () => {
  const match = whatsappCore.classifyHighRiskIntent(
    "quiero 3 tacos de pastor y un refresco",
  );
  if (match !== null) {
    throw new Error(`false positive on a normal order: ${JSON.stringify(match)}`);
  }
});

Deno.test("a cancellation message short-circuits before any OpenRouter call and logs a callback request", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (() => {
    fetchCalled = true;
    throw new Error("OpenRouter should never be called for a high-risk fast-path");
  }) as typeof fetch;
  const capture: { row: Record<string, unknown> | null } = { row: null };
  const supabase = {
    from(table: string) {
      if (table === "callback_requests") {
        return {
          insert(row: Record<string, unknown>) {
            capture.row = row;
            return Promise.resolve({ error: null });
          },
        };
      }
      return {
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
    },
    rpc() {
      return Promise.resolve({ data: "test-openrouter-key", error: null });
    },
  };
  try {
    const result = await whatsappCore.runAgentTurn(
      supabase,
      [{ role: "user", content: "quiero cancelar mi pedido" }],
      "widget-qa-high-risk",
      { is_new: true, name: "Ana" },
      whatsappCore.RESTAURANT_ID,
    );
    if (fetchCalled) {
      throw new Error("OpenRouter was called despite the deterministic fast-path");
    }
    if (result.orderId !== null) {
      throw new Error("a high-risk fast-path must never create an order");
    }
    const insertedRow = capture.row;
    if (!insertedRow || insertedRow.reason !== "alto_riesgo:cancelacion") {
      throw new Error(
        `expected a logged callback_requests row for cancelacion, got: ${
          JSON.stringify(insertedRow)
        }`,
      );
    }
    if (insertedRow.customer_name !== "Ana") {
      throw new Error(
        `expected the known customer name to be used, got: ${insertedRow.customer_name}`,
      );
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
    // "Respaldo activo" no termina en pregunta y aún no hay sucursal
    // resuelta — enforcePendingQuestion (patrón 7) le anexa correctamente la
    // pregunta pendiente concreta; esta prueba solo verifica que el texto
    // original del respaldo cross-provider sigue llegando intacto al inicio.
    if (!result.reply.startsWith("Respaldo activo")) {
      throw new Error(`unexpected backup reply: ${result.reply}`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
