// Personalización REAL del agente de WhatsApp — el equivalente de texto de
// la configuración que ya tiene el agente de voz (prompt editable, modelo,
// temperatura), pero contra la tabla propia `whatsapp_agent_config` en vez
// de la API de ElevenLabs (WhatsApp no pasa por ElevenLabs, corre sobre
// OpenRouter — ver supabase/functions/_shared/whatsapp-agent-core.ts).
//
// Antes de esta sección, el agente de WhatsApp no tenía NINGÚN control desde
// el admin: su system prompt vivía hardcodeado en el código y el modelo
// salía fijo de una env var. Ahora runAgentTurn() lee esta misma fila en
// vivo en cada turno de conversación (con fallback al valor original si la
// fila no existe todavía), así que guardar aquí cambia de verdad cómo
// responde el bot real — no hay nada de ejemplo ni simulado.
//
// Mismo lenguaje visual que el editor del agente de voz dentro de
// AdminDashboard.tsx (DashboardAgente): tarjetas rounded-xl border-border,
// sliders con burbuja de valor flotante, textarea con expandir a diálogo, y
// una barra de guardar sticky que solo aparece cuando hay cambios sin
// guardar. Autocontenido — no depende de ningún estado de AdminDashboard.tsx
// más que restaurantId.
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  MessageCircle, Loader2, Maximize2, CheckCircle2, Sparkles, Cpu,
} from "lucide-react";

type WhatsAppAgentConfigRow = {
  id: string;
  restaurant_id: string;
  system_prompt: string;
  tone_style: string;
  llm_model: string;
  temperature: number;
  updated_at: string;
};

// Editable localmente antes de guardar — mismo shape que la fila, sin los
// campos que solo genera la base de datos.
type Borrador = Pick<WhatsAppAgentConfigRow, "system_prompt" | "tone_style" | "llm_model" | "temperature">;

// Deben coincidir 1:1 con el CHECK de la columna tone_style (migración
// 20260903130000_whatsapp_agent_config.sql) y con TONE_INSTRUCTIONS en
// whatsapp-agent-core.ts — cambiar una lista sin la otra rompe la
// sincronía entre lo que el admin elige y lo que de verdad se le inyecta
// al prompt.
const TONE_STYLE_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "calido_cercano", label: "Cálido y cercano", hint: "Como el encargado de confianza de la sucursal." },
  { value: "formal_directo", label: "Formal y directo", hint: "Cortés, sin diminutivos ni emojis, va al grano." },
  { value: "profesional_neutro", label: "Profesional y neutro", hint: "Correcto y claro, ni muy formal ni muy relajado." },
  { value: "divertido_desenfadado", label: "Divertido y desenfadado", hint: "Relajado, con humor ligero y algún emoji." },
];

// Los dos modelos reales de OpenRouter que ya corren en este proyecto (ver
// MODEL_DEFAULT / MODEL_ESCALADO en whatsapp-agent-core.ts) — el segundo es
// el mismo escalón que ya se usa como respaldo automático cuando falla una
// herramienta, así que elegirlo aquí como principal es una opción real, no
// un modelo inventado sin probar.
const LLM_MODEL_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite", hint: "Rápido y económico — el default actual del canal." },
  { value: "openai/gpt-5.4-mini", label: "GPT-5.4 mini", hint: "Más capaz; es el mismo modelo que ya usa el respaldo automático." },
];

const DEFAULT_BORRADOR: Borrador = {
  system_prompt: "",
  tone_style: "calido_cercano",
  llm_model: "google/gemini-2.5-flash-lite",
  temperature: 0.7,
};

interface Props {
  restaurantId: string | null;
}

const WhatsAppAgenteConfigSection = ({ restaurantId }: Props) => {
  const { toast } = useToast();
  const [fila, setFila] = useState<WhatsAppAgentConfigRow | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelado = false;
    setCargando(true);
    setError(null);
    supabase
      .from("whatsapp_agent_config")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelado) return;
        if (err) {
          console.error("No se pudo leer whatsapp_agent_config:", err);
          setError("No se pudo cargar la configuración real del agente.");
          setCargando(false);
          return;
        }
        if (data) {
          const row = data as WhatsAppAgentConfigRow;
          setFila(row);
          setBorrador({ system_prompt: row.system_prompt, tone_style: row.tone_style, llm_model: row.llm_model, temperature: row.temperature });
        } else {
          // Sin fila todavía para este restaurante — el agente sigue
          // corriendo con su fallback real (mismo prompt de siempre); al
          // guardar aquí se crea la fila por primera vez.
          setFila(null);
          setBorrador(DEFAULT_BORRADOR);
        }
        setCargando(false);
      });
    return () => { cancelado = true; };
  }, [restaurantId]);

  const hayCambios = !!borrador && (
    !fila
      ? true
      : fila.system_prompt !== borrador.system_prompt
        || fila.tone_style !== borrador.tone_style
        || fila.llm_model !== borrador.llm_model
        || fila.temperature !== borrador.temperature
  );

  const guardarCambios = async () => {
    if (!restaurantId || !borrador || !hayCambios) return;
    setGuardando(true);
    setGuardadoOk(false);
    setError(null);
    const { data, error: err } = await supabase
      .from("whatsapp_agent_config")
      .upsert({ restaurant_id: restaurantId, ...borrador }, { onConflict: "restaurant_id" })
      .select()
      .single();
    setGuardando(false);
    if (err || !data) {
      console.error("No se pudo guardar whatsapp_agent_config:", err);
      setError("No se pudo guardar — intenta de nuevo en un momento.");
      toast({ title: "No se pudo guardar", description: err?.message ?? "Intenta de nuevo.", variant: "destructive" });
      return;
    }
    const row = data as WhatsAppAgentConfigRow;
    setFila(row);
    setBorrador({ system_prompt: row.system_prompt, tone_style: row.tone_style, llm_model: row.llm_model, temperature: row.temperature });
    setGuardadoOk(true);
    setTimeout(() => setGuardadoOk(false), 3000);
  };

  if (!restaurantId || cargando) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-2" />
        <span className="text-[13px] text-muted-foreground">Leyendo la configuración real del agente de WhatsApp…</span>
      </div>
    );
  }

  if (!borrador) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-[13px] text-muted-foreground">{error ?? "No se pudo leer la configuración del agente."}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <MessageCircle className="w-4.5 h-4.5 text-primary" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-foreground">Configuración del agente</p>
          <p className="text-[12px] text-muted-foreground leading-snug">
            Prompt, tono y modelo reales — se leen en vivo en cada mensaje que responde el bot. Ningún dato de ejemplo.
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <p className="text-[13px] font-medium text-foreground mb-1.5 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-muted-foreground" /> Modelo (LLM)
            </p>
            <select
              value={borrador.llm_model}
              onChange={(e) => setBorrador({ ...borrador, llm_model: e.target.value })}
              className="w-full h-9 rounded-lg border border-border bg-card px-3 text-[13px] text-foreground"
            >
              {LLM_MODEL_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              {LLM_MODEL_OPTIONS.find((m) => m.value === borrador.llm_model)?.hint}
            </p>
          </div>

          <div>
            <p className="text-[13px] font-medium text-foreground mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-muted-foreground" /> Tono / estilo
            </p>
            <select
              value={borrador.tone_style}
              onChange={(e) => setBorrador({ ...borrador, tone_style: e.target.value })}
              className="w-full h-9 rounded-lg border border-border bg-card px-3 text-[13px] text-foreground"
            >
              {TONE_STYLE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              {TONE_STYLE_OPTIONS.find((t) => t.value === borrador.tone_style)?.hint}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3.5">
          <p className="text-[13px] font-medium text-foreground mb-1">Temperatura</p>
          <p className="text-[11.5px] text-muted-foreground mb-4 leading-snug">
            Controla la creatividad de las respuestas del LLM al redactar los mensajes (no afecta a los datos del menú, esos siempre salen de la base de datos real).
          </p>
          <div className="relative pt-7">
            <div
              className="absolute -top-0.5 -translate-x-1/2 bg-foreground text-background text-[13px] font-semibold font-mono tabular-nums rounded-lg px-2.5 py-1 pointer-events-none"
              style={{ left: `${borrador.temperature * 100}%` }}
            >
              {borrador.temperature.toFixed(2)}
            </div>
            <input
              type="range" min={0} max={1} step={0.05}
              value={borrador.temperature}
              onChange={(e) => setBorrador({ ...borrador, temperature: Number(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-0.5">
            <span>Más determinista</span><span>Más expresivo</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[13px] font-medium text-foreground">Mensaje del sistema</p>
            <Dialog>
              <DialogTrigger asChild>
                <button className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors">
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </DialogTrigger>
              <DialogContent className="flex flex-col p-5 gap-3" style={{ width: "75vw", height: "75vh", maxWidth: "75vw", maxHeight: "75vh" }}>
                <DialogHeader className="space-y-0">
                  <DialogTitle className="text-[14px] font-medium tracking-normal">Mensaje del sistema — agente de WhatsApp</DialogTitle>
                </DialogHeader>
                <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-primary/40 overflow-hidden">
                  <textarea
                    value={borrador.system_prompt}
                    onChange={(e) => setBorrador({ ...borrador, system_prompt: e.target.value })}
                    className="flex-1 p-4 text-[13px] text-foreground bg-transparent resize-none leading-relaxed"
                  />
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <textarea
            value={borrador.system_prompt}
            onChange={(e) => setBorrador({ ...borrador, system_prompt: e.target.value })}
            rows={10}
            className="w-full rounded-xl border border-primary/40 p-3 text-[13px] text-foreground bg-transparent resize-none leading-relaxed"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            El tono elegido arriba se agrega solo al final — no hace falta repetirlo aquí.
          </p>
        </div>

        {fila && (
          <p className="text-[11px] text-muted-foreground/70 font-mono">
            Última edición: {new Date(fila.updated_at).toLocaleString("es-MX")}
          </p>
        )}
      </div>

      <AnimatePresence>
        {(hayCambios || guardadoOk) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border bg-card shadow-lg px-3.5 py-2.5"
          >
            <span className="text-[12px] text-muted-foreground flex items-center gap-1.5">
              {guardadoOk && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
              {guardadoOk ? "Guardado — ya está aplicado en el agente real." : error ?? "Tienes cambios sin guardar."}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              {hayCambios && (
                <button
                  onClick={() => setBorrador(fila ? { system_prompt: fila.system_prompt, tone_style: fila.tone_style, llm_model: fila.llm_model, temperature: fila.temperature } : DEFAULT_BORRADOR)}
                  className="h-8 px-3 rounded-full border border-border text-[12px] text-foreground hover:bg-muted transition-colors"
                >
                  Descartar
                </button>
              )}
              <button
                onClick={guardarCambios}
                disabled={guardando || !hayCambios}
                className="h-8 px-3.5 rounded-full bg-primary text-primary-foreground text-[12px] font-medium hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-1.5"
              >
                {guardando && <Loader2 className="w-3 h-3 animate-spin" />}
                {guardando ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WhatsAppAgenteConfigSection;
