import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import RepartidorDashboard from "./pages/RepartidorDashboard";
import RepartidorAdminPanel from "./pages/RepartidorAdminPanel";
import Terminos from "./pages/Terminos";
import Privacidad from "./pages/Privacidad";

const queryClient = new QueryClient();

// Si Supabase no encuentra la URL exacta de retorno (ej. ".../admin/login")
// en su lista de Redirect URLs permitidas, cae de vuelta a la raíz del
// sitio — con el token del magic link o de Google todavía colgando en el
// hash. Un <Navigate to="/admin/login" /> normal NO arrastra ese hash (no es
// parte del "to"), así que el token se perdía en silencio justo aquí.
// Reenviarlo a mano evita depender de que la lista de Supabase esté
// perfecta para que el login funcione.
const RaizConHash = () => {
  const location = useLocation();
  return <Navigate to={{ pathname: "/admin/login", search: location.search, hash: location.hash }} replace />;
};

// Este es el software (panel de operación), no el sitio público del
// restaurante — por eso arranca en login, no en una landing. El storefront
// de cada negocio vive en su propio repo (para Taquitos DPM: lostaquitosdepm).
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RaizConHash />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/terminos" element={<Terminos />} />
          <Route path="/privacidad" element={<Privacidad />} />
          <Route path="/admin/superadmin" element={<SuperAdminDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/repartidor/:userId" element={<RepartidorAdminPanel />} />
          <Route path="/repartidor" element={<RepartidorDashboard />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
