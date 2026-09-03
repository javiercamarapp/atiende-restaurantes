// Anatomía exacta de StatCard de Likida: caja interna --canvas con chip de
// ícono sólido en --marca, cifra grande debajo del hairline punteado.
export function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  label: string;
  value: string;
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
    </div>
  );
}
