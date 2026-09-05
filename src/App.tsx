import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from "react";

type LazyModule = { default: React.ComponentType };

// Un despliegue anterior llegó a responder el HTML de la SPA para una URL de
// chunk. Algunos navegadores conservaron esa respuesta inválida en caché y el
// import dinámico quedó rechazado aunque producción ya estuviera corregida.
// Reintentamos una sola vez; si el problema persiste, mostramos recuperación
// visible en lugar de dejar la aplicación completamente en blanco.
const lazyRoute = (name: string, importer: () => Promise<LazyModule>) =>
  lazy(async () => {
    try {
      const module = await importer();
      sessionStorage.removeItem(`atiende:chunk-retry:${name}`);
      return module;
    } catch (error) {
      const retryKey = `atiende:chunk-retry:${name}`;
      if (!sessionStorage.getItem(retryKey)) {
        sessionStorage.setItem(retryKey, "1");
        window.location.reload();
        return new Promise<LazyModule>(() => undefined);
      }
      throw error;
    }
  });

class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("No se pudo cargar el panel", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <section role="alert" className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">No se pudo cargar el panel</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ocurrió un error al mostrar esta pantalla. Puede ser una versión anterior guardada en el navegador o un fallo temporal de carga.
          </p>
          <button
            type="button"
            onClick={async () => {
              sessionStorage.clear();
              if ("caches" in window) {
                const keys = await window.caches.keys();
                await Promise.all(keys.map((key) => window.caches.delete(key)));
              }
              window.location.reload();
            }}
            className="mt-5 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
          >
            Limpiar caché y recargar
          </button>
        </section>
      </main>
    );
  }
}

const LoadingScreen = () => (
  <main className="min-h-screen bg-background flex items-center justify-center" aria-busy="true" aria-label="Cargando panel">
    <div className="text-center">
      <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-muted border-t-primary" />
      <p className="mt-3 text-sm text-muted-foreground">Cargando panel…</p>
    </div>
  </main>
);

const NotFound = lazyRoute("not-found", () => import("./pages/NotFound"));
const AdminLogin = lazyRoute("admin-login", () => import("./pages/AdminLogin"));
const AdminDashboard = lazyRoute("admin", () => import("./pages/AdminDashboard"));
const SuperAdminDashboard = lazyRoute("superadmin", () => import("./pages/SuperAdminDashboard"));
const RepartidorDashboard = lazyRoute("repartidor", () => import("./pages/RepartidorDashboard"));
const RepartidorAdminPanel = lazyRoute("repartidor-admin", () => import("./pages/RepartidorAdminPanel"));
const Terminos = lazyRoute("terminos", () => import("./pages/Terminos"));
const Privacidad = lazyRoute("privacidad", () => import("./pages/Privacidad"));

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
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <RouteErrorBoundary>
          <Suspense fallback={<LoadingScreen />}>
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
        </RouteErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
