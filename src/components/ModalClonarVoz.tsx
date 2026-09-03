// Modal de clonación de voz — mismo flujo real (Instant Voice Cloning de
// ElevenLabs) que el asistente de ElevenLabs, pero con branding propio de
// atiende: mark/tipografía de AtiendeLogo en vez del ícono de chispa, y la
// paleta azul/cielo del resto del panel en vez del blanco/negro plano de
// referencia. Pide al menos 3 grabaciones reales de 20s cada una (mejor
// clonación que el mínimo de 10s que pide ElevenLabs por defecto) — se
// puede cumplir grabando en el navegador o subiendo archivos de audio/video.
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AtiendeMark } from "@/components/AtiendeLogo";
import { supabase } from "@/integrations/supabase/client";
import {
  UploadCloud, Mic, Square, Play, Pause, Trash2, ArrowLeft,
  Users, ThumbsUp, Loader2, CheckCircle2, AlertCircle,
} from "lucide-react";

const DURACION_MINIMA_SEG = 20;
const CLIPS_MINIMOS = 3;
const DURACION_MAX_GRABACION_SEG = 30;

type Grabacion = {
  id: string;
  nombre: string;
  blob: Blob;
  url: string;
  duracionSeg: number;
};

type Paso = "subir" | "info" | "terminar";
type VistaSubir = "elegir" | "grabando";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVozClonada: (voiceId: string, nombre: string) => void;
}

export function ModalClonarVoz({ open, onOpenChange, onVozClonada }: Props) {
  const [paso, setPaso] = useState<Paso>("subir");
  const [vistaSubir, setVistaSubir] = useState<VistaSubir>("elegir");
  const [grabaciones, setGrabaciones] = useState<Grabacion[]>([]);
  const [quitarRuido, setQuitarRuido] = useState(true);
  const [nombreVoz, setNombreVoz] = useState("");
  const [clonando, setClonando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vozCreada, setVozCreada] = useState<{ voice_id: string; nombre: string } | null>(null);
  const [reproduciendoId, setReproduciendoId] = useState<string | null>(null);

  const [dispositivos, setDispositivos] = useState<MediaDeviceInfo[]>([]);
  const [dispositivoId, setDispositivoId] = useState<string>("");
  const [cuenta, setCuenta] = useState<number | null>(null); // 3, 2, 1 o null
  const [grabando, setGrabando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [barras, setBarras] = useState<number[]>(new Array(28).fill(4));
  const [arrastrando, setArrastrando] = useState(false);

  const segundosRef = useRef(0); // valor en vivo — `segundos` (state) queda
  // "congelado" en 0 dentro del closure de grabador.onstop (se define una
  // sola vez al iniciar la grabación), así que la duración real hay que
  // leerla de esta ref, actualizada en cada tick del timer, no del state.
  const streamRef = useRef<MediaStream | null>(null);
  const grabadorRef = useRef<MediaRecorder | null>(null);
  const trozosRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analiserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      reiniciarTodo();
      return;
    }
    navigator.mediaDevices?.enumerateDevices?.().then((lista) => {
      const mics = lista.filter((d) => d.kind === "audioinput");
      setDispositivos(mics);
      if (mics[0]) setDispositivoId(mics[0].deviceId);
    }).catch(() => {});
  }, [open]);

  const reiniciarTodo = () => {
    detenerTodoElAudio();
    grabaciones.forEach((g) => URL.revokeObjectURL(g.url));
    setPaso("subir");
    setVistaSubir("elegir");
    setGrabaciones([]);
    setNombreVoz("");
    setError(null);
    setVozCreada(null);
    setClonando(false);
    setCuenta(null);
    setGrabando(false);
    setSegundos(0);
  };

  const detenerTodoElAudio = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    grabadorRef.current?.state === "recording" && grabadorRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    streamRef.current = null;
    audioCtxRef.current = null;
  };

  const dibujarBarras = () => {
    const analiser = analiserRef.current;
    if (!analiser) return;
    const datos = new Uint8Array(analiser.frequencyBinCount);
    analiser.getByteFrequencyData(datos);
    const paso2 = Math.floor(datos.length / 28) || 1;
    const nuevas = Array.from({ length: 28 }, (_, i) => Math.max(4, (datos[i * paso2] ?? 0) / 255 * 36));
    setBarras(nuevas);
    rafRef.current = requestAnimationFrame(dibujarBarras);
  };

  const iniciarConCuenta = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: dispositivoId ? { deviceId: { exact: dispositivoId } } : true,
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      const fuente = ctx.createMediaStreamSource(stream);
      const analiser = ctx.createAnalyser();
      analiser.fftSize = 128;
      fuente.connect(analiser);
      audioCtxRef.current = ctx;
      analiserRef.current = analiser;
    } catch {
      setError("No se pudo acceder al micrófono. Revisa los permisos del navegador.");
      return;
    }

    setCuenta(3);
    let n = 3;
    const cuentaRegresiva = setInterval(() => {
      n -= 1;
      if (n === 0) {
        clearInterval(cuentaRegresiva);
        setCuenta(null);
        comenzarGrabacionReal();
      } else {
        setCuenta(n);
      }
    }, 800);
  };

  const comenzarGrabacionReal = () => {
    const stream = streamRef.current;
    if (!stream) return;
    trozosRef.current = [];
    const grabador = new MediaRecorder(stream);
    grabador.ondataavailable = (e) => { if (e.data.size > 0) trozosRef.current.push(e.data); };
    grabador.onstop = () => {
      const blob = new Blob(trozosRef.current, { type: "audio/webm" });
      setGrabaciones((prev) => [
        ...prev,
        { id: crypto.randomUUID(), nombre: `Grabación ${prev.length + 1}.webm`, blob, url: URL.createObjectURL(blob), duracionSeg: segundosRef.current },
      ]);
      setVistaSubir("elegir");
    };
    grabadorRef.current = grabador;
    grabador.start();
    setGrabando(true);
    segundosRef.current = 0;
    setSegundos(0);
    dibujarBarras();

    timerRef.current = setInterval(() => {
      setSegundos((s) => {
        const siguiente = s + 1 >= DURACION_MAX_GRABACION_SEG ? DURACION_MAX_GRABACION_SEG : s + 1;
        segundosRef.current = siguiente;
        if (siguiente >= DURACION_MAX_GRABACION_SEG) detenerGrabacion();
        return siguiente;
      });
    }, 1000);
  };

  const detenerGrabacion = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setGrabando(false);
    grabadorRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
  };

  const abrirGrabar = () => {
    setVistaSubir("grabando");
    setSegundos(0);
    setCuenta(null);
  };

  const cancelarGrabar = () => {
    detenerTodoElAudio();
    setGrabando(false);
    setCuenta(null);
    setVistaSubir("elegir");
  };

  const onArchivosSeleccionados = (archivos: FileList | null) => {
    if (!archivos) return;
    Array.from(archivos).forEach((file) => {
      if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) return;
      if (file.size > 10 * 1024 * 1024) {
        setError(`"${file.name}" pesa más de 10MB — no se agregó.`);
        return;
      }
      const url = URL.createObjectURL(file);
      const el = document.createElement("audio");
      el.src = url;
      el.onloadedmetadata = () => {
        setGrabaciones((prev) => [
          ...prev,
          { id: crypto.randomUUID(), nombre: file.name, blob: file, url, duracionSeg: Math.round(el.duration) },
        ]);
      };
    });
  };

  const eliminarGrabacion = (id: string) => {
    setGrabaciones((prev) => {
      const g = prev.find((x) => x.id === id);
      if (g) URL.revokeObjectURL(g.url);
      return prev.filter((x) => x.id !== id);
    });
  };

  const alternarReproduccion = (g: Grabacion) => {
    if (reproduciendoId === g.id) {
      audioPreviewRef.current?.pause();
      setReproduciendoId(null);
      return;
    }
    if (!audioPreviewRef.current) audioPreviewRef.current = new Audio();
    const audio = audioPreviewRef.current;
    audio.src = g.url;
    audio.play();
    audio.onended = () => setReproduciendoId(null);
    setReproduciendoId(g.id);
  };

  const clipsValidos = grabaciones.filter((g) => g.duracionSeg >= DURACION_MINIMA_SEG).length;
  const listoParaSeguir = clipsValidos >= CLIPS_MINIMOS;

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const clonarVoz = async () => {
    if (!nombreVoz.trim()) return;
    setClonando(true);
    setError(null);
    try {
      const samples = await Promise.all(
        grabaciones.map(async (g) => ({
          audio_base64: await blobToBase64(g.blob),
          mime_type: g.blob.type || "audio/webm",
        })),
      );
      const { data, error: fnError } = await supabase.functions.invoke("agent-config", {
        body: { action: "clone_voice", name: nombreVoz.trim(), samples, remove_background_noise: quitarRuido },
      });
      if (fnError || data?.error || !data?.voice_id) {
        throw new Error(data?.error || fnError?.message || "No se pudo clonar la voz");
      }
      setVozCreada({ voice_id: data.voice_id, nombre: nombreVoz.trim() });
      setPaso("terminar");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo clonar la voz — intenta de nuevo.");
    } finally {
      setClonando(false);
    }
  };

  const formatearTiempo = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const PASOS: { id: Paso; etiqueta: string }[] = [
    { id: "subir", etiqueta: "Subir audio" },
    { id: "info", etiqueta: "Información de la voz" },
    { id: "terminar", etiqueta: "Terminar" },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onOpenChange(false); }}>
      <DialogContent className="max-w-5xl p-0 gap-0 overflow-hidden" onInteractOutside={(e) => e.preventDefault()}>
        <div className="h-1 bg-gradient-to-r from-primary to-secondary" />

        <div className="grid grid-cols-[220px_1fr] min-h-[520px]">
          {/* Columna izquierda: branding + pasos */}
          <div className="border-r border-border p-6 flex flex-col gap-6 bg-muted/30">
            <AtiendeMark className="h-7 w-auto" />
            <div>
              <p className="font-display text-base font-semibold text-foreground mb-4">Clonación instantánea de voz</p>
              <div className="space-y-3">
                {PASOS.map((p) => {
                  const activo = p.id === paso;
                  const completado = PASOS.findIndex((x) => x.id === paso) > PASOS.findIndex((x) => x.id === p.id);
                  return (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activo ? "bg-primary" : completado ? "bg-primary/50" : "bg-border"}`} />
                      <span className={`text-[13px] ${activo ? "font-medium text-foreground" : "text-muted-foreground"}`}>{p.etiqueta}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Columna derecha: contenido del paso */}
          <div className="p-6 flex flex-col">
            {paso === "subir" && (
              <div className="flex-1 flex flex-col">
                <div className="grid grid-cols-3 gap-4 mb-5">
                  {[
                    { icono: Users, titulo: "Evita entornos con mucho ruido", texto: "Los sonidos de fondo interfieren con la calidad de la grabación." },
                    { icono: ThumbsUp, titulo: "Verificar calidad del micrófono", texto: "Prueba unidades externas o micrófonos de auriculares para una mejor captura de audio." },
                    { icono: Mic, titulo: "Usa equipo consistente", texto: "No cambies el equipo de grabación entre muestras." },
                  ].map(({ icono: Icono, titulo, texto }) => (
                    <div key={titulo}>
                      <Icono className="w-4 h-4 text-muted-foreground mb-1.5" strokeWidth={1.75} />
                      <p className="text-[13px] font-medium text-foreground mb-0.5">{titulo}</p>
                      <p className="text-[11.5px] text-muted-foreground leading-snug">{texto}</p>
                    </div>
                  ))}
                </div>

                {vistaSubir === "elegir" ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
                    onDragLeave={() => setArrastrando(false)}
                    onDrop={(e) => { e.preventDefault(); setArrastrando(false); onArchivosSeleccionados(e.dataTransfer.files); }}
                    className={`rounded-xl border border-dashed p-8 flex flex-col items-center justify-center text-center transition-colors ${arrastrando ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <input ref={fileInputRef} type="file" accept="audio/*,video/*" multiple hidden onChange={(e) => onArchivosSeleccionados(e.target.files)} />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-10 h-10 rounded-full border border-border flex items-center justify-center mb-3 hover:bg-muted transition-colors"
                    >
                      <UploadCloud className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
                    </button>
                    <p className="text-[13px] font-medium text-foreground">Haz clic para subir, o arrastra y suelta</p>
                    <p className="text-[11.5px] text-muted-foreground mt-0.5">Archivos de audio o video de hasta 10MB cada uno</p>
                    <p className="text-[11.5px] text-muted-foreground my-2">o</p>
                    <Button variant="outline" size="sm" className="rounded-full text-[12.5px] h-8" onClick={abrirGrabar}>
                      <Mic className="w-3.5 h-3.5" /> Grabar audio
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-6 flex flex-col items-center justify-center min-h-[220px] relative">
                    <button onClick={cancelarGrabar} className="absolute left-4 top-4 h-8 px-3 rounded-full border border-border text-[12.5px] text-foreground flex items-center gap-1.5 hover:bg-muted transition-colors">
                      <ArrowLeft className="w-3.5 h-3.5" /> Atrás
                    </button>

                    {cuenta !== null ? (
                      <div className="flex items-center gap-6 my-6">
                        {[3, 2, 1].map((n) => (
                          <span
                            key={n}
                            className="font-display font-bold transition-all duration-300"
                            style={{
                              fontSize: n === cuenta ? "56px" : "28px",
                              opacity: n === cuenta ? 1 : n > cuenta ? 0.15 : 0,
                              color: n === cuenta ? "#1D4ED8" : "hsl(var(--muted-foreground))",
                            }}
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    ) : !grabando ? (
                      <div className="flex items-center gap-3 my-8">
                        <select
                          value={dispositivoId}
                          onChange={(e) => setDispositivoId(e.target.value)}
                          className="h-9 px-3 rounded-full border border-border bg-background text-[12.5px] text-foreground max-w-[200px]"
                        >
                          {dispositivos.length === 0 && <option value="">Micrófono predeterminado</option>}
                          {dispositivos.map((d) => (
                            <option key={d.deviceId} value={d.deviceId}>{d.label || "Micrófono"}</option>
                          ))}
                        </select>
                        <Button onClick={iniciarConCuenta} className="rounded-full h-9 px-5 text-[12.5px]">Iniciar</Button>
                      </div>
                    ) : (
                      <button
                        onClick={detenerGrabacion}
                        className="w-16 h-16 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center my-6 hover:scale-105 transition-transform"
                        aria-label="Detener grabación"
                      >
                        <Square className="w-5 h-5 fill-current" />
                      </button>
                    )}

                    <div className="w-full flex items-center justify-between px-1">
                      <div className="flex items-end gap-[3px] h-9">
                        {barras.map((alto, i) => (
                          <span
                            key={i}
                            className="w-[3px] rounded-full bg-primary/70 transition-all duration-75"
                            style={{ height: grabando ? `${alto}px` : "4px" }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-mono tabular-nums text-[12.5px] px-2.5 py-1 rounded-full bg-muted text-foreground">{formatearTiempo(segundos)}</span>
                        <span className="text-muted-foreground text-[12.5px]">/</span>
                        <span className="font-mono tabular-nums text-[12.5px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground">00:{DURACION_MAX_GRABACION_SEG}</span>
                      </div>
                    </div>
                  </div>
                )}

                {grabaciones.length > 0 && (
                  <div className="mt-4 space-y-1.5">
                    {grabaciones.map((g) => (
                      <div key={g.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-[12.5px] font-medium text-foreground truncate">{g.nombre}</p>
                          <p className={`text-[11px] ${g.duracionSeg >= DURACION_MINIMA_SEG ? "text-muted-foreground" : "text-destructive"}`}>
                            {formatearTiempo(g.duracionSeg)}{g.duracionSeg < DURACION_MINIMA_SEG ? " — muy corta, se requieren 20s" : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => alternarReproduccion(g)} className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
                            {reproduciendoId === g.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => eliminarGrabacion(g.id)} className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <label className="flex items-center gap-2 mt-4 cursor-pointer">
                  <Checkbox checked={quitarRuido} onCheckedChange={(v) => setQuitarRuido(v === true)} />
                  <span className="text-[12.5px] text-foreground">Eliminar el ruido de fondo de las grabaciones de audio</span>
                </label>

                {error && (
                  <p className="text-[12px] text-destructive flex items-center gap-1.5 mt-3"><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}</p>
                )}

                <div className="flex items-center justify-between mt-auto pt-5">
                  <div className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${listoParaSeguir ? "border-primary bg-primary" : "border-border"}`}>
                      {listoParaSeguir && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                    </span>
                    <span className="text-[12.5px] text-muted-foreground">
                      {listoParaSeguir
                        ? "Listo para continuar"
                        : `Se requieren al menos ${CLIPS_MINIMOS} grabaciones de ${DURACION_MINIMA_SEG}s cada una (llevas ${clipsValidos} de ${CLIPS_MINIMOS})`}
                    </span>
                  </div>
                  <Button disabled={!listoParaSeguir} onClick={() => setPaso("info")} className="rounded-full px-6">Siguiente</Button>
                </div>
              </div>
            )}

            {paso === "info" && (
              <div className="flex-1 flex flex-col">
                <p className="font-display text-lg font-semibold text-foreground mb-1">Información de la voz</p>
                <p className="text-[13px] text-muted-foreground mb-5">Ponle un nombre a tu voz clonada — así la vas a encontrar después en la lista de voces.</p>

                <div className="flex items-center gap-3 mb-6">
                  <video
                    src="/media/orbe-agente.mp4"
                    autoPlay loop muted playsInline
                    className="w-16 h-16 rounded-full object-cover shrink-0"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full text-[12.5px] h-8"
                    disabled={!grabaciones[0]}
                    onClick={() => grabaciones[0] && alternarReproduccion(grabaciones[0])}
                  >
                    {reproduciendoId === grabaciones[0]?.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {reproduciendoId === grabaciones[0]?.id ? "Reproduciendo…" : "Previsualizar la voz"}
                  </Button>
                </div>

                <div className="space-y-2 max-w-sm">
                  <Label htmlFor="nombre-voz-clon" className="text-[12.5px]">Nombre de la voz</Label>
                  <Input id="nombre-voz-clon" placeholder="Ej. Mi voz — Los Taquitos de PM" value={nombreVoz} onChange={(e) => setNombreVoz(e.target.value)} autoFocus />
                </div>

                {error && (
                  <p className="text-[12px] text-destructive flex items-center gap-1.5 mt-4"><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}</p>
                )}

                <div className="flex items-center justify-between mt-auto pt-5">
                  <Button variant="outline" className="rounded-full" onClick={() => setPaso("subir")} disabled={clonando}>
                    <ArrowLeft className="w-3.5 h-3.5" /> Atrás
                  </Button>
                  <Button disabled={!nombreVoz.trim() || clonando} onClick={clonarVoz} className="rounded-full px-6">
                    {clonando ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Clonando…</> : "Crear voz"}
                  </Button>
                </div>
              </div>
            )}

            {paso === "terminar" && vozCreada && (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <AtiendeMark className="h-6 w-auto" />
                </div>
                <p className="font-display text-lg font-semibold text-foreground mb-1">¡Tu voz quedó lista!</p>
                <p className="text-[13px] text-muted-foreground mb-6 max-w-xs">
                  "{vozCreada.nombre}" ya está en tu biblioteca de voces — puedes asignarla al agente ahora mismo.
                </p>
                <Button
                  className="rounded-full px-6"
                  onClick={() => { onVozClonada(vozCreada.voice_id, vozCreada.nombre); onOpenChange(false); }}
                >
                  Usar esta voz
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
