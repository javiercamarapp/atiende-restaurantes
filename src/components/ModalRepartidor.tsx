// Formulario "Agregar repartidor" sobre el shell ModalFormularioElegante.
// Hoy no existe ningún alta de repartidor desde el admin — la sección
// Repartidores de AdminDashboard.tsx solo lista profiles con
// role='repartidor' que llegaron por auto-registro público. Este modal crea
// el flujo real completo: usuario de Supabase Auth (vía la Edge Function
// crear-repartidor, que usa el service role) + rol 'repartidor' + perfil
// operativo (vehículo, licencia, contacto de emergencia) en la tabla nueva
// `repartidor_perfil`. Autocontenido: trae su propio estado de formulario,
// validación y submit — el padre solo pasa qué hacer al terminar de guardar.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ModalFormularioElegante, CampoFormulario } from "@/components/ModalFormularioElegante";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ModalRepartidorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se llama después de dar de alta con éxito — el padre refresca su lista. */
  onGuardado: () => void | Promise<void>;
}

type TipoVehiculo = "moto" | "bicicleta" | "auto";

const FORM_VACIO = {
  nombre_completo: "",
  telefono: "",
  correo: "",
  fecha_nacimiento: "",
  tipo_vehiculo: "" as TipoVehiculo | "",
  placas: "",
  numero_licencia: "",
  direccion: "",
  contacto_emergencia_nombre: "",
  contacto_emergencia_telefono: "",
};

type Errores = Partial<Record<keyof typeof FORM_VACIO, string>>;

function edadEnAnios(fechaNacimientoISO: string): number {
  const hoy = new Date();
  const nacimiento = new Date(`${fechaNacimientoISO}T00:00:00`);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const aunNoCumple =
    hoy.getMonth() < nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
  if (aunNoCumple) edad -= 1;
  return edad;
}

export function ModalRepartidor({ open, onOpenChange, onGuardado }: ModalRepartidorProps) {
  const { toast } = useToast();
  const [form, setForm] = useState(FORM_VACIO);
  const [errores, setErrores] = useState<Errores>({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(FORM_VACIO);
    setErrores({});
  }, [open]);

  const set = <K extends keyof typeof FORM_VACIO>(campo: K, valor: (typeof FORM_VACIO)[K]) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
  };

  const validar = (): Errores => {
    const e: Errores = {};
    if (!form.nombre_completo.trim()) e.nombre_completo = "El nombre completo es obligatorio.";
    if (form.telefono.replace(/\D/g, "").length < 10) e.telefono = "Escribe un teléfono válido de al menos 10 dígitos.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo)) e.correo = "Escribe un correo válido.";
    if (!form.fecha_nacimiento) {
      e.fecha_nacimiento = "La fecha de nacimiento es obligatoria.";
    } else if (edadEnAnios(form.fecha_nacimiento) < 18) {
      e.fecha_nacimiento = "El repartidor debe ser mayor de edad (18 años o más).";
    }
    if (!form.tipo_vehiculo) e.tipo_vehiculo = "Selecciona el tipo de vehículo.";
    if (form.tipo_vehiculo && form.tipo_vehiculo !== "bicicleta") {
      if (!form.placas.trim()) e.placas = "Las placas son obligatorias para moto/auto.";
      if (!form.numero_licencia.trim()) e.numero_licencia = "El número de licencia es obligatorio para moto/auto.";
    }
    if (!form.direccion.trim()) e.direccion = "La dirección es obligatoria.";
    if (!form.contacto_emergencia_nombre.trim()) e.contacto_emergencia_nombre = "Falta el nombre del contacto de emergencia.";
    if (form.contacto_emergencia_telefono.replace(/\D/g, "").length < 10) {
      e.contacto_emergencia_telefono = "Escribe un teléfono válido de al menos 10 dígitos.";
    }
    return e;
  };

  const handleGuardar = async () => {
    const e = validar();
    setErrores(e);
    if (Object.keys(e).length > 0) return;

    setGuardando(true);
    // try/finally: el modal se bloquea mientras `guardando` es true
    // (bloquearCierre={guardando} más abajo) — si supabase.functions.invoke
    // truena de verdad (red) en vez de resolver a { data, error }, sin esto
    // `guardando` se quedaba en true para siempre y el modal quedaba
    // atrapado, sin poder cerrarse ni reintentar.
    try {
      const { data, error } = await supabase.functions.invoke("crear-repartidor", {
        body: {
          nombre_completo: form.nombre_completo.trim(),
          telefono: form.telefono.trim(),
          correo: form.correo.trim(),
          fecha_nacimiento: form.fecha_nacimiento,
          tipo_vehiculo: form.tipo_vehiculo,
          placas: form.placas.trim() || null,
          numero_licencia: form.numero_licencia.trim() || null,
          direccion: form.direccion.trim(),
          contacto_emergencia_nombre: form.contacto_emergencia_nombre.trim(),
          contacto_emergencia_telefono: form.contacto_emergencia_telefono.trim(),
        },
      });

      if (error || data?.error) {
        toast({ title: "No se pudo agregar", description: data?.error || error?.message, variant: "destructive" });
        return;
      }

      toast({ title: "¡Repartidor agregado!", description: `${form.nombre_completo.trim()} ya puede iniciar sesión con Google o un enlace mágico a ${form.correo.trim()}.` });
      onOpenChange(false);
      await onGuardado();
    } catch (err) {
      toast({ title: "No se pudo agregar", description: err instanceof Error ? err.message : "Intenta de nuevo.", variant: "destructive" });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalFormularioElegante
      open={open}
      onOpenChange={onOpenChange}
      titulo="Agregar repartidor"
      subtitulo="Crea su cuenta real de acceso y su perfil operativo — podrá iniciar sesión de inmediato con Google o un enlace mágico a su correo."
      onGuardar={handleGuardar}
      guardando={guardando}
      textoBotonGuardar="Agregar repartidor"
      anchoClase="max-w-xl"
      bloquearCierre={guardando}
    >
      <div className="grid grid-cols-2 gap-4">
        <CampoFormulario id="rep-nombre" label="Nombre completo" error={errores.nombre_completo} className="col-span-2">
          <Input id="rep-nombre" value={form.nombre_completo} onChange={(ev) => set("nombre_completo", ev.target.value)} autoFocus />
        </CampoFormulario>

        <CampoFormulario id="rep-telefono" label="Teléfono" error={errores.telefono}>
          <Input id="rep-telefono" type="tel" placeholder="999 123 4567" value={form.telefono} onChange={(ev) => set("telefono", ev.target.value)} />
        </CampoFormulario>

        <CampoFormulario id="rep-fecha-nacimiento" label="Fecha de nacimiento" error={errores.fecha_nacimiento} hint="Debe ser mayor de edad.">
          <Input id="rep-fecha-nacimiento" type="date" value={form.fecha_nacimiento} onChange={(ev) => set("fecha_nacimiento", ev.target.value)} />
        </CampoFormulario>

        <CampoFormulario id="rep-correo" label="Correo" error={errores.correo} hint="Con esto inicia sesión — Google o enlace mágico, sin contraseña.">
          <Input id="rep-correo" type="email" value={form.correo} onChange={(ev) => set("correo", ev.target.value)} />
        </CampoFormulario>

        <CampoFormulario id="rep-vehiculo" label="Tipo de vehículo" error={errores.tipo_vehiculo}>
          <Select value={form.tipo_vehiculo} onValueChange={(v) => set("tipo_vehiculo", v as TipoVehiculo)}>
            <SelectTrigger id="rep-vehiculo"><SelectValue placeholder="Selecciona un vehículo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="moto">Motocicleta</SelectItem>
              <SelectItem value="bicicleta">Bicicleta</SelectItem>
              <SelectItem value="auto">Automóvil</SelectItem>
            </SelectContent>
          </Select>
        </CampoFormulario>

        {form.tipo_vehiculo !== "bicicleta" && (
          <>
            <CampoFormulario id="rep-placas" label="Placas del vehículo" error={errores.placas}>
              <Input id="rep-placas" value={form.placas} onChange={(ev) => set("placas", ev.target.value)} />
            </CampoFormulario>
            <CampoFormulario id="rep-licencia" label="Número de licencia" error={errores.numero_licencia}>
              <Input id="rep-licencia" value={form.numero_licencia} onChange={(ev) => set("numero_licencia", ev.target.value)} />
            </CampoFormulario>
          </>
        )}

        <CampoFormulario id="rep-direccion" label="Dirección" error={errores.direccion} className="col-span-2">
          <Textarea id="rep-direccion" rows={2} value={form.direccion} onChange={(ev) => set("direccion", ev.target.value)} />
        </CampoFormulario>

        <CampoFormulario id="rep-contacto-nombre" label="Contacto de emergencia — nombre" error={errores.contacto_emergencia_nombre}>
          <Input id="rep-contacto-nombre" value={form.contacto_emergencia_nombre} onChange={(ev) => set("contacto_emergencia_nombre", ev.target.value)} />
        </CampoFormulario>

        <CampoFormulario id="rep-contacto-telefono" label="Contacto de emergencia — teléfono" error={errores.contacto_emergencia_telefono}>
          <Input id="rep-contacto-telefono" type="tel" value={form.contacto_emergencia_telefono} onChange={(ev) => set("contacto_emergencia_telefono", ev.target.value)} />
        </CampoFormulario>
      </div>
    </ModalFormularioElegante>
  );
}

export type { ModalRepartidorProps };
