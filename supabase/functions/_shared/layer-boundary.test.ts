// Patrón 2 (rescatado de Likida/atiende.ai): la separación domain vs
// framework/HTTP entre los *-core.ts (lógica de negocio pura —
// create-order-core.ts, whatsapp-agent-core.ts) y los handlers HTTP delgados
// en cada supabase/functions/<nombre>/index.ts existe HOY solo por
// disciplina de código: ningún test fallaba si un *-core.ts empezaba a
// importar Deno.serve, Request/Response o algo de http-security.ts. Un
// *-core.ts debe poder invocarse desde cualquier canal (el webhook HTTP
// real, el loop de tool-use de WhatsApp en proceso, un test) sin arrastrar
// nada del transporte — igual que ya documenta el comentario de cabecera de
// create-order-core.ts ("Shared by ... an HTTP webhook ... and ... called
// in-process, no HTTP round-trip").
//
// "test:edge" en package.json corre `deno test --allow-env
// supabase/functions/_shared/*.test.ts` — SOLO --allow-env, sin
// --allow-read. Por eso este archivo no usa Deno.readDir/Deno.readTextFile
// (fallarían en CI con NotCapable): lee el texto fuente de cada *-core.ts
// vía import estático `with { type: "text" }`, que se resuelve en el grafo
// de módulos y no pide permiso de filesystem en tiempo de ejecución. La
// contrapartida es que la lista de módulos vigilados es explícita a mano
// abajo — si se agrega un *-core.ts nuevo bajo _shared/ hay que sumarlo
// aquí también, o queda sin vigilar (documentado en el test de cierre).
import createOrderCoreSource from "./create-order-core.ts" with {
  type: "text",
};
import whatsappAgentCoreSource from "./whatsapp-agent-core.ts" with {
  type: "text",
};

const WATCHED_CORE_MODULES: Record<string, string> = {
  "create-order-core.ts": createOrderCoreSource,
  "whatsapp-agent-core.ts": whatsappAgentCoreSource,
};

interface ForbiddenPattern {
  name: string;
  pattern: RegExp;
}

// Los mismos tres tokens que pide el patrón, más las anotaciones de tipo
// Request/Response (una forma más sutil de acoplarse a fetch/HTTP sin pasar
// por http-security.ts ni por Deno.serve).
const FORBIDDEN_PATTERNS: ForbiddenPattern[] = [
  { name: "Deno.serve(...)", pattern: /\bDeno\.serve\s*\(/ },
  { name: "new Response(...)", pattern: /\bnew Response\s*\(/ },
  {
    name: "import de http-security.ts",
    pattern: /from\s+["'][^"']*http-security\.ts["']/,
  },
  { name: "anotación de tipo Request", pattern: /:\s*Request\b/ },
  { name: "anotación de tipo Response", pattern: /:\s*Response\b/ },
];

/** Pura y testable por separado: qué tokens prohibidos hay en un texto. */
export function findLayerBoundaryViolations(source: string): string[] {
  return FORBIDDEN_PATTERNS
    .filter(({ pattern }) => pattern.test(source))
    .map(({ name }) => name);
}

Deno.test("layer boundary: ningún *-core.ts vigilado se acopla a Deno.serve, Request/Response o http-security.ts", () => {
  const violations: string[] = [];
  for (const [name, source] of Object.entries(WATCHED_CORE_MODULES)) {
    if (source.length === 0) {
      throw new Error(`${name} se importó vacío — el import de texto falló`);
    }
    for (const violation of findLayerBoundaryViolations(source)) {
      violations.push(`${name}: ${violation}`);
    }
  }
  if (violations.length > 0) {
    throw new Error(
      `*-core.ts acoplado a framework/HTTP, rompe la frontera domain/framework:\n${
        violations.join("\n")
      }`,
    );
  }
});

Deno.test("layer boundary: la lista de módulos vigilados sigue viva (ancla defensiva)", () => {
  // Si algún día se agrega un *-core.ts nuevo bajo _shared/ sin sumarlo a
  // WATCHED_CORE_MODULES arriba, este test seguiría en verde pero la
  // frontera quedaría sin vigilar en silencio para ese archivo nuevo — no
  // hay --allow-read en CI para descubrirlo solo. Este test documenta la
  // lista viva y exige que cada entrada tenga contenido real, para que al
  // menos un import roto (typo en la ruta, archivo movido) falle aquí en
  // vez de dejar el conjunto vigilado encogerse en silencio.
  const watched = Object.keys(WATCHED_CORE_MODULES);
  const expected = ["create-order-core.ts", "whatsapp-agent-core.ts"];
  if (JSON.stringify(watched.sort()) !== JSON.stringify(expected.sort())) {
    throw new Error(
      `WATCHED_CORE_MODULES cambió sin actualizar este test: ${
        watched.join(", ")
      }`,
    );
  }
});

Deno.test("layer boundary: el detector realmente detecta cada token prohibido (control positivo)", () => {
  const cases: Array<{ label: string; snippet: string }> = [
    {
      label: "Deno.serve(...)",
      snippet: 'Deno.serve((req) => new Response("ok"));',
    },
    {
      label: "new Response(...)",
      snippet: 'function h() { return new Response("x"); }',
    },
    {
      label: "import de http-security.ts",
      snippet: 'import { jsonResponse } from "./http-security.ts";',
    },
    {
      label: "anotación de tipo Request",
      snippet: "function h(req: Request) {}",
    },
    {
      label: "anotación de tipo Response",
      snippet: "function h(): Response { return x; }",
    },
  ];
  for (const { label, snippet } of cases) {
    const found = findLayerBoundaryViolations(snippet);
    if (!found.includes(label)) {
      throw new Error(
        `el detector no marcó "${label}" en un snippet que sí lo contiene: ${snippet}`,
      );
    }
  }
  const clean = findLayerBoundaryViolations(
    "export function pureLogic(total: number): number { return total * 2; }",
  );
  if (clean.length > 0) {
    throw new Error(
      `falso positivo: código de dominio puro marcado como acoplado: ${
        clean.join(", ")
      }`,
    );
  }
});
