import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Mail, ArrowLeft, User, Phone } from "lucide-react";
import logo from "@/assets/taquitos-logo.avif";
const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [isRepartidor, setIsRepartidor] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate(isRepartidor ? "/repartidor" : "/");
      }
    });
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      if (session) {
        navigate(isRepartidor ? "/repartidor" : "/");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate, isRepartidor]);
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (isLogin) {
      const {
        error
      } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("¡Bienvenido!");
        navigate(isRepartidor ? "/repartidor" : "/");
      }
    } else {
      const {
        error
      } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { nombre, telefono, isRepartidor }
        }
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("¡Cuenta creada! Ya puedes iniciar sesión");
        setIsLogin(true);
      }
    }
    setLoading(false);
  };
  return <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-primary-foreground/10 backdrop-blur-md rounded-3xl p-4 sm:p-8 border border-primary-foreground/20">
        <div className="flex flex-col items-center mb-3 sm:mb-8">
          <img src={logo} alt="Los Taquitos de PM" className="w-28 sm:w-64 h-auto mb-2 sm:mb-4 object-contain" />
          <h1 className="text-lg sm:text-2xl font-bold text-primary-foreground text-center">
            {isRepartidor 
              ? (isLogin ? "Inicio de Sesión de Repartidor" : "Crear Cuenta de Repartidor")
              : (isLogin ? "Iniciar Sesión" : "Crear Cuenta")}
          </h1>
          <p className="text-primary-foreground/70 text-xs sm:text-sm">
            {isRepartidor 
              ? (isLogin ? "Accede a tu panel de repartidor" : "Regístrate como repartidor")
              : (isLogin ? "Accede a tu cuenta" : "Regístrate para continuar")}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-2 sm:space-y-6">
          {!isLogin && (
            <>
              <div className="space-y-1">
                <Label htmlFor="nombre" className="text-primary-foreground text-xs sm:text-sm">Nombre completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-foreground/50" />
                  <Input id="nombre" type="text" value={nombre} onChange={e => setNombre(e.target.value)} className="pl-10 h-9 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50" placeholder="Tu nombre completo" required />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="telefono" className="text-primary-foreground text-xs sm:text-sm">Número de celular</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-foreground/50" />
                  <Input id="telefono" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} className="pl-10 h-9 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50" placeholder="999 123 4567" required />
                </div>
              </div>
            </>
          )}
          <div className="space-y-1">
            <Label htmlFor="email" className="text-primary-foreground text-sm">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-foreground/50" />
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="pl-10 h-9 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50" placeholder="tu@email.com" required />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="password" className="text-primary-foreground text-sm">Contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-foreground/50" />
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="pl-10 h-9 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50" placeholder="••••••••" required minLength={6} />
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <Button type="submit" disabled={loading} className="w-full bg-terracotta hover:bg-terracotta/90 text-white">
              {loading ? "Cargando..." : isRepartidor ? "Entrar" : isLogin ? "Iniciar Sesión" : "Crear Cuenta"}
            </Button>

            <Button type="button" onClick={() => setIsLogin(!isLogin)} variant="ghost" className="w-full text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10">
              {isLogin ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
            </Button>
          </div>
        </form>

        <div className="mt-4 sm:mt-6 space-y-2 sm:space-y-3 text-center">
          <button type="button" onClick={() => {
          setIsRepartidor(!isRepartidor);
          setIsLogin(true);
        }} className="block text-primary-foreground/70 hover:text-primary-foreground text-sm font-medium mx-auto">
            {isRepartidor ? "Volver a inicio de sesión normal" : "Iniciar sesión como repartidor"}
          </button>
          <a href="/" className="text-primary-foreground/70 hover:text-primary-foreground text-sm inline-flex items-center gap-2 justify-center">
            <ArrowLeft className="w-4 h-4" />
            Volver al sitio
          </a>
        </div>
      </div>
    </div>;
};
export default Auth;