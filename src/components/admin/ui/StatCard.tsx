import { TrendingUp, TrendingDown } from "lucide-react";

type IconType = React.ComponentType<{ className?: string; strokeWidth?: number | string }>;

// Anatomía exacta de StatCard de Likida (vista superadmin/plataforma): caja
// interna --canvas con chip de ícono sólido en --marca, cifra grande, y un
// pie opcional bajo un hairline PUNTEADO (para una nota sin comparación
// numérica — ej. "23 liquidaciones generadas" — a diferencia de TrendStatCard
// que sí lleva el badge de variación).
export function StatCard({
  icon: Icon,
  label,
  value,
  nota,
}: {
  icon: IconType;
  label: string;
  value: string;
  nota?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-2">
      <div className="rounded-lg px-3 py-2.5 bg-muted">
        <div className="flex items-center gap-2.5 mb-1.5">
          <div className="w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
          </div>
          <span className="text-[13px] text-muted-foreground">{label}</span>
        </div>
        <p className="font-display text-xl font-semibold tabular-nums text-foreground">{value}</p>
      </div>
      {nota && (
        <div className="mx-1.5 mt-1.5 pt-1.5 border-t border-dashed border-border">
          <p className="text-[11px] text-muted-foreground">{nota}</p>
        </div>
      )}
    </div>
  );
}

// Segunda anatomía de tarjeta de cifra que usa Likida — la de "Tus ventas" a
// nivel de cuenta (no la de plataforma): chip de ícono en un tono claro de la
// marca (no sólido), un link "Ver más" arriba a la derecha, y un pie en
// forma de píldora de color (verde si sube, rojo si baja) con la variación
// contra el periodo anterior — en vez del pie neutro con hairline punteado
// de StatCard.
export function TrendStatCard({
  icon: Icon,
  label,
  value,
  deltaPct,
  deltaLabel = "vs ayer",
  onVerMas,
}: {
  icon: IconType;
  label: string;
  value: string;
  /** % de variación; positivo = sube (verde), negativo = baja (rojo), 0/undefined = neutro. */
  deltaPct?: number;
  deltaLabel?: string;
  onVerMas?: () => void;
}) {
  const subiendo = (deltaPct ?? 0) >= 0;
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        {onVerMas && (
          <button onClick={onVerMas} className="text-sm text-primary hover:underline underline-offset-2 shrink-0">
            Ver más
          </button>
        )}
      </div>
      <p className="font-display text-2xl font-semibold tabular-nums text-foreground mb-3">{value}</p>
      {deltaPct !== undefined && (
        <div
          className={
            "flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm " +
            (subiendo
              ? "bg-[hsl(142_71%_45%/0.12)] text-[hsl(142_71%_29%)]"
              : "bg-[hsl(0_72%_51%/0.12)] text-[hsl(0_72%_41%)]")
          }
        >
          {subiendo ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          <span className="font-medium tabular-nums">
            {subiendo ? "+" : ""}
            {deltaPct.toFixed(1)}%
          </span>
          <span className="text-xs opacity-80">{deltaLabel}</span>
        </div>
      )}
    </div>
  );
}
