// Widget de chat estilo WhatsApp para la página pública/demo — mismo espíritu
// que el widget de voz real de ElevenLabs (botón flotante siempre montado,
// sin que el visitante tenga que buscarlo), pero para el canal de WhatsApp.
//
// No hay respuestas guionizadas: cada mensaje viaja de verdad a la Edge
// Function whatsapp-widget-chat, que corre EXACTAMENTE el mismo cerebro
// (prompt/tools/loop de tool-use) que el número real de WhatsApp de Twilio —
// ver supabase/functions/_shared/whatsapp-agent-core.ts. Si la conversación
// llega al punto de cerrar un pedido, el agente llama a la misma herramienta
// crear_pedido que usa el canal real, y el pedido queda insertado de verdad
// en `orders` (source: "whatsapp").
//
// El session_id es aleatorio (crypto.randomUUID()) y se genera una sola vez,
// la primera vez que se abre el panel — cada apertura del widget en esta
// pestaña sigue siendo la misma conversación (misma fila en
// whatsapp_conversations, phone = "widget-" + session_id) hasta que se
// recargue la página.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Mensaje {
  id: string;
  rol: "cliente" | "agente" | "sistema";
  texto: string;
  hora: Date;
}

interface WidgetWhatsAppProps {
  /** Nombre del restaurante mostrado en el encabezado — cae en "Los Taquitos de PM" si no se pasa. */
  restaurantName?: string;
}

// Reconstrucción del glifo real de WhatsApp (burbuja verde, teléfono blanco
// recortado adentro) — no es el asset oficial, es un ícono inline propio
// fiel al mismo diseño, igual que AtiendeMark en AtiendeLogo.tsx.
function WhatsAppGlyph({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="6" fill="#25D366" />
      <path
        d="M12.04 4.4C7.83 4.4 4.4 7.83 4.4 12.04c0 1.42.38 2.79 1.09 4l-1.16 4.24 4.34-1.14a7.6 7.6 0 0 0 3.37.79h.01c4.21 0 7.64-3.43 7.64-7.64s-3.43-7.89-7.65-7.89Zm0 13.95h-.01a6.31 6.31 0 0 1-3.22-.88l-.23-.14-2.4.63.64-2.34-.15-.24a6.3 6.3 0 0 1-.97-3.34c0-3.48 2.83-6.31 6.32-6.31 1.69 0 3.27.66 4.47 1.85a6.28 6.28 0 0 1 1.85 4.47c0 3.48-2.83 6.3-6.3 6.3Z"
        fill="white"
      />
      <path
        d="M9.99 8.2c-.16-.36-.33-.37-.48-.37l-.42-.01c-.14 0-.38.05-.58.27-.2.22-.75.73-.75 1.78s.77 2.06.88 2.2c.1.15 1.49 2.39 3.68 3.25 1.82.71 2.19.57 2.58.53.4-.04 1.28-.52 1.46-1.02.18-.5.18-.94.12-1.03-.06-.09-.2-.14-.42-.25-.22-.11-1.28-.63-1.48-.7-.2-.08-.34-.11-.49.1-.14.22-.56.7-.69.85-.13.14-.26.16-.48.05-.22-.1-.91-.34-1.74-1.07-.64-.57-1.08-1.28-1.2-1.5-.13-.22-.01-.34.1-.45.1-.1.22-.26.33-.38.1-.13.14-.22.21-.36.08-.15.04-.28-.02-.38-.05-.1-.48-1.2-.68-1.64Z"
        fill="#25D366"
      />
    </svg>
  );
}

function TicksGlyph() {
  return (
    <svg viewBox="0 0 16 11" className="w-[13px] h-[9px] inline-block" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 5.5 4.2 8.7 9.4 2" stroke="#53BDEB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 5.5 8.7 8.7 15 1.4" stroke="#53BDEB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatearHora(d: Date) {
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function WidgetWhatsApp({ restaurantName = "Los Taquitos de PM" }: WidgetWhatsAppProps) {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [borrador, setBorrador] = useState("");
  const [escribiendo, setEscribiendo] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes, escribiendo]);

  const abrirWidget = () => {
    if (!sessionIdRef.current) sessionIdRef.current = crypto.randomUUID();
    setAbierto(true);
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  const enviarMensaje = async () => {
    const texto = borrador.trim();
    if (!texto || escribiendo) return;
    if (!sessionIdRef.current) sessionIdRef.current = crypto.randomUUID();

    const mensajeCliente: Mensaje = { id: crypto.randomUUID(), rol: "cliente", texto, hora: new Date() };
    setMensajes((prev) => [...prev, mensajeCliente]);
    setBorrador("");
    setEscribiendo(true);

    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-widget-chat", {
        body: { session_id: sessionIdRef.current, message: texto },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Error desconocido");

      const mensajeAgente: Mensaje = { id: crypto.randomUUID(), rol: "agente", texto: data.reply as string, hora: new Date() };
      setMensajes((prev) => [...prev, mensajeAgente]);

      if (data.order_id) {
        setMensajes((prev) => [
          ...prev,
          { id: crypto.randomUUID(), rol: "sistema", texto: `Pedido confirmado · #${String(data.order_id).slice(0, 8).toUpperCase()}`, hora: new Date() },
        ]);
      }
    } catch (err) {
      setMensajes((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          rol: "agente",
          texto: "Ahorita no pude procesar tu mensaje — intenta de nuevo en un momento.",
          hora: new Date(),
        },
      ]);
      console.error("WidgetWhatsApp:", err);
    } finally {
      setEscribiendo(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {!abierto && (
          <motion.button
            key="boton-flotante"
            initial={{ opacity: 0, scale: 0.85, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 10 }}
            onClick={abrirWidget}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 h-14 pl-3 pr-5 rounded-full bg-[#25D366] text-white shadow-[0_8px_24px_-6px_rgba(37,211,102,0.6)] hover:brightness-105 active:scale-[0.97] transition-[filter,transform]"
          >
            <WhatsAppGlyph className="w-8 h-8 shrink-0" />
            <span className="text-[14px] font-semibold">Iniciar chat</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {abierto && (
          <motion.div
            key="panel-whatsapp"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-6 right-6 z-50 w-[368px] max-w-[92vw] h-[600px] max-h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-black/10"
          >
            {/* Encabezado estilo WhatsApp — verde oscuro, avatar + nombre + estado */}
            <div className="shrink-0 bg-[#075E54] text-white px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0 overflow-hidden">
                <WhatsAppGlyph className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold truncate leading-tight">{restaurantName}</p>
                <p className="text-[11.5px] text-white/70 leading-tight">
                  {escribiendo ? "escribiendo…" : "En línea"}
                </p>
              </div>
              <button
                onClick={() => setAbierto(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:bg-white/10 hover:text-white transition-colors shrink-0"
                aria-label="Cerrar chat"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Cuerpo del chat — fondo característico de WhatsApp */}
            <div
              className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-1.5"
              style={{ background: "#E5DDD5" }}
            >
              {mensajes.length === 0 && (
                <div className="h-full flex items-center justify-center px-6">
                  <p className="text-[12.5px] text-center text-black/45 leading-relaxed">
                    Escríbele al agente de WhatsApp de {restaurantName} — puede tomar tu pedido real de principio a fin, igual que si mandaras un WhatsApp de verdad.
                  </p>
                </div>
              )}

              {mensajes.map((m) =>
                m.rol === "sistema" ? (
                  <div key={m.id} className="flex justify-center py-1">
                    <span className="text-[11px] px-2.5 py-1 rounded-md bg-[#075E54]/10 text-[#075E54] font-medium">
                      {m.texto}
                    </span>
                  </div>
                ) : (
                  <div key={m.id} className={`flex ${m.rol === "cliente" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] px-2.5 py-[7px] shadow-sm text-[13.5px] leading-snug whitespace-pre-wrap break-words ${
                        m.rol === "cliente"
                          ? "bg-[#D9FDD3] text-[#111b21] rounded-tl-lg rounded-bl-lg rounded-br-lg rounded-tr-sm"
                          : "bg-white text-[#111b21] rounded-tr-lg rounded-br-lg rounded-bl-lg rounded-tl-sm"
                      }`}
                    >
                      <span>{m.texto}</span>
                      <span className="float-right ml-2 mt-1 flex items-center gap-1 text-[10.5px] text-black/40 select-none">
                        {formatearHora(m.hora)}
                        {m.rol === "cliente" && <TicksGlyph />}
                      </span>
                    </div>
                  </div>
                ),
              )}

              {escribiendo && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-tr-lg rounded-br-lg rounded-bl-lg rounded-tl-sm px-3 py-2.5 shadow-sm flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-black/35"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={finRef} />
            </div>

            {/* Barra de entrada */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enviarMensaje();
              }}
              className="shrink-0 bg-[#F0F0F0] px-2.5 py-2 flex items-center gap-2 border-t border-black/5"
            >
              <input
                ref={inputRef}
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                placeholder="Escribe un mensaje"
                disabled={escribiendo}
                className="flex-1 h-9 rounded-full bg-white px-4 text-[13.5px] text-[#111b21] placeholder:text-black/40 outline-none disabled:opacity-70"
              />
              <button
                type="submit"
                disabled={!borrador.trim() || escribiendo}
                className="w-9 h-9 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 disabled:opacity-40 hover:brightness-105 active:scale-95 transition-[filter,transform]"
                aria-label="Enviar mensaje"
              >
                <Send className="w-4 h-4 ml-[-1px]" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default WidgetWhatsApp;
