import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, Mail } from "lucide-react";

// Superadmin único de la plataforma (Javier). Los admins por negocio/tenant
// (ej. el dueño de Los Taquitos de PM) se dan de alta aparte una vez que
// exista más de un tenant — ver docs/agente-voz y la nota de arquitectura.
const ADMIN_EMAIL = "javiercamaraportepetit@gmail.com";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user.email === ADMIN_EMAIL) {
        navigate("/admin");
      }
    };
    checkSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      toast({
        title: "Acceso Denegado",
        description: "No tienes permisos de administrador",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Error de autenticación",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (data.user) {
      // Check if admin role exists, if not create it
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        // For the specific admin email, auto-assign admin role
        await supabase.from("user_roles").insert({
          user_id: data.user.id,
          role: "admin",
        });
      }

      toast({
        title: "¡Bienvenido!",
        description: "Has iniciado sesión correctamente",
      });
      navigate("/admin");
    }
    
    setLoading(false);
  };

  const handleSignUp = async () => {
    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      toast({
        title: "Acceso Denegado",
        description: "Solo el administrador puede registrarse",
        variant: "destructive",
      });
      return;
    }

    if (!password || password.length < 6) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/admin`,
      },
    });

    if (error) {
      toast({
        title: "Error de registro",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (data.user) {
      // Auto-assign admin role for the admin email
      await supabase.from("user_roles").insert({
        user_id: data.user.id,
        role: "admin",
      });

      toast({
        title: "¡Cuenta creada!",
        description: "Ahora puedes iniciar sesión",
      });
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-primary-foreground/10 backdrop-blur-md rounded-3xl p-8 border border-primary-foreground/20">
        <div className="flex flex-col items-center mb-8">
          <span className="font-display text-3xl font-semibold text-primary-foreground mb-1">atiende.ai</span>
          <h1 className="text-lg font-medium text-primary-foreground/90">Panel de operación</h1>
          <p className="text-primary-foreground/70 text-sm">Acceso exclusivo</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-primary-foreground">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-foreground/50" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
                placeholder="admin@email.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-primary-foreground">Contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-foreground/50" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="space-y-3">
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-terracotta hover:bg-terracotta/90 text-white"
            >
              {loading ? "Cargando..." : "Iniciar Sesión"}
            </Button>
            
            <Button
              type="button"
              onClick={handleSignUp}
              disabled={loading}
              variant="outline"
              className="w-full border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
            >
              Crear Cuenta Admin
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
