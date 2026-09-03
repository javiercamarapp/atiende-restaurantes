// Formulario "Agregar categoría" reconstruido sobre el shell
// ModalFormularioElegante — mismo campo (nombre, con slug derivado
// automáticamente), validación y lógica de guardado (insert en
// `categories`, con la validación de restaurant_id) que la versión
// inline anterior en AdminDashboard.tsx, solo con la presentación
// nueva. Autocontenido: trae su propio estado de formulario y submit —
// el padre solo pasa restaurantId y qué hacer al terminar de guardar.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ModalFormularioElegante, CampoFormulario } from "@/components/ModalFormularioElegante";
import { Input } from "@/components/ui/input";

interface ModalCategoriaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string | null;
  /** Se llama después de guardar con éxito — el padre refresca su lista. */
  onGuardado: () => void | Promise<void>;
}

export function ModalCategoria({ open, onOpenChange, restaurantId, onGuardado }: ModalCategoriaProps) {
  const { toast } = useToast();
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorNombre, setErrorNombre] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setNombre("");
    setErrorNombre(undefined);
  }, [open]);

  const handleGuardar = async () => {
    const nombreValido = nombre.trim().length > 0;
    setErrorNombre(nombreValido ? undefined : "El nombre es obligatorio.");
    if (!nombreValido) return;

    if (!restaurantId) {
      toast({ title: "Error", description: "No se pudo determinar el restaurante para esta categoría", variant: "destructive" });
      return;
    }

    setGuardando(true);
    const { error } = await supabase.from("categories").insert({
      name: nombre,
      slug: nombre.toLowerCase().replace(/\s+/g, "-"),
      restaurant_id: restaurantId,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setGuardando(false);
      return;
    }
    toast({ title: "¡Agregada!", description: "Categoría agregada correctamente" });

    setGuardando(false);
    onOpenChange(false);
    await onGuardado();
  };

  return (
    <ModalFormularioElegante
      open={open}
      onOpenChange={onOpenChange}
      titulo="Agregar categoría"
      subtitulo="Así se agrupan los productos en el menú de voz y WhatsApp."
      onGuardar={handleGuardar}
      guardando={guardando}
      textoBotonGuardar="Agregar categoría"
    >
      <CampoFormulario id="categoria-nombre" label="Nombre" error={errorNombre}>
        <Input id="categoria-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
      </CampoFormulario>
    </ModalFormularioElegante>
  );
}

export type { ModalCategoriaProps };
