// Proxy autenticado a la API real de ElevenLabs para leer/editar la
// configuración del agente de voz (voz, idioma, velocidad, estabilidad,
// primer mensaje, prompt) desde el panel del cliente — la ÚNICA forma de
// que el editor en vivo funcione sin exponer la API key al navegador.
//
// La API key vive en Supabase Vault (vault.secrets, nombre
// ELEVENLABS_API_KEY), no como variable de entorno de esta función,
// porque así se guardó cuando Javier la pegó en el chat el 3-sep-2026.
//
// Acciones (POST, body { action, ... }):
//   { action: "get", agent_id }              -> config actual, solo campos seguros para el cliente
//   { action: "voices" }                      -> catálogo compartido de ElevenLabs, filtrado a español
//   { action: "update", agent_id, ... }       -> aplica cambios reales al agente
//   { action: "upload_knowledge_base", text, name? } -> sube un documento de texto
//                                                        a la base de conocimientos y
//                                                        devuelve su id real
//   { action: "upload_knowledge_base_file", file_base64, file_name, mime_type? } ->
//                                                        sube un documento binario real
//                                                        (PDF/imagen/etc., como lo suba el
//                                                        admin desde "Importar documento")
//                                                        a la base de conocimientos y
//                                                        devuelve su id real
//   { action: "set_knowledge_base", agent_id, knowledge_base } -> reemplaza el
//                                                        arreglo knowledge_base del agente
//   { action: "sync_knowledge_base", agent_id } -> regenera los documentos [Auto] de la
//                                                        base de conocimiento (menú, sucursales,
//                                                        ventas, personal) desde las tablas reales
//                                                        de este restaurante y los deja adjuntos
//                                                        al agente — nunca toca documentos subidos
//                                                        a mano (los que no llevan el prefijo [Auto])
//   { action: "set_languages", agent_id, languages, language_detection_enabled }
//                                              -> agrega/quita idiomas adicionales
//                                                 (conversation_config.language_presets)
//                                                 y activa/desactiva el built-in tool
//                                                 language_detection
//   { action: "list_conversations", agent_id?, page_size?, call_successful? } ->
//                                                        llamadas reales recientes (id, fecha,
//                                                        duración, resultado) — para revisar qué
//                                                        pasó de verdad en una llamada sin acceso
//                                                        al panel de ElevenLabs
//   { action: "get_conversation", conversation_id }   -> transcript completo turno-por-turno de
//                                                        una llamada real, incluyendo qué tools
//                                                        se llamaron y qué respondieron
//
// Nunca devuelve ni acepta nada de costos/créditos — eso es infraestructura
// interna, no algo que el dueño del restaurante deba ver.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { authorizeAgentConfig } from "../_shared/agent-config-auth.ts";
import { fetchWithTimeout as fetch } from "../_shared/fetch-timeout.ts";
import {
  HttpInputError,
  jsonResponse,
  originAllowed,
  preflightResponse,
  readJson,
} from "../_shared/http-security.ts";

// La cuenta real de ElevenLabs es de Javier — ya tenía voces clonadas
// personales suyas antes de este proyecto (Javier Cámara, Omar, Papá, etc.),
// sin relación con ningún restaurante. Para que "Mis voces" del panel de
// un restaurante nunca mezcle esas voces personales (ni, a futuro, las de
// otro restaurante que use la misma cuenta), cada voz clonada DESDE este
// panel se etiqueta con el restaurante que la creó — mis_voces solo
// devuelve las que traen esa etiqueta exacta, nunca todas las clonadas de
// la cuenta.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Agent-scoped operations derive their tenant from our own branches table;
// account-scoped operations must state a tenant explicitly. Never trust an
// arbitrary restaurant id when an agent id supplies the authoritative link.
// deno-lint-ignore no-explicit-any
async function resolveRestaurantId(supabase: any, body: Record<string, unknown>): Promise<string | null> {
  const requested = typeof body.restaurant_id === "string" && UUID_PATTERN.test(body.restaurant_id)
    ? body.restaurant_id
    : null;
  if (typeof body.agent_id !== "string") return requested;
  const { data, error } = await supabase.from("branches").select("restaurant_id")
    .eq("elevenlabs_agent_id", body.agent_id);
  if (error || !data?.length) return null;
  // Un restaurante puede reutilizar el mismo agente en varias sucursales.
  // Eso sigue siendo un tenant inequívoco; solo se rechaza si el agente está
  // vinculado accidentalmente a restaurantes distintos.
  const restaurantIds = new Set(data.map((row: { restaurant_id: string }) => row.restaurant_id));
  if (restaurantIds.size !== 1) return null;
  const derived = restaurantIds.values().next().value as string;
  return requested && requested !== derived ? null : derived;
}

// The generated database type is not imported in Edge Functions; this client
// is still scoped by the authorization check that runs before Vault access.
// deno-lint-ignore no-explicit-any
async function getApiKey(supabase: any): Promise<string> {
  const { data, error } = await supabase.rpc("get_secret", { secret_name: "ELEVENLABS_API_KEY" });
  if (error || !data) throw new Error("No se encontró la API key de ElevenLabs en Vault");
  return data as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  if (!originAllowed(req.headers.get("Origin"))) {
    return jsonResponse(req, { error: "Origen no permitido" }, 403);
  }
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Método no permitido" }, 405, {
      Allow: "POST, OPTIONS",
    });
  }

  const json = (body: unknown, status = 200) => jsonResponse(req, body, status);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await readJson<Record<string, unknown>>(req, 512 * 1024);
    const { action } = body;
    const restaurantId = await resolveRestaurantId(supabase, body);
    if (!restaurantId) return json({ error: "Tenant o agente inválido" }, 400);
    // Authenticate and scope before touching Vault or any ElevenLabs API.
    // The service-role client is intentionally used for the upstream calls,
    // so this check is the actual tenant boundary for the public function.
    const authz = await authorizeAgentConfig(
      supabase,
      req.headers.get("Authorization"),
      body,
      restaurantId,
    );
    if (authz.status !== 200) return json({ error: authz.error }, authz.status);
    const apiKey = await getApiKey(supabase);

    if (action === "llm_list") {
      const res = await fetch("https://api.elevenlabs.io/v1/convai/llm/list", {
        headers: { "xi-api-key": apiKey },
      });
      if (!res.ok) return json({ error: await res.text() }, res.status);
      return json(await res.json());
    }

    if (action === "add_tool") {
      const { agent_id, tool } = body as {
        agent_id?: string;
        // deno-lint-ignore no-explicit-any
        tool?: any;
      };
      if (!agent_id || !tool?.name) return json({ error: "agent_id y tool (con name) son requeridos" }, 400);

      const getRes = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agent_id}`, {
        headers: { "xi-api-key": apiKey },
      });
      if (!getRes.ok) return json({ error: await getRes.text() }, getRes.status);
      const current = await getRes.json();
      // deno-lint-ignore no-explicit-any
      const tools: any[] = current.conversation_config?.agent?.prompt?.tools ?? [];
      if (tools.some((t) => t.name === tool.name)) return json({ ok: true, already_existed: true });

      const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agent_id}`, {
        method: "PATCH",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_config: { agent: { prompt: { tools: [...tools, tool] } } } }),
      });
      if (!res.ok) return json({ error: await res.text() }, res.status);
      return json({ ok: true });
    }

    if (action === "set_tools") {
      // Reemplaza el arreglo de tools completo (para editar un tool
      // existente, no solo añadir uno nuevo) — acción admin acotada al
      // arreglo de tools, igual que add_tool.
      const { agent_id, tools } = body as {
        agent_id?: string;
        // deno-lint-ignore no-explicit-any
        tools?: any[];
      };
      if (!agent_id || !Array.isArray(tools)) return json({ error: "agent_id y tools (arreglo) son requeridos" }, 400);

      const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agent_id}`, {
        method: "PATCH",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_config: { agent: { prompt: { tools } } } }),
      });
      if (!res.ok) return json({ error: await res.text() }, res.status);
      return json({ ok: true });
    }

    if (action === "upload_knowledge_base") {
      // Sube un documento de texto a la base de conocimientos compartida de
      // ElevenLabs. Endpoint real confirmado contra la documentación oficial
      // (developers.elevenlabs.io/docs/api-reference/knowledge-base/create-from-text):
      //   POST https://api.elevenlabs.io/v1/convai/knowledge-base/text
      //   body: { text, name? } -> devuelve { id, name, folder_path }
      const { text, name } = body as { text?: string; name?: string };
      if (!text) return json({ error: "text es requerido" }, 400);

      const res = await fetch("https://api.elevenlabs.io/v1/convai/knowledge-base/text", {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ text, ...(name ? { name } : {}) }),
      });
      if (!res.ok) return json({ error: await res.text() }, res.status);
      const data = await res.json();
      return json({ id: data.id, name: data.name });
    }

    if (action === "upload_knowledge_base_file") {
      // Sube un documento BINARIO real (PDF, imagen, etc.) a la base de
      // conocimientos compartida de ElevenLabs — hermano binario de
      // upload_knowledge_base (texto), mismo patrón multipart que ya usa
      // clone_voice más abajo en este archivo (base64 -> Blob -> FormData,
      // sin fijar Content-Type a mano para que fetch ponga el boundary).
      // Endpoint real, hermano documentado de knowledge-base/text:
      //   POST https://api.elevenlabs.io/v1/convai/knowledge-base/file
      //   multipart/form-data: file (binario), name (opcional)
      //   -> { id, name }
      // NOTA REAL (no verificable desde este entorno, sin forma de hacer un
      // POST multipart real contra la API de ElevenLabs aquí): un PDF de
      // verdad debería indexarse por texto sin problema; una imagen suelta
      // (foto de un menú, por ejemplo) puede que ElevenLabs la acepte pero
      // NO la transcriba por OCR — o puede rechazarla directamente. Esta
      // acción nunca inventa esa respuesta: deja pasar tal cual lo que
      // devuelva la API real, éxito o error, para que quede claro en el
      // panel qué formatos funcionan de verdad.
      const { file_base64, file_name, mime_type } = body as {
        file_base64?: string;
        file_name?: string;
        mime_type?: string;
      };
      if (!file_base64 || !file_name) {
        return json({ error: "file_base64 y file_name son requeridos" }, 400);
      }

      let base64Decodificable: string;
      try {
        base64Decodificable = atob(file_base64);
      } catch {
        return json({ error: "file_base64 no es base64 válido" }, 400);
      }
      const LIMITE_BYTES = 20 * 1024 * 1024; // 20 MB — tope defensivo del lado de esta función, no un límite real confirmado de ElevenLabs
      if (base64Decodificable.length > LIMITE_BYTES) {
        return json({ error: "El archivo pesa más de 20 MB — intenta con uno más ligero" }, 400);
      }
      const binario = Uint8Array.from(base64Decodificable, (c) => c.charCodeAt(0));

      const form = new FormData();
      form.append("file", new Blob([binario], { type: mime_type || "application/octet-stream" }), file_name);
      form.append("name", file_name);

      const res = await fetch("https://api.elevenlabs.io/v1/convai/knowledge-base/file", {
        method: "POST",
        headers: { "xi-api-key": apiKey },
        body: form,
      });
      if (!res.ok) return json({ error: await res.text() }, res.status);
      const data = await res.json();
      return json({ id: data.id, name: data.name });
    }

    if (action === "set_knowledge_base") {
      // Reemplaza el arreglo completo de knowledge_base del agente (mismo
      // patrón que set_tools: leer, modificar el arreglo, volver a mandar el
      // arreglo completo) — para adjuntar un documento nuevo y/o quitar uno
      // viejo sin tocar el resto de la configuración del agente.
      const { agent_id, knowledge_base } = body as {
        agent_id?: string;
        // deno-lint-ignore no-explicit-any
        knowledge_base?: any[];
      };
      if (!agent_id || !Array.isArray(knowledge_base)) {
        return json({ error: "agent_id y knowledge_base (arreglo) son requeridos" }, 400);
      }

      const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agent_id}`, {
        method: "PATCH",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_config: { agent: { prompt: { knowledge_base } } } }),
      });
      if (!res.ok) return json({ error: await res.text() }, res.status);
      return json({ ok: true });
    }

    if (action === "sync_knowledge_base") {
      // Regenera la base de conocimiento del agente de voz a partir de
      // datos REALES de este restaurante — nunca relleno. Cuatro
      // documentos (menú, sucursales, estadísticas de ventas, personal),
      // subidos vía el mismo endpoint que upload_knowledge_base y
      // adjuntados al agente vía el mismo patrón que set_knowledge_base.
      // Cada documento generado aquí se marca con el prefijo "[Auto] " en
      // el nombre — SOLO esos se reemplazan en cada sync; cualquier
      // documento subido a mano (ej. con "Importar documento") se
      // conserva intacto.
      const { agent_id } = body as { agent_id?: string };
      if (!agent_id) return json({ error: "agent_id requerido" }, 400);

      const ahora = new Date();
      const fechaTexto = ahora.toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Merida" });
      const formatoMXN = (n: number) =>
        (n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });
      const desde7 = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const desde30 = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const desde90 = new Date(ahora.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const [
        { data: restauranteRow },
        { data: sucursales },
        { data: categorias },
        { data: productos },
        { count: overridesSucursal },
        { data: staffRows },
        { count: totalClientes },
        { data: topClientes },
        { data: ordenesResumen },
        { data: itemsRecientes },
        { data: colonias },
      ] = await Promise.all([
        supabase.from("restaurants").select("name").eq("id", restaurantId).maybeSingle(),
        supabase.from("branches").select("id, name, address, phone, hours, is_active, voice_agent_active, whatsapp_agent_active, lat, lng").eq("restaurant_id", restaurantId).order("display_order"),
        supabase.from("categories").select("id, name, display_order").eq("restaurant_id", restaurantId).order("display_order"),
        supabase.from("products").select("id, name, description, price, category_id, is_available, is_popular").eq("restaurant_id", restaurantId).order("display_order"),
        supabase.from("branch_products").select("id, branches!inner(restaurant_id)", { count: "exact", head: true }).eq("branches.restaurant_id", restaurantId),
        supabase.from("restaurant_staff").select("role, user_id").eq("restaurant_id", restaurantId),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId),
        supabase.from("customers").select("name, order_count, last_order_at").eq("restaurant_id", restaurantId).order("order_count", { ascending: false }).limit(10),
        // Agregados reales de TODO el histórico — columnas angostas nada más
        // (total/status/source/branch_id/created_at), no el pedido completo,
        // con un tope defensivo por si el volumen crece mucho más.
        supabase.from("orders").select("total, status, source, branch_id, created_at").eq("restaurant_id", restaurantId).limit(200000),
        // Top de productos: acotado a los ~90 días y 10,000 pedidos más
        // recientes (no los 90,000 históricos completos) — un aggregate
        // real y representativo, no cada fila cruda del histórico completo.
        supabase.from("orders").select("items").eq("restaurant_id", restaurantId).gte("created_at", desde90).order("created_at", { ascending: false }).limit(10000),
        supabase.from("merida_colonias").select("nombre, lat, lng").order("nombre"),
      ]);

      const nombreRestaurante = restauranteRow?.name ?? "el restaurante";

      // deno-lint-ignore no-explicit-any
      const staffUserIds = (staffRows ?? []).map((s: any) => s.user_id);
      const { data: repartidoresTenant } = staffUserIds.length
        ? await supabase.from("repartidor_perfil")
          .select("user_id, nombre_completo, tipo_vehiculo, fecha_alta")
          .in("user_id", staffUserIds)
        : { data: [] as { user_id: string; nombre_completo: string; tipo_vehiculo: string; fecha_alta: string }[] };
      const repartidoresDelTenant = repartidoresTenant ?? [];
      const { data: staffPerfiles } = staffUserIds.length
        ? await supabase.from("profiles").select("user_id, nombre, email, telefono").in("user_id", staffUserIds)
        : { data: [] as { user_id: string; nombre: string | null; email: string; telefono: string | null }[] };

      // --- Documento 1: menú, precios y categorías -----------------------
      // deno-lint-ignore no-explicit-any
      const categoriasOrdenadas = [...(categorias ?? [])].sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
      // deno-lint-ignore no-explicit-any
      const productosPorCategoria = new Map<string, any[]>();
      // deno-lint-ignore no-explicit-any
      for (const p of (productos ?? []) as any[]) {
        const key = p.category_id ?? "sin-categoria";
        if (!productosPorCategoria.has(key)) productosPorCategoria.set(key, []);
        productosPorCategoria.get(key)!.push(p);
      }
      let textoMenu = `# Menú, precios y categorías — ${nombreRestaurante}\nActualizado: ${fechaTexto}\n\n`;
      // deno-lint-ignore no-explicit-any
      for (const cat of categoriasOrdenadas as any[]) {
        const items = productosPorCategoria.get(cat.id) ?? [];
        if (items.length === 0) continue;
        textoMenu += `## ${cat.name}\n`;
        for (const p of items) {
          const estado = p.is_available === false ? " (no disponible actualmente)" : "";
          const popular = p.is_popular ? " ⭐ popular" : "";
          textoMenu += `- ${p.name} — ${formatoMXN(Number(p.price))}${estado}${popular}${p.description ? ` — ${p.description}` : ""}\n`;
        }
        textoMenu += `\n`;
      }
      const sinCategoria = productosPorCategoria.get("sin-categoria") ?? [];
      if (sinCategoria.length > 0) {
        textoMenu += `## Sin categoría\n`;
        for (const p of sinCategoria) textoMenu += `- ${p.name} — ${formatoMXN(Number(p.price))}\n`;
        textoMenu += `\n`;
      }
      textoMenu += `---\nEstos son los precios BASE del restaurante. ${overridesSucursal ?? 0} combinaciones producto-sucursal tienen un precio o disponibilidad distinto a esta lista — antes de confirmar un precio con el cliente, confírmalo siempre con la herramienta buscar_producto para la sucursal exacta.\n`;

      // --- Documento 2: sucursales, horarios y contacto -------------------
      let textoSucursales = `# Sucursales, horarios y contacto — ${nombreRestaurante}\nActualizado: ${fechaTexto}\n\n`;
      // deno-lint-ignore no-explicit-any
      for (const s of (sucursales ?? []) as any[]) {
        textoSucursales += `## ${s.name}\n`;
        textoSucursales += `- Dirección: ${s.address ?? "sin dirección registrada"}\n`;
        textoSucursales += `- Teléfono: ${s.phone ?? "sin teléfono registrado"}\n`;
        textoSucursales += `- Horario: ${s.hours ?? "sin horario registrado"}\n`;
        textoSucursales += `- Estado: ${s.is_active ? "activa" : "inactiva"}\n`;
        const canales = [s.voice_agent_active ? "llamadas de voz" : null, s.whatsapp_agent_active ? "WhatsApp" : null].filter(Boolean);
        textoSucursales += `- Canales de pedido con agente activo: ${canales.length ? canales.join(" y ") : "ninguno activo actualmente"}\n\n`;
      }

      // --- Documento 3: estadísticas reales de ventas y pedidos -----------
      // deno-lint-ignore no-explicit-any
      const ordenes = (ordenesResumen ?? []) as any[];
      const totalPedidos = ordenes.length;
      const conteoPorEstado = new Map<string, number>();
      const ingresoPorEstado = new Map<string, number>();
      const conteoPorFuente = new Map<string, number>();
      const ingresoPorFuente = new Map<string, number>();
      const conteoPorSucursal = new Map<string, number>();
      const ingresoPorSucursal = new Map<string, number>();
      let ingresoBruto = 0, ingreso7 = 0, pedidos7 = 0, ingreso30 = 0, pedidos30 = 0;
      for (const o of ordenes) {
        const total = Number(o.total) || 0;
        ingresoBruto += total;
        const estado = o.status ?? "sin_estado";
        conteoPorEstado.set(estado, (conteoPorEstado.get(estado) ?? 0) + 1);
        ingresoPorEstado.set(estado, (ingresoPorEstado.get(estado) ?? 0) + total);
        const fuente = o.source ?? "desconocido";
        conteoPorFuente.set(fuente, (conteoPorFuente.get(fuente) ?? 0) + 1);
        ingresoPorFuente.set(fuente, (ingresoPorFuente.get(fuente) ?? 0) + total);
        if (o.branch_id) {
          conteoPorSucursal.set(o.branch_id, (conteoPorSucursal.get(o.branch_id) ?? 0) + 1);
          ingresoPorSucursal.set(o.branch_id, (ingresoPorSucursal.get(o.branch_id) ?? 0) + total);
        }
        if (o.created_at) {
          if (o.created_at >= desde7) { ingreso7 += total; pedidos7++; }
          if (o.created_at >= desde30) { ingreso30 += total; pedidos30++; }
        }
      }
      const entregados = (conteoPorEstado.get("entregado") ?? 0) + (conteoPorEstado.get("completado") ?? 0);
      const ingresoEntregado = (ingresoPorEstado.get("entregado") ?? 0) + (ingresoPorEstado.get("completado") ?? 0);
      const ingresoCancelado = ingresoPorEstado.get("cancelado") ?? 0;
      const ticketPromedio = entregados > 0 ? ingresoEntregado / entregados : 0;
      // deno-lint-ignore no-explicit-any
      const nombreSucursalPorId = new Map(((sucursales ?? []) as any[]).map((s) => [s.id, s.name]));

      const conteoProductos = new Map<string, number>();
      // deno-lint-ignore no-explicit-any
      for (const o of (itemsRecientes ?? []) as any[]) {
        // deno-lint-ignore no-explicit-any
        const items = (o.items ?? []) as any[];
        for (const it of items) {
          const key = it.name ?? it.id ?? "—";
          conteoProductos.set(key, (conteoProductos.get(key) ?? 0) + (Number(it.quantity) || 0));
        }
      }
      const topProductos = [...conteoProductos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);

      let textoEstadisticas = `# Estadísticas reales de ventas y pedidos — ${nombreRestaurante}\nActualizado: ${fechaTexto}\n\n`;
      textoEstadisticas += `## Volumen histórico\n- Pedidos totales registrados: ${totalPedidos.toLocaleString("es-MX")}\n`;
      for (const [estado, n] of [...conteoPorEstado.entries()].sort((a, b) => b[1] - a[1])) {
        textoEstadisticas += `  - ${estado}: ${n.toLocaleString("es-MX")}\n`;
      }
      textoEstadisticas += `\n## Ingresos\n`;
      textoEstadisticas += `- Ingreso bruto (todos los pedidos, incluidos cancelados): ${formatoMXN(ingresoBruto)}\n`;
      textoEstadisticas += `- Ingreso real (pedidos entregados/completados): ${formatoMXN(ingresoEntregado)}\n`;
      textoEstadisticas += `- Monto perdido en pedidos cancelados: ${formatoMXN(ingresoCancelado)}\n`;
      textoEstadisticas += `- Ticket promedio (pedidos entregados): ${formatoMXN(ticketPromedio)}\n`;
      textoEstadisticas += `- Ingreso en los últimos 7 días: ${formatoMXN(ingreso7)} (${pedidos7} pedidos)\n`;
      textoEstadisticas += `- Ingreso en los últimos 30 días: ${formatoMXN(ingreso30)} (${pedidos30} pedidos)\n\n`;
      textoEstadisticas += `## Por canal\n`;
      for (const [fuente, n] of [...conteoPorFuente.entries()].sort((a, b) => b[1] - a[1])) {
        const pct = totalPedidos > 0 ? ((n / totalPedidos) * 100).toFixed(1) : "0";
        textoEstadisticas += `- ${fuente}: ${n.toLocaleString("es-MX")} pedidos (${pct}%) — ${formatoMXN(ingresoPorFuente.get(fuente) ?? 0)}\n`;
      }
      textoEstadisticas += `\n## Por sucursal\n`;
      for (const [branchId, n] of [...conteoPorSucursal.entries()].sort((a, b) => b[1] - a[1])) {
        const nombre = nombreSucursalPorId.get(branchId) ?? branchId;
        textoEstadisticas += `- ${nombre}: ${n.toLocaleString("es-MX")} pedidos — ${formatoMXN(ingresoPorSucursal.get(branchId) ?? 0)}\n`;
      }
      textoEstadisticas += `\n## Productos más pedidos (agregado real de los pedidos más recientes, hasta 10,000/últimos ~90 días)\n`;
      for (const [nombre, cantidad] of topProductos) textoEstadisticas += `- ${nombre}: ${cantidad.toLocaleString("es-MX")} unidades\n`;
      textoEstadisticas += `\n## Clientes\n`;
      textoEstadisticas += `- Clientes registrados: ${(totalClientes ?? 0).toLocaleString("es-MX")}\n`;
      textoEstadisticas += `- Clientes más frecuentes por número de pedidos (sin teléfono aquí por privacidad — usa la herramienta buscar_cliente en vivo para identificar a alguien por su número):\n`;
      // deno-lint-ignore no-explicit-any
      for (const c of (topClientes ?? []) as any[]) {
        textoEstadisticas += `  - ${c.name ?? "Cliente sin nombre registrado"}: ${c.order_count} pedidos${c.last_order_at ? `, último el ${new Date(c.last_order_at).toLocaleDateString("es-MX")}` : ""}\n`;
      }

      // --- Documento 4: personal y equipo ---------------------------------
      let textoPersonal = `# Personal y equipo — ${nombreRestaurante}\nActualizado: ${fechaTexto}\n\n`;
      textoPersonal += `## Equipo administrativo\n`;
      if ((staffRows ?? []).length === 0) {
        textoPersonal += `Sin personal administrativo dado de alta en el sistema.\n\n`;
      } else {
        // deno-lint-ignore no-explicit-any
        for (const s of (staffRows ?? []) as any[]) {
          // deno-lint-ignore no-explicit-any
          const perfil = ((staffPerfiles ?? []) as any[]).find((p) => p.user_id === s.user_id);
          textoPersonal += `- ${perfil?.nombre ?? "Sin nombre registrado"} — rol: ${s.role}${perfil?.email ? ` — ${perfil.email}` : ""}${perfil?.telefono ? ` — ${perfil.telefono}` : ""}\n`;
        }
        textoPersonal += `\n`;
      }
      textoPersonal += `## Repartidores\n`;
      if (repartidoresDelTenant.length === 0) {
        textoPersonal += `Actualmente no hay repartidores dados de alta en el sistema (repartidor_perfil está vacía). Cuando se registre uno real, este documento lo reflejará la próxima vez que se sincronice la base de conocimiento — no hay datos de repartidores que mostrar hoy.\n`;
      } else {
        // deno-lint-ignore no-explicit-any
        for (const r of repartidoresDelTenant as any[]) {
          textoPersonal += `- ${r.nombre_completo} — vehículo: ${r.tipo_vehiculo} — de alta desde ${new Date(r.fecha_alta).toLocaleDateString("es-MX")}\n`;
        }
      }

      // --- Documento 5: colonias y su sucursal más cercana ----------------
      // Bug real encontrado el 3-sep-2026 (llamada real de prueba de
      // Javier): la propia colonia "altabrisa" tenía coordenadas viejas en
      // merida_colonias y se coloneaba a la sucursal equivocada (Prol.
      // Montejo en vez de Altabrisa) — un error así es invisible mientras
      // vive solo dentro de la llamada a la herramienta en vivo. Este
      // documento hace el mismo cálculo real que sucursal_mas_cercana
      // (misma fórmula de distancia great-circle) para las ~200+ colonias
      // reales, como referencia de auditoría para el equipo — no reemplaza
      // la herramienta en vivo (los datos pueden cambiar entre sync), pero
      // deja a la vista cualquier asignación que no cuadre a simple vista.
      const distanciaKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const rad = Math.PI / 180;
        const cosVal =
          Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos(lng2 * rad - lng1 * rad) +
          Math.sin(lat1 * rad) * Math.sin(lat2 * rad);
        const clamped = Math.min(1, Math.max(-1, cosVal));
        return Math.round(6371 * Math.acos(clamped) * 10) / 10;
      };
      // deno-lint-ignore no-explicit-any
      const sucursalesConCoords = ((sucursales ?? []) as any[]).filter((s) => s.is_active && s.lat != null && s.lng != null);
      let textoColonias = `# Colonias y su sucursal más cercana — ${nombreRestaurante}\nActualizado: ${fechaTexto}\n\n`;
      textoColonias += `Calculado con las coordenadas reales de cada colonia y cada sucursal — mismo cálculo real que usa la herramienta buscar_sucursal_cercana en cada llamada/chat real. Referencia de auditoría; si una colonia real falta aquí, agrégala primero a la base de datos, no la inventes en este documento.\n\n`;
      // deno-lint-ignore no-explicit-any
      for (const c of (colonias ?? []) as any[]) {
        if (c.lat == null || c.lng == null) continue;
        const distancias = sucursalesConCoords
          .map((s) => ({ nombre: s.name, km: distanciaKm(Number(c.lat), Number(c.lng), Number(s.lat), Number(s.lng)) }))
          .sort((a, b) => a.km - b.km);
        const [primera, segunda] = distancias;
        if (!primera) continue;
        const aviso = segunda && segunda.km - primera.km < 1 ? "  ⚠️ muy cerca de la 2ª opción, revisar coordenadas si algo se ve raro" : "";
        textoColonias += `- ${c.nombre} → **${primera.nombre}** (${primera.km} km)${segunda ? `, 2ª más cercana: ${segunda.nombre} (${segunda.km} km)` : ""}${aviso}\n`;
      }

      // --- Subir y reemplazar solo los documentos [Auto] ------------------
      const PREFIJO_AUTO = "[Auto] ";
      const documentosGenerados = [
        { name: `${PREFIJO_AUTO}Menú, precios y categorías`, text: textoMenu },
        { name: `${PREFIJO_AUTO}Sucursales, horarios y contacto`, text: textoSucursales },
        { name: `${PREFIJO_AUTO}Estadísticas de ventas y pedidos`, text: textoEstadisticas },
        { name: `${PREFIJO_AUTO}Personal y equipo`, text: textoPersonal },
        { name: `${PREFIJO_AUTO}Colonias y sucursal más cercana`, text: textoColonias },
      ];

      const getRes = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agent_id}`, {
        headers: { "xi-api-key": apiKey },
      });
      if (!getRes.ok) return json({ error: await getRes.text() }, getRes.status);
      const agenteActual = await getRes.json();
      // deno-lint-ignore no-explicit-any
      const kbActual: any[] = agenteActual.conversation_config?.agent?.prompt?.knowledge_base ?? [];
      const documentosManuales = kbActual.filter((k) => !String(k.name ?? "").startsWith(PREFIJO_AUTO));
      const documentosAutoViejos = kbActual.filter((k) => String(k.name ?? "").startsWith(PREFIJO_AUTO));

      const documentosNuevos: { id: string; name: string; type: string }[] = [];
      for (const doc of documentosGenerados) {
        const subeRes = await fetch("https://api.elevenlabs.io/v1/convai/knowledge-base/text", {
          method: "POST",
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ text: doc.text, name: doc.name }),
        });
        if (!subeRes.ok) return json({ error: `No se pudo subir "${doc.name}": ${await subeRes.text()}` }, subeRes.status);
        const subida = await subeRes.json();
        documentosNuevos.push({ id: subida.id, name: subida.name, type: "text" });
      }

      const kbFinal = [...documentosManuales, ...documentosNuevos];
      const patchRes = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agent_id}`, {
        method: "PATCH",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_config: { agent: { prompt: { knowledge_base: kbFinal } } } }),
      });
      if (!patchRes.ok) return json({ error: await patchRes.text() }, patchRes.status);

      // Solo ahora, con el agente ya apuntando a los documentos nuevos, se
      // borran del store los [Auto] de la sincronización anterior —
      // best-effort: si uno falla no se rompe el sync, el agente ya quedó
      // con los datos frescos, que es lo que importa.
      for (const viejo of documentosAutoViejos) {
        if (!viejo?.id) continue;
        try {
          await fetch(`https://api.elevenlabs.io/v1/convai/knowledge-base/${viejo.id}`, {
            method: "DELETE",
            headers: { "xi-api-key": apiKey },
          });
        } catch (err) {
          console.error(`sync_knowledge_base: no se pudo borrar el documento viejo ${viejo.id}:`, err);
        }
      }

      return json({
        ok: true,
        documentos: documentosNuevos.map((d) => ({ id: d.id, name: d.name })),
        reemplazados: documentosAutoViejos.length,
      });
    }

    if (action === "set_languages") {
      // Agrega/quita idiomas adicionales del agente (conversation_config.language_presets,
      // objeto keyed por código de idioma, confirmado contra la documentación oficial de
      // ElevenLabs: cada entrada trae { overrides: {...} } con los overrides opcionales
      // de ese idioma) y activa/desactiva el built-in tool nativo language_detection
      // (agent.prompt.built_in_tools.language_detection) que detecta y cambia de idioma
      // en vivo durante la llamada.
      //
      // Mismo patrón que set_tools/set_knowledge_base: se lee el estado completo actual
      // de ambos objetos y se reenvía completo — para no perder llaves que esta llamada
      // no está tocando (ej. el tool end_call ya configurado dentro de built_in_tools, o
      // el override guardado de un idioma que no cambió en esta edición).
      const { agent_id, languages, language_detection_enabled } = body as {
        agent_id?: string;
        languages?: string[];
        language_detection_enabled?: boolean;
      };
      if (!agent_id || !Array.isArray(languages)) {
        return json({ error: "agent_id y languages (arreglo de códigos de idioma) son requeridos" }, 400);
      }

      const getRes = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agent_id}`, {
        headers: { "xi-api-key": apiKey },
      });
      if (!getRes.ok) return json({ error: await getRes.text() }, getRes.status);
      const current = await getRes.json();

      // deno-lint-ignore no-explicit-any
      const presetsActuales: Record<string, any> = current.conversation_config?.language_presets ?? {};
      // deno-lint-ignore no-explicit-any
      const nuevosPresets: Record<string, any> = {};
      for (const codigo of languages) {
        // Si el idioma ya tenía overrides guardados (ej. primer mensaje o voz
        // propia de ese idioma), se conservan tal cual; si es nuevo, se agrega
        // sin overrides (usa la config general del agente para ese idioma).
        nuevosPresets[codigo] = presetsActuales[codigo] ?? { overrides: {} };
      }

      // deno-lint-ignore no-explicit-any
      const builtInToolsActuales: Record<string, any> = current.conversation_config?.agent?.prompt?.built_in_tools ?? {};
      const nuevoBuiltInTools = {
        ...builtInToolsActuales,
        language_detection: language_detection_enabled
          ? {
            type: "system",
            name: "language_detection",
            description: "",
            params: { system_tool_type: "language_detection" },
          }
          : null,
      };

      const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agent_id}`, {
        method: "PATCH",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_config: {
            language_presets: nuevosPresets,
            agent: { prompt: { built_in_tools: nuevoBuiltInTools } },
          },
        }),
      });
      if (!res.ok) return json({ error: await res.text() }, res.status);
      return json({ ok: true });
    }

    if (action === "get_raw") {
      const { agent_id } = body;
      if (!agent_id) return json({ error: "agent_id requerido" }, 400);
      const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agent_id}`, {
        headers: { "xi-api-key": apiKey },
      });
      if (!res.ok) return json({ error: await res.text() }, res.status);
      return json(await res.json());
    }

    // Pedido real de Javier el 3-sep-2026: revisar llamadas de voz reales
    // (transcript real, no simulado) sin poder hacer la llamada él mismo —
    // ver qué pasó de verdad cuando reportó un bug. Endpoints reales
    // documentados: GET /v1/convai/conversations (lista, filtrable por
    // agent_id) y GET /v1/convai/conversations/{conversation_id} (detalle
    // completo, incluye transcript turno-por-turno con qué tools se
    // llamaron y qué respondieron).
    if (action === "list_conversations") {
      const { agent_id, page_size, call_successful } = body as {
        agent_id?: string;
        page_size?: number;
        call_successful?: string;
      };
      const params = new URLSearchParams();
      if (agent_id) params.set("agent_id", agent_id);
      params.set("page_size", String(page_size ?? 20));
      if (call_successful) params.set("call_successful", call_successful);
      const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversations?${params}`, {
        headers: { "xi-api-key": apiKey },
      });
      if (!res.ok) return json({ error: await res.text() }, res.status);
      return json(await res.json());
    }

    if (action === "get_conversation") {
      const { conversation_id, agent_id } = body as { conversation_id?: string; agent_id?: string };
      if (!conversation_id || !agent_id) return json({ error: "conversation_id y agent_id requeridos" }, 400);
      const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${conversation_id}`, {
        headers: { "xi-api-key": apiKey },
      });
      if (!res.ok) return json({ error: await res.text() }, res.status);
      const conversation = await res.json();
      // Defense in depth: never return a transcript if ElevenLabs associates
      // the conversation with a different agent than the one authorized above.
      if (conversation?.agent_id !== agent_id) {
        return json({ error: "Sin permisos" }, 403);
      }
      return json(conversation);
    }

    if (action === "get") {
      const { agent_id } = body;
      if (!agent_id) return json({ error: "agent_id requerido" }, 400);
      const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agent_id}`, {
        headers: { "xi-api-key": apiKey },
      });
      if (!res.ok) return json({ error: await res.text() }, res.status);
      const data = await res.json();
      const agent = data.conversation_config?.agent ?? {};
      const tts = data.conversation_config?.tts ?? {};
      const conversation = data.conversation_config?.conversation ?? {};
      const backgroundSound = conversation.background_sound ?? {};
      return json({
        name: data.name,
        first_message: agent.first_message ?? "",
        language: agent.language ?? "es",
        additional_languages: Object.keys(data.conversation_config?.language_presets ?? {}),
        language_detection_enabled: !!(agent.prompt?.built_in_tools?.language_detection),
        prompt: agent.prompt?.prompt ?? "",
        temperature: agent.prompt?.temperature ?? 0.4,
        llm: agent.prompt?.llm ?? "",
        backup_llm: agent.prompt?.backup_llm_config?.order?.[0] ?? "",
        backup_llms: agent.prompt?.backup_llm_config?.order ?? [],
        voice_id: tts.voice_id ?? null,
        speed: tts.speed ?? 1.0,
        stability: tts.stability ?? 0.5,
        similarity_boost: tts.similarity_boost ?? 0.8,
        background_sound_id: backgroundSound.source_id ?? null,
        background_sound_volume: backgroundSound.volume ?? 0.15,
        background_sound_crossfade: backgroundSound.crossfade_loop ?? true,
        first_message_interruptible: agent.disable_first_message_interruptions !== true,
        // deno-lint-ignore no-explicit-any
        tools: (agent.prompt?.tools ?? []).map((t: any) => ({ type: t.type, name: t.name })),
        // deno-lint-ignore no-explicit-any
        knowledge_base: (agent.prompt?.knowledge_base ?? []).map((k: any) => ({ id: k.id, name: k.name, type: k.type })),
      });
    }

    if (action === "signed_url") {
      const { agent_id } = body as { agent_id?: string };
      if (typeof agent_id !== "string" || !agent_id) {
        return json({ error: "agent_id requerido" }, 400);
      }
      const res = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agent_id)}`,
        { headers: { "xi-api-key": apiKey } },
      );
      if (!res.ok) return json({ error: await res.text() }, res.status);
      const data = await res.json();
      return json({ signed_url: data.signed_url });
    }

    if (action === "voices") {
      // Pagina de verdad todo el catálogo compartido en español — antes se
      // pedía una sola página de 60 y se recortaba ahí, aunque la
      // biblioteca real de ElevenLabs trae más voces que esas.
      // deno-lint-ignore no-explicit-any
      let todas: any[] = [];
      for (let pagina = 0; pagina < 10; pagina++) {
        const url = new URL("https://api.elevenlabs.io/v1/shared-voices");
        url.searchParams.set("language", "es");
        url.searchParams.set("page_size", "100");
        url.searchParams.set("page", String(pagina));
        const res = await fetch(url, { headers: { "xi-api-key": apiKey } });
        if (!res.ok) return json({ error: await res.text() }, res.status);
        const data = await res.json();
        todas = todas.concat(data.voices ?? []);
        if (!data.has_more) break;
      }
      // deno-lint-ignore no-explicit-any
      const voces = todas.filter((v: any) => {
        const acento = (v.accent ?? "").toLowerCase();
        return acento.includes("latin") || acento.includes("mexic") || acento.includes("colomb")
          || acento.includes("argentin") || acento.includes("neutral");
      // deno-lint-ignore no-explicit-any
      }).map((v: any) => ({
        voice_id: v.voice_id,
        public_owner_id: v.public_owner_id,
        name: v.name,
        gender: v.gender,
        accent: v.accent,
        description: v.description,
        preview_url: v.preview_url,
      }));
      return json({ voices: voces });
    }

    if (action === "mis_voces") {
      const res = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": apiKey },
      });
      if (!res.ok) return json({ error: await res.text() }, res.status);
      const data = await res.json();
      // Solo voces clonadas DESDE este panel para ESTE restaurante — nunca
      // las voces personales de Javier ni las de otro restaurante que
      // comparta la misma cuenta de ElevenLabs.
      // deno-lint-ignore no-explicit-any
      const voces = (data.voices ?? []).filter((v: any) => v.category === "cloned" && v.labels?.restaurant_id === restaurantId).map((v: any) => ({
        voice_id: v.voice_id,
        public_owner_id: "",
        name: v.name,
        gender: v.labels?.gender ?? "—",
        accent: v.labels?.accent ?? "clonada",
        description: v.labels?.description ?? "",
        preview_url: v.preview_url ?? "",
      }));
      return json({ voices: voces });
    }

    if (action === "clone_voice") {
      // deno-lint-ignore no-explicit-any
      const { name, samples, remove_background_noise } = body as { name?: string; samples?: any[]; remove_background_noise?: boolean };
      if (!name || !samples || !Array.isArray(samples) || samples.length === 0) {
        return json({ error: "name y samples (al menos 1 audio) son requeridos" }, 400);
      }

      const form = new FormData();
      form.append("name", name);
      form.append("labels", JSON.stringify({ restaurant_id: restaurantId }));
      if (remove_background_noise !== undefined) form.append("remove_background_noise", String(remove_background_noise));
      samples.forEach((s, i) => {
        const binario = Uint8Array.from(atob(s.audio_base64), (c) => c.charCodeAt(0));
        form.append("files", new Blob([binario], { type: s.mime_type || "audio/webm" }), `muestra-${i + 1}.webm`);
      });

      const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
        method: "POST",
        headers: { "xi-api-key": apiKey },
        body: form,
      });
      if (!res.ok) return json({ error: await res.text() }, res.status);
      const data = await res.json();
      return json({ voice_id: data.voice_id });
    }

    if (action === "update") {
      const {
        agent_id, name, first_message, language, prompt, temperature, voice_id, voice_public_owner_id, speed, stability, similarity_boost,
        background_sound_id, background_sound_volume, background_sound_crossfade, first_message_interruptible,
        llm, backup_llm, reasoning_effort, dynamic_variable_placeholders,
      } = body as { dynamic_variable_placeholders?: Record<string, string> } & Record<string, unknown>;
      if (!agent_id) return json({ error: "agent_id requerido" }, 400);

      if (voice_id && voice_public_owner_id) {
        const addRes = await fetch(`https://api.elevenlabs.io/v1/voices/add/${voice_public_owner_id}/${voice_id}`, {
          method: "POST",
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ new_name: `Voz — Los Taquitos de PM` }),
        });
        if (!addRes.ok) {
          const detalle = await addRes.text();
          if (!detalle.includes("already")) return json({ error: `No se pudo añadir la voz a tu biblioteca: ${detalle}` }, addRes.status);
        }
      }

      // deno-lint-ignore no-explicit-any
      const agentPatch: Record<string, any> = {};
      if (first_message !== undefined) agentPatch.first_message = first_message;
      if (language !== undefined) agentPatch.language = language;
      if (first_message_interruptible !== undefined) agentPatch.disable_first_message_interruptions = !first_message_interruptible;
      // Bug real confirmado 4-sep-2026: first_message con una variable
      // {{saludo}} sin default rompe CUALQUIER llamada real que no la mande
      // explícita (ej. el widget <elevenlabs-convai> embebido, que nunca
      // manda dynamic_variables propias) con "Missing required dynamic
      // variables in first message" — la llamada ni siquiera arranca. Fix:
      // declarar defaults tanto a nivel de agente como dentro de cada webhook
      // tool. ElevenLabs valida por separado las variables usadas en tools:
      // un placeholder solo en `agent.dynamic_variables` no evita
      // "Missing required dynamic variables in tools" en llamadas telefónicas
      // o widgets que no mandan conversation initiation data.
      if (dynamic_variable_placeholders !== undefined) {
        const getRes = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agent_id}`, {
          headers: { "xi-api-key": apiKey },
        });
        if (!getRes.ok) return json({ error: await getRes.text() }, getRes.status);
        const current = await getRes.json();
        const existentes = current?.conversation_config?.agent?.dynamic_variables?.dynamic_variable_placeholders ?? {};
        agentPatch.dynamic_variables = {
          dynamic_variable_placeholders: { ...existentes, ...dynamic_variable_placeholders },
        };
        // deno-lint-ignore no-explicit-any
        const toolsActuales: any[] = current?.conversation_config?.agent?.prompt?.tools ?? [];
        if (toolsActuales.length > 0) {
          agentPatch.prompt = {
            tools: toolsActuales.map((tool) => tool.type === "webhook" ? {
              ...tool,
              dynamic_variables: {
                ...(tool.dynamic_variables ?? {}),
                dynamic_variable_placeholders: {
                  ...(tool.dynamic_variables?.dynamic_variable_placeholders ?? {}),
                  ...dynamic_variable_placeholders,
                },
              },
            } : tool),
          };
        }
      }
      if (prompt !== undefined || temperature !== undefined || llm !== undefined || backup_llm !== undefined || reasoning_effort !== undefined) {
        agentPatch.prompt ??= {};
        if (prompt !== undefined) agentPatch.prompt.prompt = prompt;
        if (temperature !== undefined) agentPatch.prompt.temperature = temperature;
        if (llm !== undefined) agentPatch.prompt.llm = llm;
        if (backup_llm !== undefined) agentPatch.prompt.backup_llm_config = { preference: "override", order: [backup_llm] };
        // Modelos "thinking" (ej. gemini-3.5-flash-lite) exponen razonamiento
        // visible si reasoning_effort queda sin definir — se coló texto de
        // planeación interna dentro de la respuesta hablada real en una
        // llamada de prueba en vivo. "minimal" apaga ese razonamiento visible
        // sin tener que cambiar de modelo.
        if (reasoning_effort !== undefined) agentPatch.prompt.reasoning_effort = reasoning_effort;
      }

      // deno-lint-ignore no-explicit-any
      const ttsPatch: Record<string, any> = {};
      if (voice_id !== undefined) ttsPatch.voice_id = voice_id;
      if (speed !== undefined) ttsPatch.speed = speed;
      if (stability !== undefined) ttsPatch.stability = stability;
      if (similarity_boost !== undefined) ttsPatch.similarity_boost = similarity_boost;

      // deno-lint-ignore no-explicit-any
      const conversationPatch: Record<string, any> = {};
      if (background_sound_id !== undefined || background_sound_volume !== undefined || background_sound_crossfade !== undefined) {
        conversationPatch.background_sound = {
          source_type: background_sound_id ? "preset" : null,
          source_id: background_sound_id ?? null,
          volume: background_sound_volume ?? 0.15,
          crossfade_loop: background_sound_crossfade ?? true,
        };
      }

      // deno-lint-ignore no-explicit-any
      const conversation_config: Record<string, any> = {};
      if (Object.keys(agentPatch).length) conversation_config.agent = agentPatch;
      if (Object.keys(ttsPatch).length) conversation_config.tts = ttsPatch;
      if (Object.keys(conversationPatch).length) conversation_config.conversation = conversationPatch;

      // deno-lint-ignore no-explicit-any
      const patchBody: Record<string, any> = { conversation_config };
      if (name !== undefined) patchBody.name = name;

      const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agent_id}`, {
        method: "PATCH",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      if (!res.ok) return json({ error: await res.text() }, res.status);
      return json({ ok: true });
    }

    return json({ error: `Acción desconocida: ${action}` }, 400);
  } catch (err) {
    console.error("agent-config error:", err);
    if (err instanceof HttpInputError) {
      return json({ error: err.message }, err.status);
    }
    return json({ error: "Error interno" }, 500);
  }
});
