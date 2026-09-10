// Cubre el disparo del correo de bienvenida para los dos flujos reales de
// alta de cuenta (crear-cuenta-staff y crear-repartidor). Usa el mismo
// patrón de fake ya establecido en whatsapp-agent-core.test.ts para
// proveedores externos: se sustituye globalThis.fetch por un fake de Resend
// (nunca se llama al Resend real) y se restaura siempre en el finally.
import {
  dispararCorreoBienvenidaRepartidor,
  dispararCorreoBienvenidaStaff,
  nombreRestauranteBienvenida,
  ROL_LEGIBLE,
} from "./emails/bienvenida.ts";
import { CorreoNoEnviadoError } from "./emails/enviar.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// Fake de Supabase encadenable (mismo estilo que whatsapp-agent-core.test.ts):
// solo implementa from().select().eq().maybeSingle(), que es todo lo que
// nombreRestauranteBienvenida necesita.
function fakeSupabaseConRestaurante(nombre: string | null) {
  const chain = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve({ data: nombre ? { name: nombre } : null, error: null });
    },
  };
  return { from: () => chain };
}

function stubResendFetch(): {
  restore: () => void;
  llamadas: { url: string; body: Record<string, unknown> }[];
} {
  const originalFetch = globalThis.fetch;
  const originalKey = Deno.env.get("RESEND_API_KEY");
  Deno.env.set("RESEND_API_KEY", "test-resend-key");
  const llamadas: { url: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    llamadas.push({
      url: String(input),
      body: JSON.parse(String(init?.body ?? "{}")),
    });
    return Promise.resolve(
      new Response(JSON.stringify({ id: "fake-resend-id" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }) as typeof fetch;
  return {
    llamadas,
    restore: () => {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) Deno.env.delete("RESEND_API_KEY");
      else Deno.env.set("RESEND_API_KEY", originalKey);
    },
  };
}

Deno.test("nombreRestauranteBienvenida usa el nombre real del restaurante cuando existe", async () => {
  const supabase = fakeSupabaseConRestaurante("Tacos El Buen Sazón");
  const nombre = await nombreRestauranteBienvenida(supabase, "rest-1");
  assert(nombre === "Tacos El Buen Sazón", `nombre inesperado: ${nombre}`);
});

Deno.test("nombreRestauranteBienvenida cae a atiende.ai sin restaurantId o sin fila", async () => {
  assert(
    (await nombreRestauranteBienvenida(fakeSupabaseConRestaurante(null), null)) === "atiende.ai",
    "no cayó al nombre de plataforma sin restaurantId",
  );
  assert(
    (await nombreRestauranteBienvenida(fakeSupabaseConRestaurante(null), "rest-fantasma")) === "atiende.ai",
    "no cayó al nombre de plataforma cuando la fila no existe",
  );
});

Deno.test("crear-cuenta-staff: dispara bienvenida de admin con el nombre real del restaurante", async () => {
  const stub = stubResendFetch();
  try {
    const supabase = fakeSupabaseConRestaurante("Tacos El Buen Sazón");
    await dispararCorreoBienvenidaStaff(supabase, {
      userId: "user-admin-1",
      email: "nuevo.admin@example.com",
      role: "admin",
      restaurantId: "rest-1",
    });
    assert(stub.llamadas.length === 1, "no se llamó a Resend exactamente una vez");
    const [{ url, body }] = stub.llamadas;
    assert(url === "https://api.resend.com/emails", `URL de Resend inesperada: ${url}`);
    assert(
      Array.isArray(body.to) && body.to[0] === "nuevo.admin@example.com",
      "el destinatario del correo no es el nuevo admin",
    );
    assert(
      String(body.subject).includes("Tacos El Buen Sazón"),
      `el asunto no menciona el restaurante real: ${body.subject}`,
    );
    assert(
      String(body.html).includes(ROL_LEGIBLE.admin),
      "el correo no menciona el rol legible 'Administrador'",
    );
  } finally {
    stub.restore();
  }
});

Deno.test("crear-cuenta-staff: dispara bienvenida de superadmin sin depender de un restaurante", async () => {
  const stub = stubResendFetch();
  try {
    // Un superadmin no pertenece a un restaurante — restaurantId es null
    // (así lo llama crear-cuenta-staff/index.ts) y jamás debe intentar
    // resolver un restaurante inexistente.
    const supabase = {
      from() {
        throw new Error("no debe consultarse 'restaurants' para un superadmin");
      },
    };
    await dispararCorreoBienvenidaStaff(supabase, {
      userId: "user-super-1",
      email: "nuevo.super@example.com",
      role: "superadmin",
      restaurantId: null,
    });
    assert(stub.llamadas.length === 1, "no se llamó a Resend exactamente una vez");
    const [{ body }] = stub.llamadas;
    assert(String(body.subject).includes("atiende.ai"), `asunto inesperado: ${body.subject}`);
    assert(
      String(body.html).includes(ROL_LEGIBLE.superadmin),
      "el correo no menciona el rol legible 'Superadministrador'",
    );
  } finally {
    stub.restore();
  }
});

Deno.test("crear-repartidor: dispara bienvenida de repartidor a la plataforma, no a un restaurante", async () => {
  const stub = stubResendFetch();
  try {
    await dispararCorreoBienvenidaRepartidor({
      userId: "user-repartidor-1",
      email: "nuevo.repartidor@example.com",
    });
    assert(stub.llamadas.length === 1, "no se llamó a Resend exactamente una vez");
    const [{ body }] = stub.llamadas;
    assert(
      Array.isArray(body.to) && body.to[0] === "nuevo.repartidor@example.com",
      "el destinatario del correo no es el nuevo repartidor",
    );
    assert(String(body.subject).includes("atiende.ai"), `asunto inesperado: ${body.subject}`);
    assert(
      String(body.html).includes(ROL_LEGIBLE.repartidor),
      "el correo no menciona el rol legible 'Repartidor'",
    );
  } finally {
    stub.restore();
  }
});

Deno.test("el disparo de bienvenida es best-effort: un fallo de Resend se propaga para que el llamador lo atrape (nunca lo traga aquí)", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = Deno.env.get("RESEND_API_KEY");
  Deno.env.set("RESEND_API_KEY", "test-resend-key");
  globalThis.fetch = (() =>
    Promise.resolve(new Response("proveedor caído", { status: 500 }))) as typeof fetch;
  try {
    let lanzo = false;
    try {
      await dispararCorreoBienvenidaRepartidor({
        userId: "user-repartidor-2",
        email: "otro.repartidor@example.com",
      });
    } catch (err) {
      lanzo = true;
      assert(err instanceof CorreoNoEnviadoError, `tipo de error inesperado: ${err}`);
    }
    assert(lanzo, "un 500 de Resend debería propagar CorreoNoEnviadoError, no tragárselo en silencio");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) Deno.env.delete("RESEND_API_KEY");
    else Deno.env.set("RESEND_API_KEY", originalKey);
  }
});

Deno.test("sin RESEND_API_KEY configurada, el disparo falla explícito (no envía correos reales por accidente)", async () => {
  const originalKey = Deno.env.get("RESEND_API_KEY");
  Deno.env.delete("RESEND_API_KEY");
  const originalFetch = globalThis.fetch;
  let fetchLlamado = false;
  globalThis.fetch = (() => {
    fetchLlamado = true;
    return Promise.resolve(new Response("no debería llamarse", { status: 200 }));
  }) as typeof fetch;
  try {
    let lanzo = false;
    try {
      await dispararCorreoBienvenidaRepartidor({
        userId: "user-repartidor-3",
        email: "otro.mas@example.com",
      });
    } catch (err) {
      lanzo = true;
      assert(err instanceof CorreoNoEnviadoError, `tipo de error inesperado: ${err}`);
    }
    assert(lanzo, "sin RESEND_API_KEY debería lanzar CorreoNoEnviadoError");
    assert(!fetchLlamado, "no debe intentar llamar a Resend sin credencial configurada");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) Deno.env.delete("RESEND_API_KEY");
    else Deno.env.set("RESEND_API_KEY", originalKey);
  }
});
