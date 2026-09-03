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
//   { action: "set_knowledge_base", agent_id, knowledge_base } -> reemplaza el
//                                                        arreglo knowledge_base del agente
//   { action: "set_languages", agent_id, languages, language_detection_enabled }
//                                              -> agrega/quita idiomas adicionales
//                                                 (conversation_config.language_presets)
//                                                 y activa/desactiva el built-in tool
//                                                 language_detection
//
// Nunca devuelve ni acepta nada de costos/créditos — eso es infraestructura
// interna, no algo que el dueño del restaurante deba ver.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// La cuenta real de ElevenLabs es de Javier — ya tenía voces clonadas
// personales suyas antes de este proyecto (Javier Cámara, Omar, Papá, etc.),
// sin relación con ningún restaurante. Para que "Mis voces" del panel de
// un restaurante nunca mezcle esas voces personales (ni, a futuro, las de
// otro restaurante que use la misma cuenta), cada voz clonada DESDE este
// panel se etiqueta con el restaurante que la creó — mis_voces solo
// devuelve las que traen esa etiqueta exacta, nunca todas las clonadas de
// la cuenta.
const RESTAURANT_ID = "be3fbdeb-80e7-4e7b-9b44-22b476c08298";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getApiKey(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data, error } = await supabase.rpc("get_secret", { secret_name: "ELEVENLABS_API_KEY" });
  if (error || !data) throw new Error("No se encontró la API key de ElevenLabs en Vault");
  return data as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const apiKey = await getApiKey(supabase);
    const body = await req.json();
    const { action } = body;

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
      const { agent_id } = body;
      if (!agent_id) return json({ error: "agent_id requerido" }, 400);
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
      const voces = (data.voices ?? []).filter((v: any) => v.category === "cloned" && v.labels?.restaurant_id === RESTAURANT_ID).map((v: any) => ({
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
      form.append("labels", JSON.stringify({ restaurant_id: RESTAURANT_ID }));
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
        llm, backup_llm,
      } = body;
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
      if (prompt !== undefined || temperature !== undefined || llm !== undefined || backup_llm !== undefined) {
        agentPatch.prompt = {};
        if (prompt !== undefined) agentPatch.prompt.prompt = prompt;
        if (temperature !== undefined) agentPatch.prompt.temperature = temperature;
        if (llm !== undefined) agentPatch.prompt.llm = llm;
        if (backup_llm !== undefined) agentPatch.prompt.backup_llm_config = { preference: "override", order: [backup_llm] };
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
    return json({ error: err instanceof Error ? err.message : "Error interno" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
