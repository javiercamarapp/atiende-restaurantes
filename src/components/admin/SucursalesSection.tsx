// Administración de sucursales: nombre/dirección/teléfono, horario, y los
// switches independientes de voice_agent_active / whatsapp_agent_active que
// controlan si cada canal de IA atiende esa sucursal. "Eliminar" es en
// realidad is_active=false (baja reversible) — nunca un delete físico, así
// que las sucursales dadas de baja se siguen listando (grises, con opción
// de reactivar) en vez de desaparecer sin rastro.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ModalFormularioElegante, CampoFormulario } from "@/components/ModalFormularioElegante";
import { Store, Copy, Check, Edit, Clock, Trash2, RotateCcw, Loader2, MapPin } from "lucide-react";

interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  hours: string | null;
  is_active: boolean;
  display_order: number | null;
  voice_agent_active: boolean;
  whatsapp_agent_active: boolean;
}

type CampoAgente = "voice_agent_active" | "whatsapp_agent_active";

interface Props {
  restaurantId: string | null;
}

const SucursalesSection = ({ restaurantId }: Props) => {
  const { toast } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardandoAgente, setGuardandoAgente] = useState<Set<string>>(new Set());
  const [idCopiado, setIdCopiado] = useState<string | null>(null);

  const [modalTienda, setModalTienda] = useState<Branch | null>(null);
  const [formTienda, setFormTienda] = useState({ name: "", address: "", phone: "" });
  const [guardandoTienda, setGuardandoTienda] = useState(false);

  const [modalHorario, setModalHorario] = useState<Branch | null>(null);
  const [formHorario, setFormHorario] = useState("");
  const [guardandoHorario, setGuardandoHorario] = useState(false);

  const [confirmarBaja, setConfirmarBaja] = useState<Branch | null>(null);
  const [procesandoBaja, setProcesandoBaja] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelado = false;
    setCargando(true);
    supabase
      .from("branches")
      .select("id, name, address, phone, hours, is_active, display_order, voice_agent_active, whatsapp_agent_active")
      .eq("restaurant_id", restaurantId)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error) {
          toast({ title: "No se pudieron cargar las sucursales", description: error.message, variant: "destructive" });
        } else {
          setBranches((data ?? []) as Branch[]);
        }
        setCargando(false);
      });
    return () => { cancelado = true; };
  }, [restaurantId, toast]);

  const copiarId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setIdCopiado(id);
      setTimeout(() => setIdCopiado((actual) => (actual === id ? null : actual)), 1500);
    } catch {
      toast({ title: "No se pudo copiar el ID", variant: "destructive" });
    }
  };

  const alternarAgente = async (branch: Branch, campo: CampoAgente, valor: boolean) => {
    const clave = `${branch.id}-${campo}`;
    setBranches((prev) => prev.map((b) => (b.id === branch.id ? { ...b, [campo]: valor } : b)));
    setGuardandoAgente((prev) => new Set(prev).add(clave));
    const { error } = await supabase.from("branches").update({ [campo]: valor }).eq("id", branch.id);
    setGuardandoAgente((prev) => {
      const siguiente = new Set(prev);
      siguiente.delete(clave);
      return siguiente;
    });
    if (error) {
      setBranches((prev) => prev.map((b) => (b.id === branch.id ? { ...b, [campo]: !valor } : b)));
      toast({ title: "No se pudo guardar", description: error.message, variant: "destructive" });
    }
  };

  const abrirEditarTienda = (b: Branch) => {
    setFormTienda({ name: b.name, address: b.address ?? "", phone: b.phone ?? "" });
    setModalTienda(b);
  };

  const guardarTienda = async () => {
    if (!modalTienda || !formTienda.name.trim()) return;
    setGuardandoTienda(true);
    const cambios = {
      name: formTienda.name.trim(),
      address: formTienda.address.trim() || null,
      phone: formTienda.phone.trim() || null,
    };
    const { error } = await supabase.from("branches").update(cambios).eq("id", modalTienda.id);
    setGuardandoTienda(false);
    if (error) {
      toast({ title: "No se pudo guardar la sucursal", description: error.message, variant: "destructive" });
      return;
    }
    setBranches((prev) => prev.map((b) => (b.id === modalTienda.id ? { ...b, ...cambios } : b)));
    toast({ title: "Sucursal actualizada" });
    setModalTienda(null);
  };

  const abrirEditarHorario = (b: Branch) => {
    setFormHorario(b.hours ?? "");
    setModalHorario(b);
  };

  const guardarHorario = async () => {
    if (!modalHorario) return;
    setGuardandoHorario(true);
    const hours = formHorario.trim() || null;
    const { error } = await supabase.from("branches").update({ hours }).eq("id", modalHorario.id);
    setGuardandoHorario(false);
    if (error) {
      toast({ title: "No se pudo guardar el horario", description: error.message, variant: "destructive" });
      return;
    }
    setBranches((prev) => prev.map((b) => (b.id === modalHorario.id ? { ...b, hours } : b)));
    toast({ title: "Horario actualizado" });
    setModalHorario(null);
  };

  const confirmarCambioActiva = async () => {
    if (!confirmarBaja) return;
    setProcesandoBaja(true);
    const nuevoValor = !confirmarBaja.is_active;
    const { error } = await supabase.from("branches").update({ is_active: nuevoValor }).eq("id", confirmarBaja.id);
    setProcesandoBaja(false);
    if (error) {
      toast({ title: "No se pudo actualizar la sucursal", description: error.message, variant: "destructive" });
      return;
    }
    setBranches((prev) => prev.map((b) => (b.id === confirmarBaja.id ? { ...b, is_active: nuevoValor } : b)));
    toast({ title: nuevoValor ? "Sucursal reactivada" : "Sucursal dada de baja" });
    setConfirmarBaja(null);
  };

  if (cargando) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="py-12 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[13px]">Cargando sucursales…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{branches.length} en total</p>

      {branches.length === 0 ? (
        <div className="py-12 text-center">
          <Store className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" strokeWidth={1.5} />
          <p className="text-[13px] text-muted-foreground">No hay sucursales registradas</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className={`p-3 flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-border last:border-0 transition-colors hover:bg-muted/40 ${branch.is_active ? "" : "opacity-60"}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Store className="w-5 h-5 text-primary" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-medium text-foreground truncate">{branch.name}</p>
                    {!branch.is_active && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700 shrink-0">Inactiva</span>
                    )}
                  </div>
                  <p className="text-[12px] text-muted-foreground truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" strokeWidth={1.75} />
                    {branch.address || "Sin dirección registrada"}
                  </p>
                  <button
                    onClick={() => copiarId(branch.id)}
                    title={branch.id}
                    className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {branch.id.slice(0, 8)}
                    {idCopiado === branch.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="flex flex-col items-center gap-1">
                  <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Voz</span>
                  <Switch
                    checked={branch.voice_agent_active}
                    disabled={!branch.is_active || guardandoAgente.has(`${branch.id}-voice_agent_active`)}
                    onCheckedChange={(v) => alternarAgente(branch, "voice_agent_active", v)}
                    aria-label={`Agente de voz activo — ${branch.name}`}
                  />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">WhatsApp</span>
                  <Switch
                    checked={branch.whatsapp_agent_active}
                    disabled={!branch.is_active || guardandoAgente.has(`${branch.id}-whatsapp_agent_active`)}
                    onCheckedChange={(v) => alternarAgente(branch, "whatsapp_agent_active", v)}
                    aria-label={`Agente de WhatsApp activo — ${branch.name}`}
                  />
                </div>

                <div className="flex items-center gap-1 border-l border-border pl-3">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => abrirEditarTienda(branch)} title="Editar tienda">
                    <Edit className="w-3.5 h-3.5 text-primary" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => abrirEditarHorario(branch)} title="Editar horario">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-red-50"
                    onClick={() => setConfirmarBaja(branch)}
                    title={branch.is_active ? "Eliminar sucursal" : "Reactivar sucursal"}
                  >
                    {branch.is_active ? <Trash2 className="w-3.5 h-3.5 stroke-red-500" /> : <RotateCcw className="w-3.5 h-3.5 text-primary" />}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editar tienda */}
      <ModalFormularioElegante
        open={!!modalTienda}
        onOpenChange={(v) => !v && setModalTienda(null)}
        titulo="Editar tienda"
        subtitulo={modalTienda?.name}
        onGuardar={guardarTienda}
        guardando={guardandoTienda}
        guardarDeshabilitado={!formTienda.name.trim()}
      >
        <CampoFormulario id="sucursal-nombre" label="Nombre">
          <Input id="sucursal-nombre" value={formTienda.name} onChange={(e) => setFormTienda({ ...formTienda, name: e.target.value })} />
        </CampoFormulario>
        <CampoFormulario id="sucursal-direccion" label="Dirección">
          <Input id="sucursal-direccion" value={formTienda.address} onChange={(e) => setFormTienda({ ...formTienda, address: e.target.value })} />
        </CampoFormulario>
        <CampoFormulario id="sucursal-telefono" label="Teléfono">
          <Input id="sucursal-telefono" value={formTienda.phone} onChange={(e) => setFormTienda({ ...formTienda, phone: e.target.value })} />
        </CampoFormulario>
      </ModalFormularioElegante>

      {/* Editar horario */}
      <ModalFormularioElegante
        open={!!modalHorario}
        onOpenChange={(v) => !v && setModalHorario(null)}
        titulo="Editar horario"
        subtitulo={modalHorario?.name}
        onGuardar={guardarHorario}
        guardando={guardandoHorario}
      >
        <CampoFormulario
          id="sucursal-horario"
          label="Horario"
          hint="Texto libre — así se lo explican al cliente el agente de voz y el de WhatsApp."
        >
          <Textarea id="sucursal-horario" rows={3} value={formHorario} onChange={(e) => setFormHorario(e.target.value)} placeholder="Ej. Todos los días, 12:00 pm – 1:00 am" />
        </CampoFormulario>
      </ModalFormularioElegante>

      {/* Confirmación de baja / reactivación */}
      <AlertDialog open={!!confirmarBaja} onOpenChange={(v) => !v && setConfirmarBaja(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmarBaja?.is_active ? "¿Eliminar esta sucursal?" : "¿Reactivar esta sucursal?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmarBaja?.is_active
                ? `"${confirmarBaja?.name}" se marcará como inactiva y sus agentes de voz y WhatsApp dejarán de atenderla. No se borra ningún dato — puedes reactivarla cuando quieras.`
                : `"${confirmarBaja?.name}" volverá a aparecer como sucursal activa.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={procesandoBaja}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarCambioActiva} disabled={procesandoBaja}>
              {procesandoBaja ? "Guardando…" : confirmarBaja?.is_active ? "Eliminar" : "Reactivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SucursalesSection;
