import { createOrderCore, OrderValidationError } from "./create-order-core.ts";
import * as orderCore from "./create-order-core.ts";

type TestQuery = {
  table: string;
  calls: Array<{ method: string; args: unknown[] }>;
};
type DatabaseStep = {
  table: string;
  response: unknown;
  inspect?: (query: TestQuery) => void;
};

function scriptedDatabase(steps: DatabaseStep[]) {
  const pending = [...steps];
  const finish = (query: TestQuery) => {
    const step = pending.shift();
    if (!step || step.table !== query.table) {
      throw new Error(
        `unexpected query to ${query.table}, expected ${step?.table}`,
      );
    }
    step.inspect?.(query);
    return Promise.resolve(step.response);
  };
  return {
    from(table: string) {
      const query: TestQuery = { table, calls: [] };
      const chain = {
        select(...args: unknown[]) {
          query.calls.push({ method: "select", args });
          return chain;
        },
        eq(...args: unknown[]) {
          query.calls.push({ method: "eq", args });
          return chain;
        },
        in(...args: unknown[]) {
          query.calls.push({ method: "in", args });
          return chain;
        },
        insert(...args: unknown[]) {
          query.calls.push({ method: "insert", args });
          return chain;
        },
        update(...args: unknown[]) {
          query.calls.push({ method: "update", args });
          return chain;
        },
        upsert(...args: unknown[]) {
          query.calls.push({ method: "upsert", args });
          return chain;
        },
        single() {
          return finish(query);
        },
        maybeSingle() {
          return finish(query);
        },
        then(
          resolve: (value: unknown) => unknown,
          reject: (reason: unknown) => unknown,
        ) {
          return finish(query).then(resolve, reject);
        },
      };
      return chain;
    },
    rpc(name: string, args: unknown) {
      return finish({ table: name, calls: [{ method: "rpc", args: [args] }] });
    },
    done() {
      if (pending.length) {
        throw new Error(`${pending.length} database calls not executed`);
      }
    },
  };
}

const orderProductId = "11111111-1111-4111-8111-111111111111";
const completeAgentOrder: orderCore.CreateOrderPayload = {
  branch_slug: "test",
  customer_name: "Test",
  customer_phone: "9991111111",
  customer_address: "Calle 10 número 20, Centro",
  payment_method: "efectivo",
  source: "voice",
  items: [{
    product_id: orderProductId,
    requested_quantity: 3,
    tortilla: "maiz",
  }],
};

function preparationSteps(): DatabaseStep[] {
  return [
    {
      table: "branches",
      response: {
        data: {
          id: "branch",
          name: "Test",
          restaurant_id: "restaurant",
          is_active: true,
        },
        error: null,
      },
    },
    {
      table: "branch_products",
      response: {
        data: [{
          price: 194,
          is_available: true,
          products: {
            id: orderProductId,
            name: "Tacos de Bistec (orden de 3)",
            description: null,
            categories: { name: "Tacos" },
          },
        }],
        error: null,
      },
    },
  ];
}

function persistenceSteps(
  inspectRpc?: DatabaseStep["inspect"],
  addressCount = 1,
): DatabaseStep[] {
  return [
    {
      table: "customers",
      response: {
        data: { id: "customer", name: "Test", order_count: 99 },
        error: null,
      },
    },
    {
      table: "customers",
      response: { data: { id: "customer" }, error: null },
      inspect(query) {
        const update = query.calls.find((call) => call.method === "update")
          ?.args[0] as Record<string, unknown>;
        if ("order_count" in update) {
          throw new Error(
            "overwrote a concurrent customer order increment",
          );
        }
      },
    },
    {
      table: "customer_addresses",
      response: { data: null, count: addressCount, error: null },
    },
    {
      table: "customer_addresses",
      response: { data: null, error: null },
      inspect(query) {
        const address = query.calls.find((call) => call.method === "upsert")
          ?.args[0] as Record<string, unknown>;
        if (address.is_default !== (addressCount === 0)) {
          throw new Error(
            "default address ignored the HEAD count",
          );
        }
      },
    },
    {
      table: "create_order_idempotent",
      response: { data: { id: "order" }, error: null },
      inspect: inspectRpc,
    },
  ];
}

async function expectValidation(work: () => unknown, text?: string) {
  try {
    await work();
    throw new Error("expected validation rejection");
  } catch (error) {
    if (!(error instanceof OrderValidationError)) throw error;
    if (text && !error.message.includes(text)) throw error;
  }
}

Deno.test("real and preview orders share strict payload validation before database access", async () => {
  const invalid = [
    { customer_name: " \t " },
    { customer_address: " \n " },
    { customer_address: undefined },
    { payment_method: undefined },
    { payment_method: "transferencia" },
    { branch_slug: " " },
    { branch_slug: { value: "test" } },
    { items: null },
    { items: {} },
    { items: [] },
    { items: [null] },
    { items: [{ product_name: " ", quantity: 1 }] },
    {
      items: [{
        product_id: orderProductId,
        requested_quantity: 3,
        quantity: "1",
      }],
    },
    { idempotency_key: 123 },
    { idempotency_key: " " },
  ];
  for (const source of ["voice", "whatsapp"] as const) {
    for (const override of invalid) {
      const payload = {
        ...completeAgentOrder,
        source,
        ...override,
      } as orderCore.CreateOrderPayload;
      await expectValidation(() =>
        orderCore.validateCreateOrderPayload(payload)
      );
      await expectValidation(() => orderCore.prepareCreateOrder(null, payload));
      await expectValidation(() => createOrderCore(null, payload));
    }
  }
  const normalized = orderCore.validateCreateOrderPayload({
    ...completeAgentOrder,
    customer_name: " Test ",
    customer_phone: "+52 999 111 1111",
  });
  if (
    normalized.customer_name !== "Test" ||
    normalized.customer_phone !== "9991111111"
  ) throw new Error("identity was not normalized");
});

Deno.test("legacy quantity and requested pieces both preserve taco tortilla and totals without preview writes", async () => {
  for (
    const item of [
      { product_id: orderProductId, quantity: 2, tortilla: "harina" as const },
      {
        product_id: orderProductId,
        requested_quantity: 6,
        tortilla: "harina" as const,
      },
    ]
  ) {
    const db = scriptedDatabase(preparationSteps());
    const result = await orderCore.prepareCreateOrder(db, {
      ...completeAgentOrder,
      items: [item],
    });
    if (
      result.total !== 388 || result.orderItems[0].quantity !== 2 ||
      result.orderItems[0].tortilla !== "harina"
    ) throw new Error("preview changed the legacy item");
    db.done();
  }
  const db = scriptedDatabase(preparationSteps());
  await expectValidation(
    () =>
      orderCore.prepareCreateOrder(db, {
        ...completeAgentOrder,
        items: [{ product_id: orderProductId, quantity: 1 }],
      }),
    "maíz o harina",
  );
  db.done();
});

Deno.test("customer memory preserves concurrent order counts and chooses default addresses from count", async () => {
  for (const count of [0, 2]) {
    const db = scriptedDatabase([
      ...preparationSteps(),
      ...persistenceSteps(undefined, count),
    ]);
    await createOrderCore(db, completeAgentOrder);
    db.done();
  }
});

Deno.test("customer lookup, address count and address write errors prevent order creation", async () => {
  for (const failureIndex of [0, 2, 3]) {
    const failure = new Error("database unavailable");
    const steps = persistenceSteps().slice(0, failureIndex + 1);
    steps[failureIndex] = {
      table: steps[failureIndex].table,
      response: { data: null, error: failure },
    };
    const db = scriptedDatabase([...preparationSteps(), ...steps]);
    try {
      await createOrderCore(db, completeAgentOrder);
      throw new Error("ignored a customer memory failure");
    } catch (error) {
      if (error !== failure) throw error;
    }
    db.done();
  }
});

Deno.test("a concurrent customer insert recovers identity without resetting order_count", async () => {
  const steps = persistenceSteps();
  const db = scriptedDatabase([
    ...preparationSteps(),
    { table: "customers", response: { data: null, error: null } },
    { table: "customers", response: { data: null, error: { code: "23505" } } },
    {
      table: "customers",
      response: {
        data: { id: "customer", name: "Test", order_count: 5 },
        error: null,
      },
    },
    ...steps.slice(1),
  ]);
  await createOrderCore(db, completeAgentOrder);
  db.done();
});

Deno.test("identical canonical orders preserve their fingerprint across quantity formats", async () => {
  const fingerprints: string[] = [];
  for (
    const items of [
      [{
        product_id: orderProductId,
        requested_quantity: 6,
        tortilla: "maiz" as const,
      }],
      [{ product_id: orderProductId, quantity: 2, tortilla: "maiz" as const }],
    ]
  ) {
    const db = scriptedDatabase([
      ...preparationSteps(),
      ...persistenceSteps((query) => {
        fingerprints.push(
          (query.calls[0].args[0] as Record<string, string>)
            .p_dedupe_fingerprint,
        );
      }),
    ]);
    await createOrderCore(db, { ...completeAgentOrder, items });
    db.done();
  }
  if (fingerprints[0] !== fingerprints[1]) {
    throw new Error("identical menu units changed fingerprint");
  }
});

Deno.test("material order changes alter fingerprint while retry keys remain stable", async () => {
  const fingerprints: string[] = [];
  const keys: string[] = [];
  for (
    const change of [
      {},
      { customer_name: "Otro nombre" },
      { customer_address: "Otra dirección" },
      { payment_method: "tarjeta" },
      { notes: "Sin cebolla" },
      { requested_complements: ["salsa_habanero"] },
      {
        items: [{
          product_id: orderProductId,
          requested_quantity: 3,
          tortilla: "harina",
        }],
      },
    ]
  ) {
    const db = scriptedDatabase([
      ...preparationSteps(),
      ...persistenceSteps((query) => {
        const args = query.calls[0].args[0] as Record<string, string>;
        fingerprints.push(args.p_dedupe_fingerprint);
        keys.push(args.p_idempotency_key);
      }),
    ]);
    await createOrderCore(
      db,
      {
        ...completeAgentOrder,
        idempotency_key: "intent-1",
        ...change,
      } as orderCore.CreateOrderPayload,
    );
    db.done();
  }
  if (new Set(fingerprints).size !== fingerprints.length) {
    throw new Error("materially different orders share a fingerprint");
  }
  if (new Set(keys).size !== 1) {
    throw new Error("retry key changed with the payload");
  }
});

Deno.test("idempotency database conflicts are exposed as a typed order conflict", async () => {
  const steps = persistenceSteps();
  steps[steps.length - 1].response = { data: null, error: { code: "PT409" } };
  const db = scriptedDatabase([...preparationSteps(), ...steps]);
  try {
    await createOrderCore(db, completeAgentOrder);
    throw new Error("accepted conflicting retry");
  } catch (error) {
    if (!(error instanceof orderCore.OrderConflictError)) throw error;
  }
  db.done();
});

Deno.test("voice requires a valid conversation and expired markers never become real orders", async () => {
  const conversationId = "conv_1234567890abcdefghij";
  for (
    const id of [
      undefined,
      null,
      "",
      "conv_short",
      "conv_1234567890/../other",
      "x".repeat(201),
    ]
  ) {
    await expectValidation(() =>
      orderCore.resolveVoicePreviewRestaurant(null, id)
    );
  }
  for (
    const expiry of ["2026-09-04T11:59:59Z", "2026-09-04T12:00:00Z", "invalid"]
  ) {
    const db = scriptedDatabase([{
      table: "voice_preview_sessions",
      response: {
        data: { restaurant_id: "restaurant", expires_at: expiry },
        error: null,
      },
    }]);
    await expectValidation(
      () =>
        orderCore.resolveVoicePreviewRestaurant(
          db,
          conversationId,
          Date.parse("2026-09-04T12:00:00Z"),
        ),
      "expiró",
    );
    db.done();
  }
  const liveDb = scriptedDatabase([{
    table: "voice_preview_sessions",
    response: {
      data: { restaurant_id: "restaurant", expires_at: "2026-09-04T12:01:00Z" },
      error: null,
    },
  }]);
  if (
    await orderCore.resolveVoicePreviewRestaurant(
      liveDb,
      conversationId,
      Date.parse("2026-09-04T12:00:00Z"),
    ) !== "restaurant"
  ) throw new Error("lost preview tenant");
  const realDb = scriptedDatabase([{
    table: "voice_preview_sessions",
    response: { data: null, error: null },
  }]);
  if (
    await orderCore.resolveVoicePreviewRestaurant(realDb, conversationId) !==
      null
  ) throw new Error("marked a real call as preview");
  const failure = new Error("marker query unavailable");
  const failedDb = scriptedDatabase([{
    table: "voice_preview_sessions",
    response: { data: null, error: failure },
  }]);
  try {
    await orderCore.resolveVoicePreviewRestaurant(failedDb, conversationId);
    throw new Error("failed open on marker query error");
  } catch (error) {
    if (error !== failure) throw error;
  }
});

Deno.test("preview registration verifies upstream ownership and cannot overwrite another tenant", async () => {
  const session = {
    conversation_id: "conv_1234567890abcdefghij",
    restaurant_id: "restaurant",
    agent_id: "agent_1234567890abcdefghij",
    created_by: "admin",
  };
  await expectValidation(() =>
    orderCore.registerVoicePreviewSession(null, session, {
      agent_id: "other",
      conversation_id: session.conversation_id,
    })
  );
  await expectValidation(() =>
    orderCore.registerVoicePreviewSession(null, session, {
      agent_id: session.agent_id,
      conversation_id: "conv_otherconversation",
    })
  );
  for (const restaurant of ["restaurant", "other-restaurant"]) {
    const db = scriptedDatabase([
      {
        table: "voice_preview_sessions",
        response: { error: null },
        inspect(query) {
          const options = query.calls[0].args[1] as Record<string, unknown>;
          if (options.ignoreDuplicates !== true) {
            throw new Error("preview markers are overwritable");
          }
        },
      },
      {
        table: "voice_preview_sessions",
        response: {
          data: {
            restaurant_id: restaurant,
            agent_id: session.agent_id,
            expires_at: new Date(Date.now() + 60000).toISOString(),
          },
          error: null,
        },
      },
    ]);
    const register = () =>
      orderCore.registerVoicePreviewSession(db, session, session);
    if (restaurant === "restaurant") await register();
    else await expectValidation(register, "otro agente o restaurante");
    db.done();
  }
});

async function rejectsValidation(payload: unknown) {
  try {
    await createOrderCore(null, payload as never);
    throw new Error("payload was accepted");
  } catch (error) {
    if (!(error instanceof OrderValidationError)) throw error;
  }
}

Deno.test("order rejects non-object and missing identity", async () => {
  await rejectsValidation(null);
  await rejectsValidation({});
});

Deno.test("order rejects oversized customer-controlled fields", async () => {
  await rejectsValidation({
    branch_slug: "test",
    customer_name: "x".repeat(161),
    customer_phone: "9991111111",
    items: [{ product_id: "p", quantity: 1 }],
  });
});

Deno.test("order rejects excessive item count and quantities", async () => {
  const base = {
    branch_slug: "test",
    customer_name: "Test",
    customer_phone: "9991111111",
  };
  await rejectsValidation({
    ...base,
    items: Array.from(
      { length: 101 },
      () => ({ product_id: "p", quantity: 1 }),
    ),
  });
  await rejectsValidation({
    ...base,
    items: [{ product_id: "p", quantity: 101 }],
  });
});

Deno.test("quote converts requested pieces into menu units and computes the exact total", () => {
  const buildQuote = (orderCore as Record<string, unknown>)
    .buildOrderQuoteFromProducts;
  if (typeof buildQuote !== "function") {
    throw new Error("buildOrderQuoteFromProducts is not implemented");
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
    total: number;
    items: Array<{ product_id: string; quantity: number }>;
  };

  if (quote.total !== 1266) {
    throw new Error(`expected total 1266, got ${quote.total}`);
  }
  const expectedItems = [
    { product_id: "pastor", quantity: 8, tortilla: "maiz" },
    { product_id: "bistec", quantity: 1, tortilla: "harina" },
    { product_id: "quesobich", quantity: 1 },
    { product_id: "coca", quantity: 10 },
  ];
  if (JSON.stringify(quote.items) !== JSON.stringify(expectedItems)) {
    throw new Error(
      `expected normalized menu units ${JSON.stringify(expectedItems)}, got ${
        JSON.stringify(quote.items)
      }`,
    );
  }
});

Deno.test("quote rejects every non-multiple for an order of three", () => {
  const buildQuote = (orderCore as Record<string, unknown>)
    .buildOrderQuoteFromProducts;
  if (typeof buildQuote !== "function") {
    throw new Error("buildOrderQuoteFromProducts is not implemented");
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
      );
      throw new Error(
        `accepted invalid requested quantity ${requested_quantity}`,
      );
    } catch (error) {
      if (!(error instanceof OrderValidationError)) throw error;
      if (!error.message.includes("órdenes de 3")) {
        throw new Error(`unexpected validation message: ${error.message}`);
      }
    }
  }
});

Deno.test("quote blocks every taco line until its tortilla is confirmed", () => {
  const buildQuote = (orderCore as Record<string, unknown>)
    .buildOrderQuoteFromProducts as (
      items: Array<Record<string, unknown>>,
      products: Array<Record<string, unknown>>,
    ) => unknown;
  let rejected = false;
  try {
    buildQuote(
      [{ product_id: "pastor", requested_quantity: 8 }],
      [{
        id: "pastor",
        name: "Taco Al Pastor (individual)",
        price: 42,
        pack_size: 1,
      }],
    );
  } catch (error) {
    if (!(error instanceof OrderValidationError)) throw error;
    if (!error.message.includes("maíz o harina")) throw error;
    rejected = true;
  }
  if (!rejected) throw new Error("accepted a taco line without tortilla");
});

Deno.test("quote never persists a tortilla on products that are not tacos", () => {
  const buildQuote = (orderCore as Record<string, unknown>)
    .buildOrderQuoteFromProducts as (
      items: Array<Record<string, unknown>>,
      products: Array<Record<string, unknown>>,
    ) => {
      items: Array<Record<string, unknown>>;
      lines: Array<Record<string, unknown>>;
    };
  const quote = buildQuote(
    [{ product_id: "coca", requested_quantity: 10, tortilla: "maiz" }],
    [{
      id: "coca",
      name: "Coca-Cola",
      price: 53,
      pack_size: null,
    }],
  );
  if ("tortilla" in quote.items[0] || quote.lines[0].tortilla !== null) {
    throw new Error(`persisted tortilla on a drink: ${JSON.stringify(quote)}`);
  }
});

Deno.test("voice preview mode is trusted only from the authenticated tool", () => {
  const isTrustedPreview = (orderCore as Record<string, unknown>)
    .isTrustedVoicePreview;
  if (typeof isTrustedPreview !== "function") {
    throw new Error("isTrustedVoicePreview is not implemented");
  }
  const check = isTrustedPreview as (
    authorized: boolean,
    value: unknown,
  ) => boolean;
  for (const value of [true, "true", "TRUE"]) {
    if (!check(true, value)) throw new Error(`rejected trusted value ${value}`);
    if (check(false, value)) {
      throw new Error(`accepted untrusted value ${value}`);
    }
  }
  for (const value of [false, "false", undefined, 1]) {
    if (check(true, value)) throw new Error(`accepted invalid value ${value}`);
  }
});

Deno.test("alcohol requires an explicit adult confirmation but zero-alcohol drinks do not", () => {
  const buildQuote = (orderCore as Record<string, unknown>)
    .buildOrderQuoteFromProducts as (
      items: Array<Record<string, unknown>>,
      products: Array<Record<string, unknown>>,
      options?: Record<string, unknown>,
    ) => unknown;
  const cerveza = [{
    id: "sol",
    name: "Sol",
    price: 80,
    pack_size: null,
    requires_adult_confirmation: true,
  }];
  try {
    buildQuote([{ product_id: "sol", requested_quantity: 2 }], cerveza);
    throw new Error("accepted alcohol without an adult confirmation");
  } catch (error) {
    if (!(error instanceof OrderValidationError)) throw error;
    if (!error.message.includes("mayor de edad")) throw error;
  }

  buildQuote(
    [{ product_id: "sol", requested_quantity: 2 }],
    cerveza,
    { adult_confirmed: true },
  );
  buildQuote(
    [{ product_id: "heineken-cero", requested_quantity: 1 }],
    [{
      id: "heineken-cero",
      name: "Heineken 0.0",
      price: 80,
      pack_size: null,
      requires_adult_confirmation: false,
    }],
  );
});

Deno.test("only successful orders are eligible for customer recommendations", () => {
  const eligible = (orderCore as Record<string, unknown>)
    .isOrderEligibleForRecommendations;
  if (typeof eligible !== "function") {
    throw new Error("isOrderEligibleForRecommendations is not implemented");
  }
  const check = eligible as (status: unknown) => boolean;
  for (
    const status of [
      "pending",
      "preparando",
      "en_camino",
      "entregado",
      "completado",
    ]
  ) {
    if (!check(status)) throw new Error(`rejected eligible status ${status}`);
  }
  for (const status of ["cancelado", "problema", "cancelled", null]) {
    if (check(status)) {
      throw new Error(`recommended ineligible status ${status}`);
    }
  }
});

Deno.test("product search ignores spoken quantities and category filler", () => {
  const tokenize = (orderCore as Record<string, unknown>)
    .tokenizeForProductSearch;
  if (typeof tokenize !== "function") {
    throw new Error("tokenizeForProductSearch is not implemented");
  }
  const tokens = (tokenize as (query: string) => string[])(
    "quiero dos cervezas Sol",
  );
  if (JSON.stringify(tokens) !== JSON.stringify(["sol"])) {
    throw new Error(`expected a single product token, got ${tokens}`);
  }
  const zeroAlcohol = (tokenize as (query: string) => string[])(
    "dos Heineken cero punto cero",
  );
  if (JSON.stringify(zeroAlcohol) !== JSON.stringify(["heineken", "0.0"])) {
    throw new Error(`expected spoken 0.0 normalization, got ${zeroAlcohol}`);
  }
});

Deno.test("voice phone numbers are canonicalized only from valid Mexican formats", () => {
  const canonicalize = (orderCore as Record<string, unknown>)
    .canonicalizeMexicanPhone;
  if (typeof canonicalize !== "function") {
    throw new Error("canonicalizeMexicanPhone is not implemented");
  }
  const phone = canonicalize as (value: string) => string | null;
  for (
    const [input, expected] of [
      ["999 270 0800", "9992700800"],
      ["+52 999 270 0800", "9992700800"],
      ["5219992700800", "9992700800"],
    ]
  ) {
    if (phone(input) !== expected) {
      throw new Error(`expected ${input} to normalize to ${expected}`);
    }
  }
  for (const invalid of ["99992700800", "999922700800", "999270080", "abc"]) {
    if (phone(invalid) !== null) {
      throw new Error(`accepted invalid voice phone ${invalid}`);
    }
  }
});

Deno.test("an exact product name recovers a malformed copied UUID safely", () => {
  const resolve = (orderCore as Record<string, unknown>)
    .resolveOrderItemsAgainstProducts;
  if (typeof resolve !== "function") {
    throw new Error("resolveOrderItemsAgainstProducts is not implemented");
  }
  const canonicalId = "cdeee7d8-d23b-4762-9d18-bb78becd1f27";
  const result = (resolve as (
    items: Array<Record<string, unknown>>,
    products: Array<Record<string, unknown>>,
  ) => Array<Record<string, unknown>>)(
    [{
      product_id: "cdeee7d8-d23-4762-9d18-bb78becd1f27",
      product_name: "Coca-Cola",
      requested_quantity: 1,
    }],
    [{ id: canonicalId, name: "Coca-Cola", price: 53, pack_size: null }],
  );
  if (result[0].product_id !== canonicalId) {
    throw new Error(
      `did not recover the canonical UUID: ${JSON.stringify(result)}`,
    );
  }
});

Deno.test("product recovery rejects a valid ID/name disagreement instead of switching products", () => {
  const resolve = (orderCore as Record<string, unknown>)
    .resolveOrderItemsAgainstProducts as (
      items: Array<Record<string, unknown>>,
      products: Array<Record<string, unknown>>,
    ) => Array<Record<string, unknown>>;
  try {
    resolve(
      [{
        product_id: "11111111-1111-4111-8111-111111111111",
        product_name: "Coca-Cola",
        requested_quantity: 1,
      }],
      [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Sprite",
          price: 53,
          pack_size: null,
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Coca-Cola",
          price: 53,
          pack_size: null,
        },
      ],
    );
    throw new Error("accepted a conflicting product id and name");
  } catch (error) {
    if (!(error instanceof OrderValidationError)) throw error;
  }
});

Deno.test("complements add defaults and only explicit request-only sauces", () => {
  const buildNotes = (orderCore as Record<string, unknown>)
    .buildComplementNotes;
  if (typeof buildNotes !== "function") {
    throw new Error("buildComplementNotes is not implemented");
  }
  const notes = (buildNotes as (
    notes?: string,
    requested?: string[],
    omitted?: string[],
  ) => string)(
    "Tocar el timbre",
    ["salsa_habanero"],
    [],
  );
  for (
    const expected of [
      "Tocar el timbre",
      "salsa verde",
      "salsa roja",
      "limones",
      "cebolla",
      "salsa habanero",
    ]
  ) {
    if (!notes.includes(expected)) {
      throw new Error(`missing complement: ${expected}`);
    }
  }
  if (notes.includes("crema de ajo")) {
    throw new Error("included crema de ajo without an explicit request");
  }
});
