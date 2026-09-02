import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PreferenciasRow {
  id: string;
  notify_nuevo: boolean;
  notify_preparando: boolean;
  notify_en_camino: boolean;
  notify_entregado: boolean;
  notify_cancelado: boolean;
}

const EVENTOS: { key: keyof Omit<PreferenciasRow, "id">; label: string; descripcion: string }[] = [
  { key: "notify_nuevo", label: "Pedido nuevo", descripcion: "Cuando el agente de voz o WhatsApp toma un pedido." },
  { key: "notify_preparando", label: "En preparación", descripcion: "Cuando se confirma un pedido y pasa a cocina." },
  { key: "notify_en_camino", label: "En camino", descripcion: "Cuando un pedido sale a entrega." },
  { key: "notify_entregado", label: "Entregado", descripcion: "Cuando se marca un pedido como entregado." },
  { key: "notify_cancelado", label: "Cancelado", descripcion: "Cuando se cancela un pedido." },
];

const NotificacionesSection = ({ userId }: { userId: string | undefined }) => {
  const { toast } = useToast();
  const [fila, setFila] = useState<PreferenciasRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("restaurant_staff")
      .select("id, notify_nuevo, notify_preparando, notify_en_camino, notify_entregado, notify_cancelado")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        setFila(data as PreferenciasRow | null);
        setLoading(false);
      });
  }, [userId]);

  const toggle = async (key: keyof Omit<PreferenciasRow, "id">, value: boolean) => {
    if (!fila) return;
    setFila({ ...fila, [key]: value });
    setGuardando(key);
    const { error } = await supabase.from("restaurant_staff").update({ [key]: value }).eq("id", fila.id);
    setGuardando(null);
    if (error) {
      setFila(fila); // revertir
      toast({ title: "No se pudo guardar", description: error.message, variant: "destructive" });
    }
  };

  if (loading) return null;

  if (!fila) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No encontramos tu cuenta dentro del staff de este restaurante, así que no hay preferencias de notificación que mostrar.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          Notificaciones por correo
        </CardTitle>
        <CardDescription>
          Elige qué eventos de pedido quieres recibir en tu correo. Cada persona del equipo decide los suyos.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {EVENTOS.map((ev) => (
          <div key={ev.key} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
            <div className="pr-4">
              <p className="text-sm font-medium text-foreground">{ev.label}</p>
              <p className="text-sm text-muted-foreground">{ev.descripcion}</p>
            </div>
            <Switch
              checked={fila[ev.key]}
              disabled={guardando === ev.key}
              onCheckedChange={(v) => toggle(ev.key, v)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default NotificacionesSection;
