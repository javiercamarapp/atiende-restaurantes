// Shell de modal reutilizable con el mismo lenguaje visual de
// ModalClonarVoz.tsx (barra de gradiente primary→secondary, AtiendeMark,
// tipografía font-display, tokens de spacing/label del panel) pero sin la
// lógica de un wizard multi-paso — es un primitivo puro para formularios
// simples de una sola pantalla (crear/editar un registro). Quien lo
// consuma solo pone campos adentro con <CampoFormulario> y, opcionalmente,
// su propio footer.
import { ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AtiendeMark } from "@/components/AtiendeLogo";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalFormularioEleganteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Título centrado bajo el logo — mismo tratamiento que los headers de paso de ModalClonarVoz. */
  titulo: string;
  /** Texto secundario opcional, centrado, debajo del título. */
  subtitulo?: string;
  /** Contenido del formulario — normalmente una lista de <CampoFormulario>. */
  children: ReactNode;
  /**
   * Footer custom. Si se omite, se renderiza un botón primario rounded-full
   * de ancho completo ("Guardar cambios" por default) que llama a onGuardar.
   */
  footer?: ReactNode;
  /** Handler del botón por default (ignorado si se pasa `footer`). */
  onGuardar?: () => void;
  /** Deshabilita y cambia el texto del botón por default a "Guardando…" (ignorado si se pasa `footer`). */
  guardando?: boolean;
  /** Texto del botón por default. @default "Guardar cambios" */
  textoBotonGuardar?: string;
  /** Deshabilita el botón por default sin entrar en estado "guardando" (ej. validación incompleta). */
  guardarDeshabilitado?: boolean;
  /** Ancho del modal — mismo set de tamaños de Tailwind que max-w-*. @default "max-w-lg" */
  anchoClase?: string;
  /** Evita que un clic fuera o Escape cierren el modal (útil si hay estado sin guardar). */
  bloquearCierre?: boolean;
}

/**
 * Envuelve Label + un control de formulario con el spacing/tipografía
 * exactos que usa ModalClonarVoz para su campo "Nombre de la voz"
 * (space-y-2, Label text-[12.5px], hint/error text-[11.5-12px]).
 * `children` es el control en sí (Input, Textarea, Select, Checkbox, etc.)
 * — CampoFormulario no lo renderiza por ti, para no adivinar su tipo.
 */
interface CampoFormularioProps {
  /** Debe coincidir con el id/htmlFor del control pasado en children. */
  id?: string;
  label: string;
  /** Texto de ayuda debajo del control — se oculta si hay `error`. */
  hint?: string;
  /** Mensaje de error — reemplaza el hint y pinta el ícono de alerta. */
  error?: string;
  children: ReactNode;
  className?: string;
}

export function CampoFormulario({ id, label, hint, error, children, className }: CampoFormularioProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className="text-[12.5px]">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-[12px] text-destructive flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </p>
      ) : hint ? (
        <p className="text-[11.5px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function ModalFormularioElegante({
  open,
  onOpenChange,
  titulo,
  subtitulo,
  children,
  footer,
  onGuardar,
  guardando = false,
  textoBotonGuardar = "Guardar cambios",
  guardarDeshabilitado = false,
  anchoClase = "max-w-lg",
  bloquearCierre = false,
}: ModalFormularioEleganteProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onOpenChange(false); }}>
      <DialogContent
        className={cn(anchoClase, "p-0 gap-0 overflow-hidden")}
        onInteractOutside={bloquearCierre ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={bloquearCierre ? (e) => e.preventDefault() : undefined}
      >
        <div className="h-1 bg-gradient-to-r from-primary to-secondary" />

        <div className="px-6 pt-6 pb-5 flex flex-col items-center text-center border-b border-border">
          <AtiendeMark className="h-7 w-auto mb-3" />
          <p className="font-display text-lg font-semibold text-foreground">{titulo}</p>
          {subtitulo && <p className="text-[13px] text-muted-foreground mt-1 max-w-sm">{subtitulo}</p>}
        </div>

        <div className="p-6 space-y-4 text-left">{children}</div>

        <div className="px-6 pb-6">
          {footer ?? (
            <Button
              className="rounded-full w-full"
              onClick={onGuardar}
              disabled={guardando || guardarDeshabilitado}
            >
              {guardando ? "Guardando…" : textoBotonGuardar}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { ModalFormularioEleganteProps, CampoFormularioProps };
