// Marco compartido de las páginas legales (/terminos, /privacidad) — mismo
// patrón que src/app/legal/marco.tsx de Likida (proyect-x-), portado a
// Vite/React Router. Un solo layout para que los dos documentos se vean de
// la misma empresa, con la misma disciplina: un dato de identidad que no se
// conoce se SEÑALA en el texto, nunca se inventa.
import { Link } from "react-router-dom";
import { AtiendeWordmark } from "@/components/AtiendeLogo";

export interface SeccionLegal {
  titulo: string;
  /** El artículo que sostiene la sección, si aplica. */
  fundamento?: string;
  parrafos: string[];
}

/** `**negritas**` sin un motor de markdown completo — es lo único que estos
 * documentos necesitan. */
export function ConNegritas({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\*\*[^*]+\*\*)/g).map((t, i) =>
        t.startsWith("**") && t.endsWith("**") ? (
          <strong key={i} className="font-semibold text-foreground">{t.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{t}</span>
        ),
      )}
    </>
  );
}

/** El aviso de dato faltante — se enseña en vez de rellenarse. */
export function FaltaDato({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 rounded-md px-4 py-3 text-sm border border-[hsl(var(--destructive)/0.4)] text-foreground bg-[hsl(var(--destructive)/0.06)]">
      {children}
    </p>
  );
}

export function LegalPage({
  etiqueta,
  bajada,
  secciones,
  aviso,
  pie,
  vigenteDesde,
}: {
  etiqueta: string;
  bajada: string;
  secciones: SeccionLegal[];
  aviso?: React.ReactNode;
  pie?: React.ReactNode;
  vigenteDesde: string;
}) {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 py-10 text-[15px] leading-relaxed text-muted-foreground">
        <div className="mb-8">
          <AtiendeWordmark />
        </div>
        <header className="pb-6 border-b border-border">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {etiqueta}
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-foreground">atiende.ai</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Vigente desde el {vigenteDesde} · {bajada}
          </p>
        </header>

        {aviso}

        {secciones.map((s) => (
          <section key={s.titulo} className="mt-8">
            <h2 className="text-base font-semibold text-foreground">{s.titulo}</h2>
            {s.fundamento && <p className="mt-0.5 text-xs text-muted-foreground">{s.fundamento}</p>}
            {s.parrafos.map((p, i) => (
              <p key={i} className="mt-3">
                <ConNegritas texto={p} />
              </p>
            ))}
          </section>
        ))}

        <footer className="mt-12 pt-6 border-t border-border text-sm">
          {pie}
          <p className="mt-4 flex gap-4">
            <Link to="/terminos" className="underline underline-offset-2 hover:opacity-70 transition-opacity">
              Términos de servicio
            </Link>
            <Link to="/privacidad" className="underline underline-offset-2 hover:opacity-70 transition-opacity">
              Política de privacidad
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
