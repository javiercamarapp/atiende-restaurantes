// Formulario "Agregar cuenta" sobre el shell ModalFormularioElegante — da de
// alta un usuario real de staff/admin: crea el usuario de auth (vía la Edge
// Function crear-cuenta-staff, que usa la API admin de Supabase Auth con el
// service role — el navegador nunca puede hacer esto por sí solo), le asigna
// un rol real de `user_roles` (enum app_role) y, salvo que el rol sea
// superadmin (no es de un restaurante en particular), lo vincula al
// restaurante actual vía `restaurant_staff`. Autocontenido igual que
// ModalProducto/ModalCategoria: el padre solo pasa restaurantId y qué hacer
// al terminar.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ModalFormularioElegante, CampoFormulario } from "@/components/ModalFormularioElegante";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ModalCuentaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string | null;
  /** Se llama después de crear la cuenta con éxito — el padre refresca su lista. */
  onCuentaCreada: () => void | Promise<void>;
}

// Roles reales del enum `app_role` (user_roles.role) relevantes para dar de
// alta una cuenta de staff — se excluye "user", que es el rol por default de
// un cliente y no algo que se asigne aquí a propósito.
const ROLES: { value: "admin" | "repartidor" | "superadmin"; label: string; descripcion: string }[] = [
  { value: "admin", label: "Administrador", descripcion: "Panel completo de este restaurante." },
  { value: "repartidor", label: "Repartidor", descripcion: "Solo la app de entregas." },
  { value: "superadmin", label: "Superadministrador", descripcion: "Acceso a todos los restaurantes de atiende." },
];

// Códigos de país reales para el piloto (México) y los mercados vecinos más
// probables — no una lista genérica de 200 países que nadie va a usar aquí.
const CODIGOS_PAIS = [
  { value: "+52", label: "🇲🇽 +52 México" },
  { value: "+1", label: "🇺🇸 +1 EE. UU. / Canadá" },
  { value: "+502", label: "🇬🇹 +502 Guatemala" },
  { value: "+501", label: "🇧🇿 +501 Belice" },
  { value: "+34", label: "🇪🇸 +34 España" },
];

const FORM_VACIO = {
  nombre: "",
  apellidos: "",
  email: "",
  codigoPais: "+52",
  telefono: "",
  role: "admin" as "admin" | "repartidor" | "superadmin",
};

export function ModalCuenta({ open, onOpenChange, restaurantId, onCuentaCreada }: ModalCuentaProps) {
  const { toast } = useToast();
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    if (!open) return;
    setForm(FORM_VACIO);
    setErrores({});
  }, [open]);

  const validar = () => {
    const nuevosErrores: Record<string, string | undefined> = {};
    if (!form.nombre.trim()) nuevosErrores.nombre = "El nombre es obligatorio.";
    if (!form.apellidos.trim()) nuevosErrores.apellidos = "Los apellidos son obligatorios.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nuevosErrores.email = "Ingresa un correo válido.";
    if (!/^\d{7,15}$/.test(form.telefono.trim())) nuevosErrores.telefono = "Ingresa un teléfono válido, solo dígitos.";
    if (form.role !== "superadmin" && !restaurantId) {
      nuevosErrores.role = "No se pudo determinar el restaurante para esta cuenta.";
    }
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleGuardar = async () => {
    if (!validar()) return;

    setGuardando(true);
    // try/finally: si supabase.functions.invoke truena de verdad (red) en
    // vez de resolver a { data, error }, sin esto `guardando` se quedaba en
    // true para siempre — el botón "Guardando…" nunca se volvía a habilitar,
    // ni siquiera reabriendo el modal (el estado sigue montado).
    try {
      const { data, error } = await supabase.functions.invoke("crear-cuenta-staff", {
        body: {
          restaurant_id: restaurantId,
          nombre: form.nombre.trim(),
          apellidos: form.apellidos.trim(),
          email: form.email.trim(),
          telefono: `${form.codigoPais} ${form.telefono.trim()}`,
          role: form.role,
        },
      });

      if (error || data?.error) {
        toast({
          title: "No se pudo crear la cuenta",
          description: data?.error || error?.message || "Intenta de nuevo.",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "¡Cuenta creada!", description: `${form.nombre} ${form.apellidos} ya puede iniciar sesión con Google o un enlace mágico a ${form.email.trim()}.` });
      onOpenChange(false);
      await onCuentaCreada();
    } catch (err) {
      toast({
        title: "No se pudo crear la cuenta",
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalFormularioElegante
      open={open}
      onOpenChange={onOpenChange}
      titulo="Agregar cuenta"
      subtitulo="Da de alta a una persona de tu equipo para que entre al panel."
      onGuardar={handleGuardar}
      guardando={guardando}
      textoBotonGuardar="Crear cuenta"
      anchoClase="max-w-xl"
    >
      <div className="grid grid-cols-2 gap-4">
        <CampoFormulario id="cuenta-nombre" label="Nombre" error={errores.nombre}>
          <Input id="cuenta-nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} autoFocus />
        </CampoFormulario>
        <CampoFormulario id="cuenta-apellidos" label="Apellidos" error={errores.apellidos}>
          <Input id="cuenta-apellidos" value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} />
        </CampoFormulario>
      </div>

      <CampoFormulario id="cuenta-email" label="Correo electrónico" error={errores.email}>
        <Input id="cuenta-email" type="email" placeholder="persona@correo.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </CampoFormulario>

      <CampoFormulario id="cuenta-telefono" label="Teléfono" error={errores.telefono}>
        <div className="flex gap-2">
          <Select value={form.codigoPais} onValueChange={(v) => setForm({ ...form, codigoPais: v })}>
            <SelectTrigger className="w-[168px] shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CODIGOS_PAIS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            id="cuenta-telefono"
            inputMode="numeric"
            placeholder="9991234567"
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value.replace(/[^\d]/g, "") })}
          />
        </div>
      </CampoFormulario>

      <CampoFormulario label="Rol" error={errores.role} hint={ROLES.find((r) => r.value === form.role)?.descripcion}>
        <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as typeof form.role })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </CampoFormulario>
      <p className="text-[11.5px] text-muted-foreground -mt-2">
        No pide contraseña — inicia sesión con Google o un enlace mágico a este correo, igual que el resto del panel.
      </p>
    </ModalFormularioElegante>
  );
}

export type { ModalCuentaProps };
