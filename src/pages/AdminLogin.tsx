import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AtiendeMark, AtiendeWordmark } from "@/components/AtiendeLogo";
import "./login.css";

// Superadmin único de la plataforma (Javier). Los admins por negocio/tenant
// (ej. el dueño de Los Taquitos de PM) se dan de alta en `restaurant_staff`.
const ADMIN_EMAIL = "javiercamaraportepetit@gmail.com";

async function routeAfterAuth(navigate: ReturnType<typeof useNavigate>) {
  const { data: roles } = await supabase.from("user_roles").select("role");
  const isSuperadmin = roles?.some((r) => r.role === "superadmin");
  navigate(isSuperadmin ? "/admin/superadmin" : "/admin");
}

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // El link mágico vuelve aquí con el token en el hash de la URL —
    // supabase-js lo detecta solo al cargar (detectSessionInUrl) y deja la
    // sesión lista antes de que este efecto corra.
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await routeAfterAuth(navigate);
    };
    checkSession();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) routeAfterAuth(navigate);
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/admin/login" },
    });
    if (error) {
      toast({ title: "No se pudo continuar con Google", description: error.message, variant: "destructive" });
      setLoading(false);
    }
    // En éxito, Supabase redirige de inmediato — no hay más que hacer aquí.
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      toast({ title: "Acceso denegado", description: "No tienes permisos de administrador", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + "/admin/login" },
    });
    setLoading(false);

    if (error) {
      toast({ title: "No se pudo enviar el enlace", description: error.message, variant: "destructive" });
      return;
    }
    setEnviado(true);
  };

  return (
    <main className="login min-h-screen lg:grid lg:grid-cols-2">
      {/* Columna del formulario — un solo eje óptico, max-w-[392px] */}
      <section className="flex min-h-screen flex-col px-6 py-7 sm:px-10 lg:px-14 lg:py-10">
        <div className="mx-auto flex w-full max-w-[392px] flex-1 flex-col">
          <header className="login-entra flex items-center">
            <AtiendeWordmark />
          </header>

          <div className="flex flex-1 items-center py-12">
            <div className="w-full">
              <p className="login-entra login-kicker" style={{ animationDelay: "40ms" }}>
                Acceso al panel
              </p>
              <h1
                className="login-entra login-serif mt-5 text-[38px] sm:text-[44px] text-foreground"
                style={{ animationDelay: "90ms" }}
              >
                Bienvenido a atiende
              </h1>
              <p
                className="login-entra mt-4 text-[15px] leading-[1.6] text-muted-foreground"
                style={{ animationDelay: "140ms" }}
              >
                El panel de operación de tu restaurante.
              </p>

              {enviado && (
                <div
                  role="status"
                  className="login-entra mt-9 rounded-[18px] p-5 bg-muted border border-border"
                  style={{ animationDelay: "190ms" }}
                >
                  <p className="text-[15px] font-semibold text-foreground">Te mandamos un enlace a tu correo.</p>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">Ábrelo desde este mismo dispositivo.</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                    ¿No llega? Revisa spam, o{" "}
                    <button type="button" onClick={() => setEnviado(false)} className="underline underline-offset-2">
                      vuelve a escribir tu correo
                    </button>
                    .
                  </p>
                </div>
              )}

              {!enviado && (
                <>
                  <div className="login-entra mt-9 h-px bg-border" style={{ animationDelay: "180ms" }} />

                  <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={loading}
                    className="login-entra login-btn login-btn-borde mt-8"
                    style={{ animationDelay: "220ms" }}
                  >
                    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
                      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
                      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
                      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
                      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
                    </svg>
                    Continuar con Google
                  </button>

                  <div className="login-entra my-6 flex items-center gap-4" style={{ animationDelay: "250ms" }}>
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-[13px] lowercase text-muted-foreground">o</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <form onSubmit={handleSubmit} className="login-entra flex flex-col gap-3" style={{ animationDelay: "280ms" }}>
                    <label htmlFor="login-email" className="sr-only">Tu correo</label>
                    <input
                      id="login-email"
                      type="email"
                      required
                      placeholder="tu@correo.com"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="login-campo"
                    />
                    <button type="submit" disabled={loading} className="login-btn login-btn-tinta mt-1">
                      <span aria-hidden className="login-glifo">
                        <AtiendeMark className="h-[17px] w-auto brightness-0 invert" />
                      </span>
                      <span>{loading ? "Enviando…" : "Continuar con correo"}</span>
                    </button>
                  </form>

                  <p className="login-entra mt-7 text-pretty text-[14px] leading-relaxed text-muted-foreground" style={{ animationDelay: "320ms" }}>
                    ¿Tu correo no tiene acceso?{" "}
                    <span className="font-semibold text-foreground">Pídele a tu restaurante que te dé de alta.</span>
                  </p>
                </>
              )}

              <p className="login-entra mt-10 text-pretty text-[12px] leading-[1.7] text-muted-foreground" style={{ animationDelay: "360ms" }}>
                Al continuar, aceptas los{" "}
                <a href="/terminos" className="underline underline-offset-2 text-foreground hover:opacity-70 transition-opacity">
                  Términos de Servicio
                </a>{" "}
                y el{" "}
                <a href="/privacidad" className="underline underline-offset-2 text-foreground hover:opacity-70 transition-opacity">
                  Aviso de Privacidad
                </a>{" "}
                de atiende.ai.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* La lámina — mismo material que .login-lamina de Likida, en el azul
          de este producto en vez de una foto de flota. */}
      <aside className="hidden lg:flex lg:flex-col lg:py-10 lg:pl-6 lg:pr-10">
        <figure className="login-lamina min-h-0 flex-1 flex items-center justify-center">
          <img
            src="/images/login-hero.png"
            alt="Pase de una cocina comercial vacía en la hora azul, con vapor sobre la barra de acero."
            className="login-foto-marca absolute inset-0 w-full h-full object-cover"
          />
          <div className="login-velo" />
          <figcaption className="absolute inset-x-0 bottom-0 p-9 z-10">
            <p className="login-kicker" style={{ color: "color-mix(in srgb, white 78%, transparent)" }}>
              Pedidos por voz y WhatsApp
            </p>
            <p className="login-serif mt-3.5 text-white" style={{ fontSize: "clamp(20px, 1.9vw, 27px)" }}>
              Restaurantes en México.
              <br />
              El cierre del turno, solo.
            </p>
          </figcaption>
        </figure>
      </aside>
    </main>
  );
};

export default AdminLogin;
