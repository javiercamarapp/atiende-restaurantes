import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import RepartidorDashboard from "./pages/RepartidorDashboard";
import RepartidorAdminPanel from "./pages/RepartidorAdminPanel";

const queryClient = new QueryClient();

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
          <Route path="/" element={<Navigate to="/admin/login" replace />} />
          <Route path="/admin/login" element={<AdminLogin />} />
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
