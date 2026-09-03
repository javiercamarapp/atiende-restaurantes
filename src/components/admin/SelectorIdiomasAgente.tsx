// Selector de idiomas del agente de voz — estilo ElevenLabs: agrega/quita
// varios idiomas adicionales (con bandera real por código) y activa/desactiva
// la detección automática de idioma en vivo durante la llamada.
//
// Componente autocontenido: no depende del `borrador`/`guardarCambios` de
// AdminDashboard (esos campos — conversation_config.language_presets y
// agent.prompt.built_in_tools.language_detection — no forman parte de
// ConfigAgente ni de la acción "update" existente). Lee y guarda su propio
// estado contra la función de borde agent-config, acción nueva
// "set_languages" — mismo patrón visual del resto del panel (tarjeta
// rounded-xl, lista desplegable como OPCIONES_SONIDO_FONDO, barra de
// guardado como la de guardarCambios en AdminDashboard).
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Languages, ChevronDown, X, Search, Loader2, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";

// Idiomas reales soportados por el modelo multilingüe de ElevenLabs
// (eleven_multilingual_v2 / turbo v2.5) — confirmado contra la documentación
// oficial: ~32 idiomas. Bandera = representación visual más reconocible del
// idioma, no necesariamente un único país "dueño" del idioma.
const IDIOMAS_ELEVENLABS: { codigo: string; etiqueta: string; emoji: string }[] = [
  { codigo: "es", etiqueta: "Español", emoji: "🇲🇽" },
  { codigo: "en", etiqueta: "Inglés", emoji: "🇺🇸" },
  { codigo: "pt", etiqueta: "Portugués", emoji: "🇧🇷" },
  { codigo: "fr", etiqueta: "Francés", emoji: "🇫🇷" },
  { codigo: "de", etiqueta: "Alemán", emoji: "🇩🇪" },
  { codigo: "it", etiqueta: "Italiano", emoji: "🇮🇹" },
  { codigo: "zh", etiqueta: "Chino", emoji: "🇨🇳" },
  { codigo: "ja", etiqueta: "Japonés", emoji: "🇯🇵" },
  { codigo: "ko", etiqueta: "Coreano", emoji: "🇰🇷" },
  { codigo: "hi", etiqueta: "Hindi", emoji: "🇮🇳" },
  { codigo: "ar", etiqueta: "Árabe", emoji: "🇸🇦" },
  { codigo: "id", etiqueta: "Indonesio", emoji: "🇮🇩" },
  { codigo: "nl", etiqueta: "Neerlandés", emoji: "🇳🇱" },
  { codigo: "tr", etiqueta: "Turco", emoji: "🇹🇷" },
  { codigo: "pl", etiqueta: "Polaco", emoji: "🇵🇱" },
  { codigo: "sv", etiqueta: "Sueco", emoji: "🇸🇪" },
  { codigo: "bg", etiqueta: "Búlgaro", emoji: "🇧🇬" },
  { codigo: "ro", etiqueta: "Rumano", emoji: "🇷🇴" },
  { codigo: "cs", etiqueta: "Checo", emoji: "🇨🇿" },
  { codigo: "el", etiqueta: "Griego", emoji: "🇬🇷" },
  { codigo: "fi", etiqueta: "Finlandés", emoji: "🇫🇮" },
  { codigo: "hr", etiqueta: "Croata", emoji: "🇭🇷" },
  { codigo: "ms", etiqueta: "Malayo", emoji: "🇲🇾" },
  { codigo: "sk", etiqueta: "Eslovaco", emoji: "🇸🇰" },
  { codigo: "da", etiqueta: "Danés", emoji: "🇩🇰" },
  { codigo: "ta", etiqueta: "Tamil", emoji: "🇮🇳" },
  { codigo: "uk", etiqueta: "Ucraniano", emoji: "🇺🇦" },
  { codigo: "ru", etiqueta: "Ruso", emoji: "🇷🇺" },
  { codigo: "hu", etiqueta: "Húngaro", emoji: "🇭🇺" },
  { codigo: "no", etiqueta: "Noruego", emoji: "🇳🇴" },
  { codigo: "vi", etiqueta: "Vietnamita", emoji: "🇻🇳" },
  { codigo: "fil", etiqueta: "Filipino", emoji: "🇵🇭" },
];

const idiomaPorCodigo = (codigo: string) =>
  IDIOMAS_ELEVENLABS.find((i) => i.codigo === codigo) ?? { codigo, etiqueta: codigo, emoji: "🏳️" };

interface Props {
  /** agent_id real de ElevenLabs — si es null/undefined, el selector no carga nada. */
  agentId?: string | null;
}

export function SelectorIdiomasAgente({ agentId }: Props) {
  const [idiomaPrincipal, setIdiomaPrincipal] = useState("es");
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [deteccionActiva, setDeteccionActiva] = useState(false);
  const [original, setOriginal] = useState<{ seleccionados: string[]; deteccion: boolean } | null>(null);

  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [listaAbierta, setListaAbierta] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    if (!agentId) return;
    setCargando(true);
    setError(null);
    supabase.functions
      .invoke("agent-config", { body: { action: "get", agent_id: agentId } })
      .then(({ data, error: fnError }) => {
        if (fnError || data?.error) throw fnError ?? new Error(data.error);
        const adicionales: string[] = data.additional_languages ?? [];
        setIdiomaPrincipal(data.language ?? "es");
        setSeleccionados(adicionales);
        setDeteccionActiva(!!data.language_detection_enabled);
        setOriginal({ seleccionados: adicionales, deteccion: !!data.language_detection_enabled });
      })
      .catch((err) => {
        console.error("No se pudo cargar los idiomas del agente:", err);
        setError("No se pudo leer los idiomas configurados en ElevenLabs.");
      })
      .finally(() => setCargando(false));
  }, [agentId]);

  const hayCambios =
    original !== null &&
    (original.deteccion !== deteccionActiva ||
      JSON.stringify([...original.seleccionados].sort()) !== JSON.stringify([...seleccionados].sort()));

  const disponibles = useMemo(
    () =>
      IDIOMAS_ELEVENLABS.filter(
        (i) =>
          i.codigo !== idiomaPrincipal &&
          !seleccionados.includes(i.codigo) &&
          (i.etiqueta.toLowerCase().includes(busqueda.toLowerCase()) || i.codigo.includes(busqueda.toLowerCase())),
      ),
    [idiomaPrincipal, seleccionados, busqueda],
  );

  const agregarIdioma = (codigo: string) => {
    setSeleccionados((prev) => [...prev, codigo]);
    setListaAbierta(false);
    setBusqueda("");
  };
  const quitarIdioma = (codigo: string) => setSeleccionados((prev) => prev.filter((c) => c !== codigo));

  const cancelar = () => {
    if (!original) return;
    setSeleccionados(original.seleccionados);
    setDeteccionActiva(original.deteccion);
  };

  const guardar = async () => {
    if (!agentId || !hayCambios) return;
    setGuardando(true);
    setGuardadoOk(false);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("agent-config", {
        body: { action: "set_languages", agent_id: agentId, languages: seleccionados, language_detection_enabled: deteccionActiva },
      });
      if (fnError || data?.error) throw fnError ?? new Error(data.error);
      setOriginal({ seleccionados, deteccion: deteccionActiva });
      setGuardadoOk(true);
      setTimeout(() => setGuardadoOk(false), 3000);
    } catch (err) {
      console.error("No se pudo guardar los idiomas del agente:", err);
      setError("No se pudo guardar — intenta de nuevo en un momento.");
    } finally {
      setGuardando(false);
    }
  };

  if (!agentId) return null;

  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-[13px] font-medium text-foreground mb-1.5 flex items-center gap-1.5">
          <Languages className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.75} />
          Idiomas adicionales
        </p>
        <p className="text-[11.5px] text-muted-foreground leading-snug">
          El agente siempre empieza en {idiomaPorCodigo(idiomaPrincipal).emoji} {idiomaPorCodigo(idiomaPrincipal).etiqueta.toLowerCase()} — agrega
          otros idiomas para que también pueda atender llamadas en ellos.
        </p>
      </div>

      {cargando ? (
        <div className="flex items-center gap-2 py-4 text-[12.5px] text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Leyendo idiomas configurados…
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-3.5 space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-foreground">Detección automática de idioma</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Si el cliente habla en otro idioma soportado, el agente lo detecta y cambia solo, en plena llamada.
              </p>
            </div>
            <Switch checked={deteccionActiva} onCheckedChange={setDeteccionActiva} className="shrink-0" />
          </div>

          <div className="border-t border-border pt-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/30 bg-primary/10 text-[12px] text-primary font-medium"
                title="Idioma principal — se cambia en la pestaña de Idioma"
              >
                <span>{idiomaPorCodigo(idiomaPrincipal).emoji}</span>
                {idiomaPorCodigo(idiomaPrincipal).etiqueta}
              </span>

              {seleccionados.map((codigo) => {
                const idioma = idiomaPorCodigo(codigo);
                return (
                  <span
                    key={codigo}
                    className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full border border-border bg-muted/50 text-[12px] text-foreground"
                  >
                    <span>{idioma.emoji}</span>
                    {idioma.etiqueta}
                    <button
                      onClick={() => quitarIdioma(codigo)}
                      className="w-4 h-4 rounded-full flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      aria-label={`Quitar ${idioma.etiqueta}`}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                );
              })}

              <div className="relative">
                <button
                  onClick={() => setListaAbierta((v) => !v)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-border text-[12px] text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Agregar idioma
                  <ChevronDown className={`w-3 h-3 transition-transform ${listaAbierta ? "rotate-180" : ""}`} />
                </button>

                {listaAbierta && (
                  <div className="absolute left-0 top-8 z-20 w-56 rounded-lg border border-border bg-card shadow-lg p-1.5">
                    <div className="flex items-center gap-1.5 px-2 py-1 mb-1 rounded-md border border-border bg-muted/40">
                      <Search className="w-3 h-3 text-muted-foreground shrink-0" />
                      <input
                        autoFocus
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar idioma…"
                        className="w-full bg-transparent text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground"
                      />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {disponibles.length === 0 ? (
                        <p className="text-[11.5px] text-muted-foreground px-2 py-2 text-center">Sin resultados</p>
                      ) : (
                        disponibles.map((idioma) => (
                          <button
                            key={idioma.codigo}
                            type="button"
                            onClick={() => agregarIdioma(idioma.codigo)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12.5px] text-left text-foreground hover:bg-muted transition-colors"
                          >
                            <span>{idioma.emoji}</span>
                            <span className="truncate">{idioma.etiqueta}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {(hayCambios || guardadoOk || error) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card shadow-lg px-3.5 py-2.5"
          >
            <span className="text-[12px] text-muted-foreground flex items-center gap-1.5">
              {error ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" /> {error}
                </>
              ) : guardadoOk ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" /> Guardado — ya está aplicado en el agente real.
                </>
              ) : (
                "Tienes cambios de idiomas sin guardar."
              )}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              {hayCambios && (
                <button
                  onClick={cancelar}
                  className="h-8 px-3 rounded-full border border-border text-[12px] text-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
              )}
              {hayCambios && (
                <button
                  onClick={guardar}
                  disabled={guardando}
                  className="h-8 px-3.5 rounded-full bg-primary text-primary-foreground text-[12px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {guardando ? "Guardando…" : "Guardar idiomas"}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
