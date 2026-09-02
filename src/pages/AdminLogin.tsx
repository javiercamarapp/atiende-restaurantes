import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, Mail } from "lucide-react";

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
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await routeAfterAuth(navigate);
    };
    checkSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      toast({ title: "Acceso denegado", description: "No tienes permisos de administrador", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast({ title: "Error de autenticación", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: roleData } = await supabase
        .from("user_roles").select("*").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
      if (!roleData) {
        await supabase.from("user_roles").insert({ user_id: data.user.id, role: "admin" });
      }
      toast({ title: "Bienvenido", description: "Sesión iniciada" });
      await routeAfterAuth(navigate);
    }

    setLoading(false);
  };

  const handleSignUp = async () => {
    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      toast({ title: "Acceso denegado", description: "Solo el administrador puede registrarse", variant: "destructive" });
      return;
    }
    if (!password || password.length < 6) {
      toast({ title: "Error", description: "La contraseña debe tener al menos 6 caracteres", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/admin` },
    });

    if (error) {
      toast({ title: "Error de registro", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from("user_roles").insert({ user_id: data.user.id, role: "admin" });
      toast({ title: "Cuenta creada", description: "Ahora puedes iniciar sesión" });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <span className="font-display text-2xl font-semibold tracking-tight text-foreground">atiende.ai</span>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground mt-2">
            Panel de operación
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-7 shadow-[var(--shadow-card)]">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  placeholder="tu@correo.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div className="pt-1 space-y-2.5">
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Entrando..." : "Iniciar sesión"}
              </Button>
              <button
                type="button"
                onClick={handleSignUp}
                disabled={loading}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Crear cuenta admin
              </button>
            </div>
          </form>
        </div>

        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground text-center mt-6">
          Acceso exclusivo
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
