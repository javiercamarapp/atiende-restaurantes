import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";

const NotFound = lazy(() => import("./pages/NotFound"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const RepartidorDashboard = lazy(() => import("./pages/RepartidorDashboard"));
const RepartidorAdminPanel = lazy(() => import("./pages/RepartidorAdminPanel"));
const Terminos = lazy(() => import("./pages/Terminos"));
const Privacidad = lazy(() => import("./pages/Privacidad"));

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
        <Suspense fallback={<main className="min-h-screen bg-background" aria-busy="true" aria-label="Cargando" />}>
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
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
