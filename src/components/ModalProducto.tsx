// Formulario "Agregar/Editar producto" sobre el shell ModalFormularioLateral
// (riel izquierdo con ícono/título + columna derecha con el formulario) —
// mismos campos, validación y lógica de guardado (insert/update en
// `products`, validación de restaurant_id al crear) que la versión
// anterior sobre ModalFormularioElegante, solo con la presentación nueva.
// Campos en grid de 2 columnas (Nombre+Precio, Descripción+Categoría,
// Imagen a lo ancho, los dos toggles lado a lado) dentro de la columna
// derecha del riel. Autocontenido: trae su propio estado de formulario,
// subida de imagen y submit — el padre solo pasa qué producto se edita (o
// null para crear) y qué hacer al terminar de guardar.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ModalFormularioLateral } from "@/components/ModalFormularioLateral";
import { CampoFormulario } from "@/components/ModalFormularioElegante";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { UtensilsCrossed } from "lucide-react";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_popular: boolean | null;
  is_available: boolean | null;
  category_id: string | null;
  display_order: number | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  display_order: number | null;
}

interface ModalProductoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Producto a editar, o null para crear uno nuevo. */
  editingProduct: Product | null;
  categories: Category[];
  restaurantId: string | null;
  /** Se llama después de guardar con éxito (insert o update) — el padre refresca su lista. */
  onGuardado: () => void | Promise<void>;
}

const FORM_VACIO = {
  name: "",
  description: "",
  price: "",
  image_url: "",
  category_id: "",
  is_popular: false,
  is_available: true,
};

export function ModalProducto({ open, onOpenChange, editingProduct, categories, restaurantId, onGuardado }: ModalProductoProps) {
  const { toast } = useToast();
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [errorNombre, setErrorNombre] = useState<string | undefined>();
  const [errorPrecio, setErrorPrecio] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    if (editingProduct) {
      setForm({
        name: editingProduct.name,
        description: editingProduct.description || "",
        price: editingProduct.price.toString(),
        image_url: editingProduct.image_url || "",
        category_id: editingProduct.category_id || "",
        is_popular: editingProduct.is_popular || false,
        is_available: editingProduct.is_available ?? true,
      });
    } else {
      setForm(FORM_VACIO);
    }
    setErrorNombre(undefined);
    setErrorPrecio(undefined);
  }, [open, editingProduct]);

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
    setForm((f) => ({ ...f, image_url: publicUrl }));
    toast({ title: "¡Imagen subida!", description: "La imagen se subió correctamente" });
    setSubiendoImagen(false);
  };

  const handleGuardar = async () => {
    const nombreValido = form.name.trim().length > 0;
    const precioValido = form.price !== "" && !isNaN(parseFloat(form.price)) && parseFloat(form.price) >= 0;
    setErrorNombre(nombreValido ? undefined : "El nombre es obligatorio.");
    setErrorPrecio(precioValido ? undefined : "Ingresa un precio válido.");
    if (!nombreValido || !precioValido) return;

    setGuardando(true);
    const productData = {
      name: form.name,
      description: form.description || null,
      price: parseFloat(form.price),
      image_url: form.image_url || null,
      category_id: form.category_id || null,
      is_popular: form.is_popular,
      is_available: form.is_available,
    };

    if (editingProduct) {
      const { error } = await supabase.from("products").update(productData).eq("id", editingProduct.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setGuardando(false);
        return;
      }
      toast({ title: "¡Actualizado!", description: "Producto actualizado correctamente" });
    } else {
      if (!restaurantId) {
        toast({ title: "Error", description: "No se pudo determinar el restaurante para este producto", variant: "destructive" });
        setGuardando(false);
        return;
      }
      const { error } = await supabase.from("products").insert({ ...productData, restaurant_id: restaurantId });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setGuardando(false);
        return;
      }
      toast({ title: "¡Agregado!", description: "Producto agregado correctamente" });
    }

    setGuardando(false);
    onOpenChange(false);
    await onGuardado();
  };

  return (
    <ModalFormularioLateral
      open={open}
      onOpenChange={onOpenChange}
      icono={UtensilsCrossed}
      titulo={editingProduct ? "Editar producto" : "Agregar producto"}
      subtitulo="Así se ve y se ofrece en el menú de voz y WhatsApp."
      anchoClase="max-w-5xl"
      footer={
        <Button
          className="rounded-full px-6"
          onClick={handleGuardar}
          disabled={guardando || subiendoImagen}
        >
          {guardando ? "Guardando…" : editingProduct ? "Guardar cambios" : "Agregar producto"}
        </Button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CampoFormulario id="producto-nombre" label="Nombre" error={errorNombre}>
          <Input id="producto-nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
        </CampoFormulario>

        <CampoFormulario id="producto-precio" label="Precio" error={errorPrecio}>
          <Input id="producto-precio" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </CampoFormulario>

        <CampoFormulario id="producto-descripcion" label="Descripción" hint="Opcional — ayuda al agente a describirlo mejor.">
          <Textarea id="producto-descripcion" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </CampoFormulario>

        <CampoFormulario label="Categoría" hint="Opcional — así se agrupa en el menú.">
          <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
            <SelectTrigger><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CampoFormulario>

        <CampoFormulario
          id="producto-imagen"
          label="Imagen"
          hint={subiendoImagen ? "Subiendo imagen…" : "Opcional — JPG o PNG, hasta 5MB."}
          className="md:col-span-2"
        >
          <div className="flex items-center gap-3">
            {form.image_url && (
              <img src={form.image_url} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 border border-border" />
            )}
            <Input id="producto-imagen" type="file" accept="image/*" onChange={handleImageUpload} disabled={subiendoImagen} />
          </div>
        </CampoFormulario>

        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <Label htmlFor="producto-popular" className="text-[12.5px]">Popular</Label>
          <Switch id="producto-popular" checked={form.is_popular} onCheckedChange={(v) => setForm({ ...form, is_popular: v })} />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <Label htmlFor="producto-disponible" className="text-[12.5px]">Disponible</Label>
          <Switch id="producto-disponible" checked={form.is_available} onCheckedChange={(v) => setForm({ ...form, is_available: v })} />
        </div>
      </div>
    </ModalFormularioLateral>
  );
}

export type { ModalProductoProps };
