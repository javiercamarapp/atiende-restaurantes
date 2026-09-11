// Patrón 6 (rescatado de Likida/atiende.ai): mapa declarativo de qué
// credencial necesita cada ruta protegida del panel. RLS a nivel de fila
// está fuerte y probado (supabase/tests/privilege_escalation.sql,
// superadmin_platform_rpc.sql, enterprise_tenant_isolation.sql) — qué DATOS
// puede tocar cada rol. Pero qué PANTALLA puede ver cada rol no tenía
// ningún mapa central: src/App.tsx montaba /admin, /admin/superadmin,
// /repartidor y /admin/repartidor/:userId directo, sin ningún guard
// compartido, y cada página resolvía su propio chequeo de rol a mano
// dentro de un useEffect (ver AdminDashboard.tsx, SuperAdminDashboard.tsx,
// RepartidorDashboard.tsx). Este archivo es puro (sin React, sin Supabase)
// para poder testearlo sin infraestructura — RequireRole.tsx lo consulta.
//
// Esto es una capa ADICIONAL (defensa en profundidad) al router, ANTES de
// montar la página real — no reemplaza el chequeo interno que cada página
// ya hace contra su propio tenant/membresía específica.

export type RoutePermissionRule =
  | { kind: "superadmin" }
  | { kind: "tenant_staff" }
  | { kind: "role"; role: "repartidor" };

export interface RoutePermission {
  path: string;
  rule: RoutePermissionRule;
}

// Un superadmin real siempre puede entrar a cualquier ruta protegida de
// abajo (ver AdminDashboard.tsx: "Un superadmin llega aquí con
// ?restaurante=<id> desde 'Ver cuenta'"). isRouteAllowed ya lo contempla
// para cada regla, así que no hace falta repetirlo aquí.
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  { path: "/admin/superadmin", rule: { kind: "superadmin" } },
  { path: "/admin/repartidor/:userId", rule: { kind: "tenant_staff" } },
  { path: "/admin", rule: { kind: "tenant_staff" } },
  { path: "/repartidor", rule: { kind: "role", role: "repartidor" } },
];

function pathMatches(pattern: string, pathname: string): boolean {
  const patternSegments = pattern.split("/").filter(Boolean);
  const pathSegments = pathname.split("/").filter(Boolean);
  if (patternSegments.length !== pathSegments.length) return false;
  return patternSegments.every(
    (segment, index) => segment.startsWith(":") || segment === pathSegments[index],
  );
}

/** La regla declarada para una ruta, o null si la ruta no está en el mapa. */
export function findRoutePermission(pathname: string): RoutePermission | null {
  return ROUTE_PERMISSIONS.find((entry) => pathMatches(entry.path, pathname)) ?? null;
}

export interface RouteAccessContext {
  /** Roles de plataforma reales del usuario (user_roles.role), ej. ["superadmin"]. */
  roles: string[];
  /** true si el usuario tiene al menos una fila propia en restaurant_staff. */
  hasTenantMembership: boolean;
}

/**
 * true si el contexto cumple la regla declarada para pathname. Una ruta que
 * no aparece en el mapa se permite aquí (sin regla declarada, este guard no
 * bloquea) — RequireRole solo se monta alrededor de las rutas que sí están
 * en ROUTE_PERMISSIONS, así que una ruta ausente del mapa nunca pasa por
 * esta función en la práctica.
 */
export function isRouteAllowed(
  pathname: string,
  context: RouteAccessContext,
): boolean {
  const permission = findRoutePermission(pathname);
  if (!permission) return true;
  const isSuperadmin = context.roles.includes("superadmin");
  if (isSuperadmin) return true;
  switch (permission.rule.kind) {
    case "superadmin":
      return false;
    case "tenant_staff":
      return context.hasTenantMembership;
    case "role":
      return context.roles.includes(permission.rule.role);
    default:
      return false;
  }
}
