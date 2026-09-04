import { authorizeAgentConfig } from "./agent-config-auth.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`expected ${expected}, got ${actual}`);
  }
}

function db(user: any, roles: any[], staff: any[], branches: any[]) {
  return {
    auth: {
      getUser: async (token: string) =>
        token === "bad"
          ? { data: { user: null }, error: new Error("bad") }
          : { data: { user }, error: null },
    },
    from: (table: string) => {
      const result = table === "user_roles"
        ? roles
        : table === "restaurant_staff"
        ? staff
        : branches;
      const query: any = {
        eq: () => query,
        not: async () => ({ data: result, error: null }),
        then: (resolve: any) => resolve({ data: result, error: null }),
      };
      return { select: () => query };
    },
  };
}

const branch = [{ elevenlabs_agent_id: "agent-own" }];

Deno.test("sin Authorization devuelve 401", async () => {
  assertEquals(
    (await authorizeAgentConfig(db({ id: "u" }, [], [], branch), null, {
      action: "voices",
    }, "r")).status,
    401,
  );
});
Deno.test("token inválido devuelve 401", async () => {
  assertEquals(
    (await authorizeAgentConfig(db({ id: "u" }, [], [], branch), "Bearer bad", {
      action: "voices",
    }, "r")).status,
    401,
  );
});
Deno.test("usuario ajeno devuelve 403", async () => {
  assertEquals(
    (await authorizeAgentConfig(
      db({ id: "u" }, [{ role: "user" }], [], branch),
      "Bearer ok",
      { action: "voices" },
      "r",
    )).status,
    403,
  );
});
Deno.test("staff no puede usar agente ajeno", async () => {
  assertEquals(
    (await authorizeAgentConfig(
      db({ id: "u" }, [], [{ role: "admin" }], branch),
      "Bearer ok",
      { action: "get", agent_id: "agent-other" },
      "r",
    )).status,
    403,
  );
});
Deno.test("repartidor no puede administrar el agente", async () => {
  assertEquals(
    (await authorizeAgentConfig(
      db({ id: "u" }, [], [{ role: "repartidor" }], branch),
      "Bearer ok",
      { action: "update", agent_id: "agent-own" },
      "r",
    )).status,
    403,
  );
});
Deno.test("list_conversations exige agent_id", async () => {
  assertEquals(
    (await authorizeAgentConfig(
      db({ id: "u" }, [], [{ role: "admin" }], branch),
      "Bearer ok",
      { action: "list_conversations" },
      "r",
    )).status,
    400,
  );
});
Deno.test("staff puede usar su agente", async () => {
  assertEquals(
    (await authorizeAgentConfig(
      db({ id: "u" }, [], [{ role: "admin" }], branch),
      "Bearer ok",
      { action: "get", agent_id: "agent-own" },
      "r",
    )).status,
    200,
  );
});
Deno.test("superadmin autenticado puede usar cualquier agente", async () => {
  assertEquals(
    (await authorizeAgentConfig(
      db({ id: "u" }, [{ role: "superadmin" }], [], branch),
      "Bearer ok",
      { action: "get", agent_id: "agent-other" },
      "r",
    )).status,
    200,
  );
});
