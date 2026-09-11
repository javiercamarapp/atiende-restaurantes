import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { isRouteAllowed } from "@/lib/routePermissions";

// Patrón 6 (rescatado de Likida/atiende.ai): guard declarativo de router,
// UNA capa por encima de cada página protegida en App.tsx. Antes, qué
// pantalla puede ver cada rol no tenía ningún punto central — cada página
// (AdminDashboard.tsx, SuperAdminDashboard.tsx, RepartidorDashboard.tsx)
// resolvía su propio chequeo de rol a mano dentro de un useEffect, y un
// intento denegado solo producía un redirect silencioso sin dejar rastro.
//
// Esto es defensa en profundidad, NO un reemplazo: el chequeo interno real
// de cada página (contra su tenant/membresía específica) sigue siendo la
// última palabra sobre qué datos se cargan. RequireRole solo decide si la
// pantalla se monta o no, y dejar constancia cuando no.
const LoadingScreen = () => (
  <main
    className="min-h-screen bg-background flex items-center justify-center"
    aria-busy="true"
    aria-label="Verificando acceso"
  >
    <div className="text-center">
      <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-muted border-t-primary" />
      <p className="mt-3 text-sm text-muted-foreground">Verificando acceso…</p>
    </div>
  </main>
);

export function RequireRole({ children }: { children: ReactNode }) {
  const location = useLocation();
  // undefined = todavía no se resolvió la sesión; null = sin sesión real.
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setUser(session?.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setUser(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const { roles, hasTenantMembership, loading: rolesLoading } = useUserRole(
    user ?? null,
  );

  useEffect(() => {
    if (user === undefined || user === null || rolesLoading) return;
    if (isRouteAllowed(location.pathname, { roles, hasTenantMembership })) {
      return;
    }
    // Registro real del intento denegado (mismo espíritu que privacy_requests
    // para ARCO): la auditoría nunca debe tumbar la navegación si falla, así
    // que el error de red/RPC solo se registra en consola.
    supabase
      .rpc("record_route_access_denial", {
        p_attempted_path: location.pathname.slice(0, 200),
        p_has_tenant_membership: hasTenantMembership,
      })
      .then(({ error }) => {
        if (error) {
          console.error("No se pudo registrar el acceso denegado:", error);
        }
      });
  }, [user, rolesLoading, roles, hasTenantMembership, location.pathname]);

  if (user === undefined || (user && rolesLoading)) {
    return <LoadingScreen />;
  }
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }
  if (!isRouteAllowed(location.pathname, { roles, hasTenantMembership })) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}
