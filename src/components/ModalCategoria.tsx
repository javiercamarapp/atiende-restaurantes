// Formulario "Agregar/Editar categoría" sobre el shell ModalFormularioElegante
// — mismo lenguaje visual (ancho, chrome, tipografía) que ModalProducto y
// ModalClonarVoz. Además del nombre (con slug derivado automáticamente) y
// la lógica de guardado que ya existía (insert en `categories`, con
// validación de restaurant_id), agrega:
//   - Imagen de la categoría (misma mecánica de subida que el campo Imagen
//     de ModalProducto: bucket `product-images`, JPG/PNG hasta 5MB) —
//     columna `categories.image_url`, agregada en la migración
//     add_image_url_to_categories.
//   - En modo edición (editingCategory != null — una categoría nueva
//     todavía no tiene productos), un checklist con scroll de los
//     productos del restaurante para asignarlos/quitarlos de esta
//     categoría, escribiendo directamente en `products.category_id` (el
//     mismo FK real que ya usa el campo "Categoría" de ModalProducto — no
//     se inventa ninguna tabla de relación nueva).
// `editingCategory` es opcional (default null) porque hoy el único punto
// de entrada en AdminDashboard.tsx solo abre el modo "crear" — el
// componente ya soporta el modo edición completo para cuando se conecte
// un botón "Editar" ahí.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ModalFormularioLateral } from "@/components/ModalFormularioLateral";
import { CampoFormulario } from "@/components/ModalFormularioElegante";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Package, Loader2, Tags } from "lucide-react";

interface Categoria {
  id: string;
  name: string;
  slug: string;
  image_url?: string | null;
  display_order?: number | null;
}

interface ProductoLigero {
  id: string;
  name: string;
  price: number;
  category_id: string | null;
}

interface ModalCategoriaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string | null;
  /** Categoría a editar, o null/omitido para crear una nueva. */
  editingCategory?: Categoria | null;
  /** Se llama después de guardar con éxito — el padre refresca su lista. */
  onGuardado: () => void | Promise<void>;
}

export function ModalCategoria({ open, onOpenChange, restaurantId, editingCategory = null, onGuardado }: ModalCategoriaProps) {
  const { toast } = useToast();
  const [nombre, setNombre] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [errorNombre, setErrorNombre] = useState<string | undefined>();

  const [productos, setProductos] = useState<ProductoLigero[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState(false);
  const [asignaciones, setAsignaciones] = useState<Record<string, boolean>>({});

  const editando = editingCategory !== null;

  useEffect(() => {
    if (!open) return;
    setNombre(editingCategory?.name ?? "");
    setImageUrl(editingCategory?.image_url ?? "");
    setErrorNombre(undefined);

    if (editingCategory && restaurantId) {
      setCargandoProductos(true);
      supabase
        .from("products")
        .select("id, name, price, category_id")
        .eq("restaurant_id", restaurantId)
        .order("name")
        .then(({ data, error }) => {
          setCargandoProductos(false);
          if (error) {
            toast({ title: "No se pudieron cargar los productos", description: error.message, variant: "destructive" });
            return;
          }
          setProductos(data ?? []);
          const inicial: Record<string, boolean> = {};
          (data ?? []).forEach((p) => { inicial[p.id] = p.category_id === editingCategory.id; });
          setAsignaciones(inicial);
        });
    } else {
      setProductos([]);
      setAsignaciones({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingCategory, restaurantId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "Solo se permiten imágenes", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Error", description: "La imagen no puede superar 5MB", variant: "destructive" });
      return;
    }
    setSubiendoImagen(true);
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const { error } = await supabase.storage.from("product-images").upload(fileName, file);
    if (error) {
      toast({ title: "Error al subir imagen", description: error.message, variant: "destructive" });
      setSubiendoImagen(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(fileName);
    setImageUrl(publicUrl);
    toast({ title: "¡Imagen subida!", description: "La imagen se subió correctamente" });
    setSubiendoImagen(false);
  };

  const alternarProducto = (productId: string, checked: boolean) => {
    setAsignaciones((a) => ({ ...a, [productId]: checked }));
  };

  const handleGuardar = async () => {
    const nombreValido = nombre.trim().length > 0;
    setErrorNombre(nombreValido ? undefined : "El nombre es obligatorio.");
    if (!nombreValido) return;

    if (!restaurantId) {
      toast({ title: "Error", description: "No se pudo determinar el restaurante para esta categoría", variant: "destructive" });
      return;
    }

    setGuardando(true);
    const categoryData = {
      name: nombre,
      slug: nombre.toLowerCase().replace(/\s+/g, "-"),
      image_url: imageUrl || null,
    };

    if (editingCategory) {
      const { error } = await supabase.from("categories").update(categoryData).eq("id", editingCategory.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setGuardando(false);
        return;
      }

      // Aplica los cambios del checklist de productos contra su estado
      // original — solo toca las filas cuya asignación realmente cambió.
      const idsAgregar = productos.filter((p) => asignaciones[p.id] && p.category_id !== editingCategory.id).map((p) => p.id);
      const idsQuitar = productos.filter((p) => !asignaciones[p.id] && p.category_id === editingCategory.id).map((p) => p.id);

      if (idsAgregar.length > 0) {
        const { error: errorAgregar } = await supabase.from("products").update({ category_id: editingCategory.id }).in("id", idsAgregar);
        if (errorAgregar) {
          toast({ title: "La categoría se guardó, pero no se pudieron asignar todos los productos", description: errorAgregar.message, variant: "destructive" });
        }
      }
      if (idsQuitar.length > 0) {
        const { error: errorQuitar } = await supabase.from("products").update({ category_id: null }).in("id", idsQuitar);
        if (errorQuitar) {
          toast({ title: "La categoría se guardó, pero no se pudieron quitar todos los productos", description: errorQuitar.message, variant: "destructive" });
        }
      }

      toast({ title: "¡Actualizada!", description: "Categoría actualizada correctamente" });
    } else {
      const { error } = await supabase.from("categories").insert({ ...categoryData, restaurant_id: restaurantId });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setGuardando(false);
        return;
      }
      toast({ title: "¡Agregada!", description: "Categoría agregada correctamente" });
    }

    setGuardando(false);
    onOpenChange(false);
    await onGuardado();
  };

  return (
    <ModalFormularioLateral
      open={open}
      onOpenChange={onOpenChange}
      icono={Tags}
      titulo={editando ? "Editar categoría" : "Agregar categoría"}
      subtitulo="Así se agrupan los productos en el menú de voz y WhatsApp."
      anchoClase="max-w-5xl"
      footer={
        <Button
          className="rounded-full px-6"
          onClick={handleGuardar}
          disabled={guardando || subiendoImagen}
        >
          {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Agregar categoría"}
        </Button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CampoFormulario id="categoria-nombre" label="Nombre" error={errorNombre}>
          <Input id="categoria-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        </CampoFormulario>

        <CampoFormulario
          id="categoria-imagen"
          label="Imagen"
          hint={subiendoImagen ? "Subiendo imagen…" : "Opcional — JPG o PNG, hasta 5MB."}
        >
          <div className="flex items-center gap-3">
            {imageUrl && (
              <img src={imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 border border-border" />
            )}
            <Input id="categoria-imagen" type="file" accept="image/*" onChange={handleImageUpload} disabled={subiendoImagen} />
          </div>
        </CampoFormulario>

        {editando && (
          <div className="space-y-2 md:col-span-2">
            <p className="text-[12.5px] font-medium text-foreground">Productos en esta categoría</p>
            <p className="text-[11.5px] text-muted-foreground -mt-1">Marca los productos del restaurante que pertenecen aquí.</p>

            {cargandoProductos ? (
              <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground py-4 justify-center">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando productos…
              </div>
            ) : productos.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground py-3 text-center">Este restaurante todavía no tiene productos.</p>
            ) : (
              <ScrollArea className="h-48 rounded-lg border border-border">
                <div className="p-1.5 space-y-1">
                  {productos.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 cursor-pointer hover:bg-muted/60 transition-colors"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
                        <span className="text-[12.5px] text-foreground truncate">{p.name}</span>
                      </span>
                      <span className="flex items-center gap-2.5 shrink-0">
                        <span className="font-mono tabular-nums text-[11.5px] text-muted-foreground">${Number(p.price).toLocaleString("es-MX")}</span>
                        <Checkbox checked={!!asignaciones[p.id]} onCheckedChange={(v) => alternarProducto(p.id, v === true)} />
                      </span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </div>
    </ModalFormularioLateral>
  );
}

export type { ModalCategoriaProps, Categoria };
